package com.eqms.backup.agent.restore;

import com.eqms.backup.agent.backup.BackupRepository;
import com.eqms.backup.agent.exec.CommandRunner;
import com.eqms.backup.agent.objects.TestObjectStore;

import java.io.IOException;
import java.io.InputStream;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Step R8 of a test restore (SDS 11.4.2, WP3.1 slice 4): every document version of the backup is written again into a throw-away
 * bucket, and the scratch database gets an alias from each original version id to the version MinIO gave the copy. The copy is
 * hashed as it is checked against the recorded SHA-256. Then two checks run on the scratch database: C13 (every stored reference
 * resolves through exactly one alias, and the aliases read back the recorded bytes) and C7 (stored objects no record refers to are
 * listed). Production data is never read or written here.
 */
public class RestoreObjectRestore {

    private static final String SCHEME = "minio://";

    /** The alias table. Same columns as the eQMS migration V569 and V570, so the table can move to production unchanged. */
    public static final String ALIAS_DDL ="create table if not exists object_version_alias ("
            + "id bigserial primary key, bucket varchar(255) not null, object_key varchar(1024) not null, "
            + "original_version_id varchar(255) not null, current_version_id varchar(255) not null, "
            + "sha256 varchar(64) not null check (sha256 ~ '^[0-9a-f]{64}$'), restore_number varchar(60), "
            + "created_at timestamptz not null default now(), current_bucket varchar(255), "
            + "constraint object_version_alias_original_uk unique (bucket, object_key, original_version_id))";

    public record Summary(String bucket, int objects, long bytes) {
    }

    /** A reference found in a record: the bucket, key and version it names. */
    public record Reference(String bucket, String key, String versionId) {
        String uri() {
            return SCHEME + bucket + "/" + key + (versionId == null ? "" : "?versionId=" + versionId);
        }
    }

    private final TestObjectStore store;
    private final CommandRunner runner;
    private final String bucketPrefix;

    public RestoreObjectRestore(TestObjectStore store, CommandRunner runner, String bucketPrefix) {
        this.store = store;
        this.runner = runner;
        this.bucketPrefix = bucketPrefix;
    }

    /** The throw-away bucket of one rehearsal: the prefix plus the rehearsal id, lower case, at most 63 characters. */
    public static String bucketFor(String prefix, String rehearsalId) {
        String name = (prefix + rehearsalId.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "-")).replaceAll("-+", "-");
        if (name.length() > 63) name = name.substring(0, 63).replaceAll("-+$", "");
        return name;
    }

    /** Writes every backed-up version into the bucket and records its alias in the scratch database. */
    public Summary restore(String bucket, UUID runId, BackupRepository repository, RestoreKeyring.Session ring, Path envRoot, Connection scratch)
            throws IOException, InterruptedException, SQLException {
        if (!bucket.startsWith(bucketPrefix)) throw new IOException("Refusing to restore objects into " + bucket);
        store.createVersionedBucket(bucket);
        try (Statement st = scratch.createStatement()) {
            st.execute(ALIAS_DDL);
        }
        int count = 0;
        long bytes = 0;
        Path folder = Files.createTempDirectory("restore-object-");
        try {
            for (BackupRepository.Blob blob : repository.blobsUpTo(runId)) {
                Path plain = folder.resolve("object.bin");
                try {
                    CommandRunner.PipelineResult decrypted = runner.pipelineToFile(List.of(ring.decrypt(envRoot.resolve(blob.path()))), plain, 3600);
                    if (!decrypted.ok()) {
                        throw new IOException("Object " + blob.bucket() + "/" + blob.key() + " did not decrypt: " + decrypted.stderrTail());
                    }
                    if (!decrypted.sha256().equals(blob.plainSha256())) {
                        throw new IOException("Object " + blob.bucket() + "/" + blob.key() + " decrypts to different content from the backup");
                    }
                    String current = store.put(bucket, blob.key(), plain);
                    if (current == null || current.isBlank()) {
                        throw new IOException("Object " + blob.key() + " was written without a version id; the bucket must be versioned");
                    }
                    try (PreparedAlias alias = new PreparedAlias(scratch)) {
                        alias.insert(blob.bucket(), blob.key(), blob.versionId(), current, blob.plainSha256(), bucket);
                    }
                    count++;
                    bytes += decrypted.bytes();
                } finally {
                    Files.deleteIfExists(plain);
                }
            }
        } finally {
            Files.deleteIfExists(folder);
        }
        return new Summary(bucket, count, bytes);
    }

    /** C13 and C7 for the scratch database after the restore. */
    public List<com.eqms.backup.agent.restore.PostRestoreChecks.Result> checks(Connection scratch, Summary summary) throws IOException, SQLException {
        Set<Reference> references = references(scratch);
        List<String> unresolved = new ArrayList<>();
        List<String> mismatched = new ArrayList<>();
        Set<String> referencedCurrent = new LinkedHashSet<>();
        for (Reference ref : references) {
            // A reference with no version names the object as the backup holds it. It resolves only when the backup holds exactly
            // one version of that key, so there is no doubt which bytes it means.
            List<String[]> aliases = ref.versionId() == null ? aliasesOfKey(scratch, ref) : aliasesOf(scratch, ref);
            if (aliases.size() != 1) {
                unresolved.add(ref.uri() + " resolves to " + aliases.size() + " alias(es)" + (ref.versionId() == null ? " (no version named)" : ""));
                continue;
            }
            String[] alias = aliases.get(0);
            String currentBucket = alias[0] == null ? ref.bucket() : alias[0];
            String currentVersion = alias[1];
            String recorded = alias[2];
            referencedCurrent.add(currentBucket + "\0" + ref.key() + "\0" + currentVersion);
            if (!sha256Of(currentBucket, ref.key(), currentVersion).equals(recorded)) {
                mismatched.add(ref.uri() + " reads back different bytes through its alias");
            }
        }
        int aliasRows = countAliases(scratch);
        boolean c13Ok = unresolved.isEmpty() && mismatched.isEmpty() && aliasRows == summary.objects();
        String c13Detail = c13Ok
                ? references.size() + " reference(s) resolve through one alias each; " + aliasRows + " alias(es) for " + summary.objects() + " object(s) written"
                : String.join("; ", unresolved.isEmpty() && mismatched.isEmpty()
                        ? List.of("alias count " + aliasRows + " differs from the " + summary.objects() + " object(s) written")
                        : concat(unresolved, mismatched));
        List<PostRestoreChecks.Result> out = new ArrayList<>();
        out.add(new PostRestoreChecks.Result("C13", "Every reference resolves through exactly one alias, and the aliases read back the recorded bytes",
                true, c13Ok, c13Detail));

        // An object is referred to when a reference names it, or when its key appears as a value in a record. The alias table itself
        // is not a record that refers to anything.
        List<TestObjectStore.Stored> stored = store.listVersions(summary.bucket());
        Set<String> keys = stored.stream().map(TestObjectStore.Stored::key).collect(Collectors.toCollection(LinkedHashSet::new));
        Set<String> referredKeys = new LinkedHashSet<>();
        for (String current : referencedCurrent) referredKeys.add(current.split("\0", -1)[1]);
        referredKeys.addAll(keysNamedInRecords(scratch, keys));
        List<String> orphans = new ArrayList<>();
        for (TestObjectStore.Stored s : stored) {
            if (!referredKeys.contains(s.key())) {
                orphans.add("ORPHAN " + s.key() + " (" + s.versionId() + ")");
            }
        }
        String c7Detail = orphans.size() + " orphan(s) of " + stored.size() + " stored version(s)"
                + (orphans.isEmpty() ? "" : ": " + orphans.stream().limit(20).collect(Collectors.joining("; ")));
        out.add(new PostRestoreChecks.Result("C7", "Stored objects that no record refers to are listed and labelled", true, true, c7Detail));
        return out;
    }

    /**
     * C5 (SDS 14.3): every effective revision has a signature, and the stored document it was signed on reads back, through its alias,
     * to the checksum the signature recorded. Only the revisions that are effective are read.
     */
    public PostRestoreChecks.Result signatures(Connection scratch) throws SQLException, IOException {
        return signatures(scratch, true);
    }

    /** {@code required = false} reports the same result as a warning (DEV only; see AgentProperties). */
    public PostRestoreChecks.Result signatures(Connection scratch, boolean required) throws SQLException, IOException {
        int effective = 0;
        int unsigned = 0;
        int noStoredVersion = 0;
        List<String> problems = new ArrayList<>();
        String sql = "select r.id, r.source_storage_bucket, r.source_storage_object_key, r.source_storage_version_id, r.source_file_checksum, "
                + "s.document_checksum_after_sign, s.meaning from document_revisions r left join electronic_signatures s on s.revision_id = r.id "
                + "where r.status_code = 'EFFECTIVE' order by r.id, s.signed_at";
        Map<String, List<String[]>> byRevision = new LinkedHashMap<>();
        Map<String, String[]> revisions = new LinkedHashMap<>();
        try (Statement st = scratch.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            while (rs.next()) {
                String id = rs.getString(1);
                revisions.putIfAbsent(id, new String[] {rs.getString(2), rs.getString(3), rs.getString(4), rs.getString(5)});
                byRevision.computeIfAbsent(id, k -> new ArrayList<>());
                if (rs.getString(6) != null) byRevision.get(id).add(new String[] {rs.getString(6), rs.getString(7)});
            }
        }
        for (String id : revisions.keySet()) {
            effective++;
            String[] rev = revisions.get(id);
            List<String[]> signatures = byRevision.get(id);
            if (signatures.isEmpty()) {
                unsigned++;
                problems.add("revision " + id + " has no signature");
                continue;
            }
            if (rev[0] == null || rev[1] == null || rev[2] == null) {
                noStoredVersion++;
                problems.add("revision " + id + " has no stored document version");
                continue;
            }
            List<String[]> aliases = aliasesOf(scratch, new Reference(rev[0], rev[1], rev[2]));
            if (aliases.size() != 1) {
                problems.add("revision " + id + " document resolves to " + aliases.size() + " alias(es)");
                continue;
            }
            String currentBucket = aliases.get(0)[0] == null ? rev[0] : aliases.get(0)[0];
            String bytes = sha256Of(currentBucket, rev[1], aliases.get(0)[1]);
            String recorded = rev[3];
            boolean good = bytes.equals(recorded);
            for (String[] signature : signatures) {
                if (!signature[0].equals(bytes)) good = false;
            }
            if (!good) problems.add("revision " + id + " document does not match its recorded checksum");
        }
        boolean ok = problems.isEmpty();
        String detail = ok
                ? effective + " effective revision(s), each signed; each document reads back to its signed checksum"
                : effective + " effective revision(s); " + unsigned + " unsigned, " + noStoredVersion + " without a stored version; "
                        + problems.stream().limit(10).collect(Collectors.joining("; "));
        return new PostRestoreChecks.Result("C5", "Each effective revision is signed, and its stored document reads back to the signed checksum",
                required, ok, required ? detail : "DEV warning only: " + detail);
    }

    private static List<String> concat(List<String> a, List<String> b) {
        List<String> all = new ArrayList<>(a);
        all.addAll(b);
        return all;
    }

    /** The keys, among those given, that appear exactly as a value in some text column of a record table (not the alias table). */
    Set<String> keysNamedInRecords(Connection scratch, Set<String> keys) throws SQLException {
        Set<String> found = new LinkedHashSet<>();
        if (keys.isEmpty()) return found;
        List<String> batch = new ArrayList<>(keys);
        for (String[] column : textColumns(scratch)) {
            if ("object_version_alias".equals(column[0])) continue;
            for (int from = 0; from < batch.size(); from += 500) {
                List<String> part = batch.subList(from, Math.min(batch.size(), from + 500));
                String marks = String.join(",", java.util.Collections.nCopies(part.size(), "?"));
                try (var ps = scratch.prepareStatement("select distinct " + quote(column[1]) + " from " + quote(column[0]) + " where " + quote(column[1]) + " in (" + marks + ")")) {
                    for (int i = 0; i < part.size(); i++) ps.setString(i + 1, part.get(i));
                    try (ResultSet rs = ps.executeQuery()) {
                        while (rs.next()) found.add(rs.getString(1));
                    }
                }
            }
        }
        return found;
    }

    private static List<String[]> textColumns(Connection scratch) throws SQLException {
        List<String[]> columns = new ArrayList<>();
        try (Statement st = scratch.createStatement();
             ResultSet rs = st.executeQuery("select table_name, column_name from information_schema.columns where table_schema = 'public' "
                     + "and data_type in ('character varying', 'text')")) {
            while (rs.next()) columns.add(new String[] {rs.getString(1), rs.getString(2)});
        }
        return columns;
    }

    /** Every minio:// reference in any text column of the scratch database. */
    Set<Reference> references(Connection scratch) throws SQLException {
        List<String[]> columns = new ArrayList<>();
        try (Statement st = scratch.createStatement();
             ResultSet rs = st.executeQuery("select table_name, column_name from information_schema.columns where table_schema = 'public' "
                     + "and data_type in ('character varying', 'text')")) {
            while (rs.next()) columns.add(new String[] {rs.getString(1), rs.getString(2)});
        }
        Set<Reference> out = new LinkedHashSet<>();
        for (String[] column : columns) {
            String sql = "select distinct " + quote(column[1]) + " from " + quote(column[0]) + " where " + quote(column[1]) + " like 'minio://%'";
            try (Statement st = scratch.createStatement(); ResultSet rs = st.executeQuery(sql)) {
                while (rs.next()) out.add(parse(rs.getString(1)));
            }
        }
        return out;
    }

    public static Reference parse(String uri) {
        String value = uri.substring(SCHEME.length());
        String version = null;
        int query = value.indexOf("?versionId=");
        if (query >= 0) {
            version = URLDecoder.decode(value.substring(query + 11), StandardCharsets.UTF_8);
            value = value.substring(0, query);
        }
        int separator = value.indexOf('/');
        if (separator <= 0 || separator == value.length() - 1) throw new IllegalArgumentException("Invalid MinIO reference " + uri);
        return new Reference(value.substring(0, separator), URLDecoder.decode(value.substring(separator + 1), StandardCharsets.UTF_8), version);
    }

    private static List<String[]> aliasesOf(Connection scratch, Reference ref) throws SQLException {
        List<String[]> out = new ArrayList<>();
        try (var ps = scratch.prepareStatement("select current_bucket, current_version_id, sha256 from object_version_alias "
                + "where bucket = ? and object_key = ? and original_version_id = ?")) {
            ps.setString(1, ref.bucket());
            ps.setString(2, ref.key());
            ps.setString(3, ref.versionId());
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) out.add(new String[] {rs.getString(1), rs.getString(2), rs.getString(3)});
            }
        }
        return out;
    }

    private static List<String[]> aliasesOfKey(Connection scratch, Reference ref) throws SQLException {
        List<String[]> out = new ArrayList<>();
        try (var ps = scratch.prepareStatement("select current_bucket, current_version_id, sha256 from object_version_alias where bucket = ? and object_key = ?")) {
            ps.setString(1, ref.bucket());
            ps.setString(2, ref.key());
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) out.add(new String[] {rs.getString(1), rs.getString(2), rs.getString(3)});
            }
        }
        return out;
    }

    private static int countAliases(Connection scratch) throws SQLException {
        try (Statement st = scratch.createStatement(); ResultSet rs = st.executeQuery("select count(*) from object_version_alias")) {
            rs.next();
            return rs.getInt(1);
        }
    }

    private String sha256Of(String bucket, String key, String versionId) throws IOException {
        try (InputStream in = store.open(bucket, key, versionId)) {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] buffer = new byte[64 * 1024];
            int read;
            while ((read = in.read(buffer)) != -1) digest.update(buffer, 0, read);
            return HexFormat.of().formatHex(digest.digest());
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IOException("SHA-256 is not available", e);
        }
    }

    private static String quote(String identifier) {
        return "\"" + identifier.replace("\"", "\"\"") + "\"";
    }

    /** One insert statement, reused for the rows of one restore. */
    private static final class PreparedAlias implements AutoCloseable {
        private final java.sql.PreparedStatement statement;

        PreparedAlias(Connection scratch) throws SQLException {
            this.statement = scratch.prepareStatement("insert into object_version_alias(bucket, object_key, original_version_id, current_version_id, sha256, current_bucket) "
                    + "values (?, ?, ?, ?, ?, ?)");
        }

        void insert(String bucket, String key, String originalVersion, String currentVersion, String sha256, String currentBucket) throws SQLException {
            statement.setString(1, bucket);
            statement.setString(2, key);
            statement.setString(3, originalVersion);
            statement.setString(4, currentVersion);
            statement.setString(5, sha256);
            statement.setString(6, currentBucket);
            statement.executeUpdate();
        }

        @Override
        public void close() throws SQLException {
            statement.close();
        }
    }
}
