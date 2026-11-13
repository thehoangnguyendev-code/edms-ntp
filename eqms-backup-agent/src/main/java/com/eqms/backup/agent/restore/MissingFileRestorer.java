package com.eqms.backup.agent.restore;

import com.eqms.backup.agent.backup.BackupRepository;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Supplier;

/**
 * Step R8 of a production restore (SDS-BR-003 step 4). Files are only ADDED: each version of the backup that the live store lacks is
 * written back and an alias row (original version -> version the store gave it) is put into the restored database, before the swap.
 * A version that is already in the store is not touched. Afterwards every file reference of the restored database is checked: it should
 * resolve to a version in the store or through an alias. A reference that does not is reported as a warning in the result (decision of
 * 2026-11-09: a backup with missing files may be restored, and the warning is recorded); it does not stop the step.
 * A column that looks like a file reference (name contains object_key) but is neither registered nor listed as known-unchecked fails
 * the step, so a new kind of file record cannot be missed without someone deciding.
 */
public class MissingFileRestorer {

    /** The live file store, reduced to what this step needs. Writes are add-only. */
    public interface LiveStore {
        /** True when this version exists; with a null version, true when any version of the key exists. */
        boolean hasVersion(String bucket, String key, String versionId) throws IOException;

        /** Stores the file as a new version of the key and returns the version id given. */
        String put(String bucket, String key, Path file) throws IOException;

        /** The buckets this restore may write to. */
        Set<String> writableBuckets();

        /** The size in bytes of this version as the store holds it, or -1 when the store cannot say. */
        default long sizeOf(String bucket, String key, String versionId) throws IOException {
            return -1;
        }

        /** The SHA-256 of the content of this version as the store holds it, or null when the store cannot say. */
        default String sha256Of(String bucket, String key, String versionId) throws IOException {
            return null;
        }
    }

    /** Decrypts one backed-up object into the file and returns the SHA-256 of the decrypted bytes. */
    @FunctionalInterface
    public interface BlobReader {
        String readPlain(BackupRepository.Blob blob, Path destination) throws Exception;
    }

    /** A table whose columns name a stored file. {@code version} may be null when the table keeps none. */
    public record Column(String table, String bucket, String key, String version) {
    }

    public static final List<Column> REGISTRY = List.of(
            new Column("document_revisions", "source_storage_bucket", "source_storage_object_key", "source_storage_version_id"),
            new Column("document_revisions", "fillable_template_storage_bucket", "fillable_template_storage_object_key", "fillable_template_storage_version_id"),
            new Column("document_revision_template_lineage", "source_storage_bucket", "source_storage_object_key", "source_storage_version_id"),
            new Column("controlled_copies", "controlled_copy_storage_bucket", "controlled_copy_storage_object_key", "controlled_copy_storage_version_id"),
            new Column("controlled_copy_recall_items", "storage_bucket", "storage_object_key", "storage_version_id"),
            new Column("uncontrolled_copies", "uncontrolled_copy_storage_bucket", "uncontrolled_copy_storage_object_key", "uncontrolled_copy_storage_version_id"),
            new Column("executed_records", "storage_bucket", "storage_object_key", "storage_version_id"),
            new Column("report_artifacts", "bucket", "object_key", "object_version"));

    /** Columns that hold a key but cannot be checked against the object store here; each needs its own decision (listed in the result). */
    public static final Set<String> KNOWN_UNCHECKED = Set.of(
            "object_version_alias.object_key",
            "revision_snapshot_history.object_key",
            "publishing_template_components.object_key",
            "report_artifact_publication_journal.object_key",
            "training_specimen_signatures.object_key", "training_specimen_signatures.object_key_2",
            "training_specimen_signatures.original_object_key", "training_specimen_signatures.original_object_key_2");

    /** {@code unresolved} lists references that neither the store nor an alias can answer: a warning, since the backup may already carry them. */
    public record Result(int present, int added, int references, List<String> notChecked, List<String> unresolved, List<String> repaired, List<String> unrepairable) {
        public Result(int present, int added, int references, List<String> notChecked, List<String> unresolved) {
            this(present, added, references, notChecked, unresolved, List.of(), List.of());
        }
    }

    private final LiveStore store;
    private final BlobReader reader;

    public MissingFileRestorer(LiveStore store, BlobReader reader) {
        this.store = store;
        this.reader = reader;
    }

    public Result run(Supplier<List<BackupRepository.Blob>> blobs, Connection restored) throws Exception {
        try (Statement st = restored.createStatement()) {
            st.execute(RestoreObjectRestore.ALIAS_DDL);
        }
        int present = 0;
        int added = 0;
        List<String> repaired = new ArrayList<>();
        List<String> unrepairable = new ArrayList<>();
        Path folder = Files.createTempDirectory("restore-files-");
        try {
            for (BackupRepository.Blob blob : blobs.get()) {
                boolean inStore = store.hasVersion(blob.bucket(), blob.key(), blob.versionId());
                String problem = inStore ? contentProblem(blob) : null;
                if (inStore && problem == null) {
                    present++;
                    continue;
                }
                if (inStore) {
                    // The version is there but is not what the backup recorded: content of a stored version never changes legitimately, so it is damaged
                    // or was altered. It is never overwritten: the right content is added as a new version and the old version id points to it.
                    String name = blob.bucket() + "/" + blob.key() + "@" + blob.versionId();
                    if (!store.writableBuckets().contains(blob.bucket())) {
                        unrepairable.add(name + ": " + problem + "; the bucket is read only for this restore");
                        continue;
                    }
                    Path good = folder.resolve("object.bin");
                    try {
                        String sha = reader.readPlain(blob, good);
                        if (!blob.plainSha256().equals(sha)) {
                            unrepairable.add(name + ": " + problem + "; the backup does not hold the recorded content either");
                            continue;
                        }
                        String current = store.put(blob.bucket(), blob.key(), good);
                        if (current == null || current.isBlank()) {
                            unrepairable.add(name + ": " + problem + "; the correct content could not be stored");
                            continue;
                        }
                        insertAlias(restored, blob, current);
                        repaired.add(name + ": " + problem + "; the correct content was added as version " + current);
                    } catch (Exception e) {
                        unrepairable.add(name + ": " + problem + "; not repaired: " + e.getMessage());
                    } finally {
                        Files.deleteIfExists(good);
                    }
                    continue;
                }
                // a file that is missing can be added only to a bucket this restore may write to (the legacy revisions bucket is read only)
                if (!store.writableBuckets().contains(blob.bucket())) {
                    throw new RestoreRunEngine.StepFailure("RESTORE_FILES_BUCKET", "File " + blob.key() + " is missing from bucket " + blob.bucket() + ", which this restore may not write to");
                }
                Path plain = folder.resolve("object.bin");
                try {
                    String sha = reader.readPlain(blob, plain);
                    if (!blob.plainSha256().equals(sha)) {
                        throw new RestoreRunEngine.StepFailure("RESTORE_FILES_HASH", "File " + blob.bucket() + "/" + blob.key() + " decrypts to different content from the backup");
                    }
                    String current = store.put(blob.bucket(), blob.key(), plain);
                    if (current == null || current.isBlank()) {
                        throw new RestoreRunEngine.StepFailure("RESTORE_FILES_NO_VERSION", "File " + blob.key() + " was stored without a version id");
                    }
                    insertAlias(restored, blob, current);
                    added++;
                } finally {
                    Files.deleteIfExists(plain);
                }
            }
        } finally {
            Files.deleteIfExists(folder);
        }
        List<String> unregistered = unregisteredColumns(restored);
        if (!unregistered.isEmpty()) {
            throw new RestoreRunEngine.StepFailure("RESTORE_FILES_UNREGISTERED", String.join("; ", unregistered.subList(0, Math.min(20, unregistered.size()))));
        }
        List<String> unresolved = unresolved(restored);
        int refs = countReferences(restored);
        return new Result(present, added, refs, new ArrayList<>(new java.util.TreeSet<>(KNOWN_UNCHECKED)), unresolved, repaired, unrepairable);
    }

    public Map<String, Object> toDetail(Result r) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("alreadyPresent", r.present());
        out.put("added", r.added());
        out.put("referencesChecked", r.references());
        out.put("notCheckedHere", r.notChecked());
        out.put("warningUnresolvedReferences", r.unresolved().size());
        out.put("warningSample", r.unresolved().subList(0, Math.min(20, r.unresolved().size())));
        out.put("differentFilesRepaired", r.repaired().size());
        out.put("differentFilesRepairedList", r.repaired().subList(0, Math.min(50, r.repaired().size())));
        out.put("warningDifferentFilesNotRepaired", r.unrepairable().size());
        out.put("warningNotRepairedList", r.unrepairable().subList(0, Math.min(50, r.unrepairable().size())));
        return out;
    }

    /** Null when the stored version has the size and SHA-256 the backup recorded; otherwise a short description of the difference. */
    private String contentProblem(BackupRepository.Blob blob) {
        try {
            long size = store.sizeOf(blob.bucket(), blob.key(), blob.versionId());
            if (size >= 0 && size != blob.plainSize()) return "its size is " + size + " bytes, the backup recorded " + blob.plainSize();
            String sha = store.sha256Of(blob.bucket(), blob.key(), blob.versionId());
            if (sha != null && !sha.equalsIgnoreCase(blob.plainSha256())) return "its content differs from the backup at the same size";
        } catch (IOException e) {
            // a store that cannot be read for content (a read-only legacy bucket, for example) cannot vouch against the backup; it is not a difference
            return null;
        }
        return null;
    }

    private static void insertAlias(Connection c, BackupRepository.Blob blob, String current) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement("insert into object_version_alias(bucket, object_key, original_version_id, current_version_id, sha256, current_bucket) "
                + "values (?,?,?,?,?,?)")) {
            ps.setString(1, blob.bucket());
            ps.setString(2, blob.key());
            ps.setString(3, blob.versionId());
            ps.setString(4, current);
            ps.setString(5, blob.plainSha256());
            ps.setString(6, blob.bucket());
            ps.executeUpdate();
        }
    }

    /** Columns named like a file key that nobody has registered or excluded. */
    private List<String> unregisteredColumns(Connection c) throws SQLException {
        Set<String> known = new LinkedHashSet<>(KNOWN_UNCHECKED);
        for (Column col : REGISTRY) known.add(col.table() + "." + col.key());
        List<String> out = new ArrayList<>();
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery("select table_name || '.' || column_name from information_schema.columns "
                + "where table_schema = 'public' and column_name like '%object_key%' order by 1")) {
            while (rs.next()) {
                String name = rs.getString(1);
                if (!known.contains(name)) out.add("UNREGISTERED file column " + name);
            }
        }
        return out;
    }

    private List<String> unresolved(Connection c) throws SQLException, IOException {
        List<String> out = new ArrayList<>();
        for (Column col : REGISTRY) {
            if (!tableHas(c, col.table(), col.key())) continue;
            String versionExpr = col.version() == null ? "null" : q(col.version());
            String sql = "select distinct " + q(col.bucket()) + ", " + q(col.key()) + ", " + versionExpr + " from " + q(col.table())
                    + " where " + q(col.key()) + " is not null";
            try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
                while (rs.next()) {
                    String bucket = rs.getString(1);
                    String key = rs.getString(2);
                    String version = rs.getString(3);
                    if (!resolves(c, bucket, key, version)) out.add(col.table() + " -> " + bucket + "/" + key + (version == null ? "" : "@" + version));
                }
            }
        }
        return out;
    }

    private int countReferences(Connection c) throws SQLException {
        int n = 0;
        for (Column col : REGISTRY) {
            if (!tableHas(c, col.table(), col.key())) continue;
            try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery("select count(*) from " + q(col.table()) + " where " + q(col.key()) + " is not null")) {
                rs.next();
                n += rs.getInt(1);
            }
        }
        return n;
    }

    private boolean resolves(Connection c, String bucket, String key, String version) throws SQLException, IOException {
        if (bucket == null) return false;
        if (store.hasVersion(bucket, key, version)) return true;
        if (version == null) return false;
        try (PreparedStatement ps = c.prepareStatement("select 1 from object_version_alias where bucket = ? and object_key = ? and original_version_id = ?")) {
            ps.setString(1, bucket);
            ps.setString(2, key);
            ps.setString(3, version);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        }
    }

    private static boolean tableHas(Connection c, String table, String column) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement("select 1 from information_schema.columns where table_schema = 'public' and table_name = ? and column_name = ?")) {
            ps.setString(1, table);
            ps.setString(2, column);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        }
    }

    private static String q(String ident) {
        return "\"" + ident.replace("\"", "\"\"") + "\"";
    }
}
