package com.eqms.backup.agent.objects;

import com.eqms.backup.agent.backup.BackupRepository;
import com.eqms.backup.agent.config.AgentProperties;
import com.eqms.backup.agent.export.ExportException;
import com.eqms.backup.agent.ledger.CanonicalJson;
import com.eqms.backup.agent.ledger.LedgerService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.security.MessageDigest;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.IntConsumer;

/**
 * The periodic check of the live file store (SDS-BR-004 2.4). It reads every stored version and compares its size and SHA-256 with what the
 * backup index recorded when the version was first copied, and compares the checksum the application stored with a document when it was
 * saved with the content the backup holds. It only reports, and writes one record of what it did; it never changes the store.
 * A version that is in the store but not yet in any backup is not a difference: the next backup takes it.
 */
@Service
public class StoreScrubService {

    private static final int MAX_LISTED = 100;

    private final JdbcTemplate jdbc;
    private final ObjectSource source;
    private final BackupRepository repository;
    private final AgentProperties properties;
    private final LedgerService ledger;

    public StoreScrubService(JdbcTemplate jdbc, ObjectSource source, BackupRepository repository, AgentProperties properties, LedgerService ledger) {
        this.jdbc = jdbc;
        this.source = source;
        this.repository = repository;
        this.properties = properties;
        this.ledger = ledger;
    }

    public boolean enabled() {
        return properties.getObjects().isEnabled();
    }

    /** Runs the check and returns its record. {@code progress} is told how far it has got (0-100). */
    public Map<String, Object> run(String trigger, String by, IntConsumer progress) {
        if (!enabled()) throw ExportException.conflict("SCRUB_OBJECTS_NOT_CONFIGURED", "The document store is not configured on this agent");
        Integer running = jdbc.queryForObject("select count(*) from store_scrub_run where status = 'RUNNING' and started_at > now() - interval '12 hours'", Integer.class);
        if (running != null && running > 0) throw ExportException.conflict("SCRUB_ALREADY_RUNNING", "A check of the file store is already running");
        String backupNumber = jdbc.queryForList("select backup_number from backup_run where status = 'COMPLETED' order by started_at desc limit 1", String.class).stream().findFirst().orElse(null);
        UUID id = jdbc.queryForObject("insert into store_scrub_run(trigger_kind, requested_by, backup_number) values (?,?,?) returning id", UUID.class, trigger, by, backupNumber);
        long files = 0;
        long bytes = 0;
        List<Map<String, Object>> differences = new ArrayList<>();
        List<Map<String, Object>> missing = new ArrayList<>();
        List<Map<String, Object>> references = new ArrayList<>();
        int differentCount = 0;
        int missingCount = 0;
        int referenceCount = 0;
        try {
            progress.accept(2);
            List<ObjectSource.Version> listed = source.listVersions();
            Map<String, BackupRepository.Blob> known = new HashMap<>();
            for (BackupRepository.Blob b : repository.allBlobs()) known.put(key(b.bucket(), b.key(), b.versionId()), b);
            java.util.Set<String> seen = new java.util.HashSet<>();
            int index = 0;
            for (ObjectSource.Version v : listed) {
                index++;
                if (v.deleteMarker()) continue;
                String k = key(v.bucket(), v.key(), v.versionId());
                seen.add(k);
                BackupRepository.Blob blob = known.get(k);
                if (blob == null) continue;
                files++;
                if (v.size() != blob.plainSize()) {
                    differentCount++;
                    add(differences, v, blob, "SIZE", String.valueOf(blob.plainSize()), String.valueOf(v.size()));
                } else {
                    String actual = sha256(v);
                    bytes += v.size();
                    if (!actual.equalsIgnoreCase(blob.plainSha256())) {
                        differentCount++;
                        add(differences, v, blob, "CONTENT", blob.plainSha256(), actual);
                    }
                }
                progress.accept(2 + (int) (88L * index / Math.max(1, listed.size())));
            }
            for (Map.Entry<String, BackupRepository.Blob> e : known.entrySet()) {
                BackupRepository.Blob b = e.getValue();
                if (seen.contains(e.getKey()) || !properties.getObjects().getBuckets().contains(b.bucket())) continue;
                missingCount++;
                if (missing.size() < MAX_LISTED) missing.add(Map.of("bucket", b.bucket(), "key", b.key(), "versionId", b.versionId()));
            }
            progress.accept(92);
            for (Map<String, Object> r : referenceDifferences(known)) {
                referenceCount++;
                if (references.size() < MAX_LISTED) references.add(r);
            }
            Map<String, Object> detail = new LinkedHashMap<>();
            detail.put("different", differences);
            detail.put("missing", missing);
            detail.put("referenceDifferences", references);
            jdbc.update("update store_scrub_run set status = 'COMPLETED', finished_at = now(), checked_files = ?, checked_bytes = ?, different_files = ?, missing_files = ?, "
                    + "reference_differences = ?, detail_json = ?::jsonb where id = ?", files, bytes, differentCount, missingCount, referenceCount, CanonicalJson.of(detail), id);
            Map<String, Object> data = new LinkedHashMap<>();
            data.put("files", files);
            data.put("different", differentCount);
            data.put("missing", missingCount);
            data.put("referenceDifferences", referenceCount);
            ledger.append(by, "STORE_SCRUBBED", backupNumber, data);
            if (differentCount + missingCount + referenceCount > 0) {
                repository.insertAlert("HIGH", "STORE_SCRUB_MISMATCH", "The check of the file store found " + differentCount + " file(s) that differ from the backup index, "
                        + missingCount + " missing and " + referenceCount + " document(s) whose stored checksum differs from the content the backup holds.", id.toString().substring(0, 8));
            }
            progress.accept(100);
        } catch (IOException | java.sql.SQLException | RuntimeException e) {
            jdbc.update("update store_scrub_run set status = 'FAILED', finished_at = now(), checked_files = ?, checked_bytes = ?, error_code = 'SCRUB_FAILED', detail_json = ?::jsonb where id = ?",
                    files, bytes, CanonicalJson.of(Map.of("error", String.valueOf(e.getMessage()))), id);
            throw ExportException.conflict("SCRUB_FAILED", "The check of the file store stopped: " + e.getMessage());
        }
        return latest().orElseThrow();
    }

    /**
     * The third layer: the checksum the application stored with a document revision when it saved it, against the content the backup holds
     * for that same version. It finds a file that was already damaged before its first backup, which the index alone cannot.
     */
    private List<Map<String, Object>> referenceDifferences(Map<String, BackupRepository.Blob> known) throws java.sql.SQLException {
        List<Map<String, Object>> out = new ArrayList<>();
        AgentProperties.Source s = properties.getSource();
        String url = "jdbc:postgresql://" + s.getHost() + ":" + s.getPort() + "/" + s.getDatabase();
        try (Connection c = DriverManager.getConnection(url, s.getUser(), s.getPassword())) {
            c.setReadOnly(true);
            try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(
                    "select distinct source_storage_bucket, source_storage_object_key, source_storage_version_id, source_file_checksum from document_revisions "
                            + "where source_file_checksum is not null and source_storage_object_key is not null and source_storage_version_id is not null")) {
                while (rs.next()) {
                    BackupRepository.Blob blob = known.get(key(rs.getString(1), rs.getString(2), rs.getString(3)));
                    String recorded = rs.getString(4);
                    if (blob != null && recorded != null && !recorded.equalsIgnoreCase(blob.plainSha256())) {
                        Map<String, Object> m = new LinkedHashMap<>();
                        m.put("bucket", rs.getString(1));
                        m.put("key", rs.getString(2));
                        m.put("versionId", rs.getString(3));
                        m.put("recordedChecksum", recorded);
                        m.put("backedUpChecksum", blob.plainSha256());
                        out.add(m);
                    }
                }
            }
        }
        return out;
    }

    public Optional<Map<String, Object>> latest() {
        return page(1, 1).stream().findFirst();
    }

    private java.util.List<Map<String, Object>> page(int page, int limit) {
        List<Map<String, Object>> rows = new ArrayList<>();
        jdbc.queryForList("select id, trigger_kind, requested_by, started_at, finished_at, status, backup_number, checked_files, checked_bytes, different_files, missing_files, "
                + "reference_differences, error_code from store_scrub_run order by started_at desc limit ? offset ?", limit, (page - 1) * limit).forEach(row -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", String.valueOf(row.get("id")));
            m.put("trigger", row.get("trigger_kind"));
            m.put("requestedBy", row.get("requested_by"));
            m.put("startedAt", row.get("started_at") instanceof Timestamp t ? t.toInstant().toString() : null);
            m.put("finishedAt", row.get("finished_at") instanceof Timestamp t ? t.toInstant().toString() : null);
            m.put("status", row.get("status"));
            m.put("backupNumber", row.get("backup_number"));
            m.put("checkedFiles", row.get("checked_files"));
            m.put("checkedBytes", row.get("checked_bytes"));
            m.put("differentFiles", row.get("different_files"));
            m.put("missingFiles", row.get("missing_files"));
            m.put("referenceDifferences", row.get("reference_differences"));
            m.put("errorCode", row.get("error_code"));
            rows.add(m);
        });
        return rows;
    }

    public Map<String, Object> list(int page, int limit) {
        int size = Math.min(Math.max(limit, 1), 100);
        int no = Math.max(page, 1);
        Long total = jdbc.queryForObject("select count(*) from store_scrub_run", Long.class);
        long count = total == null ? 0 : total;
        Map<String, Object> pagination = new LinkedHashMap<>();
        pagination.put("page", no);
        pagination.put("limit", size);
        pagination.put("total", count);
        pagination.put("totalPages", Math.max(1, (int) Math.ceil(count / (double) size)));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("data", page(no, size));
        out.put("pagination", pagination);
        return out;
    }

    /** What is not right in one finished run, for the screen that shows it. */
    public Optional<Map<String, Object>> detail(UUID id) {
        return jdbc.queryForList("select detail_json::text as d from store_scrub_run where id = ?", id).stream().findFirst().map(r -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("detailJson", r.get("d"));
            return m;
        });
    }

    private static void add(List<Map<String, Object>> list, ObjectSource.Version v, BackupRepository.Blob blob, String what, String expected, String actual) {
        if (list.size() >= MAX_LISTED) return;
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("bucket", v.bucket());
        m.put("key", v.key());
        m.put("versionId", v.versionId());
        m.put("what", what);
        m.put("expected", expected);
        m.put("actual", actual);
        list.add(m);
    }

    private String sha256(ObjectSource.Version v) throws IOException {
        try (InputStream in = source.open(v)) {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] buffer = new byte[1 << 16];
            int read;
            while ((read = in.read(buffer)) >= 0) digest.update(buffer, 0, read);
            return HexFormat.of().formatHex(digest.digest());
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static String key(String bucket, String key, String version) {
        return bucket + "\0" + key + "\0" + version;
    }
}
