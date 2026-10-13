package com.eqms.backup.agent.backup;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** All SQL on the control database that concerns a backup run. */
@Repository
public class BackupRepository {

    private static final DateTimeFormatter ID_DAY = DateTimeFormatter.ofPattern("yyyyMMdd").withZone(ZoneOffset.UTC);
    private static final DateTimeFormatter ID_TIME = DateTimeFormatter.ofPattern("HHmm").withZone(ZoneOffset.UTC);

    private final JdbcTemplate jdbc;

    public BackupRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public String nextBackupId(Instant now) {
        LocalDate day = now.atZone(ZoneOffset.UTC).toLocalDate();
        Integer seq = jdbc.queryForObject(
                "insert into backup_day_sequence(day, last) values (?, 1) on conflict (day) do update set last = backup_day_sequence.last + 1 returning last",
                Integer.class, java.sql.Date.valueOf(day));
        return "BK-" + ID_DAY.format(now) + "-" + ID_TIME.format(now) + "-" + String.format("%04d", seq);
    }

    public UUID insertRun(String backupId, String environment, String type, String trigger, Integer policyVersion, Instant startedAt,
                          String requestedBy, String reason, String changeControlRef) {
        return jdbc.queryForObject(
                "insert into backup_run(backup_id, environment, type, trigger_kind, status, policy_version, started_at, requested_by, reason, change_control_ref) "
                        + "values (?,?,?,?, 'RUNNING', ?,?,?,?,?) returning id",
                UUID.class, backupId, environment, type, trigger, policyVersion, Timestamp.from(startedAt), requestedBy, reason, changeControlRef);
    }

    public void markCompleted(UUID runId, Instant finishedAt, Instant dbSnapshotAt, long sizeBytes) {
        jdbc.update("update backup_run set status='COMPLETED', finished_at=?, db_snapshot_at=?, size_bytes=? where id=?",
                Timestamp.from(finishedAt), Timestamp.from(dbSnapshotAt), sizeBytes, runId);
    }

    public void markFailed(UUID runId, Instant finishedAt, String code, String detail) {
        jdbc.update("update backup_run set status='FAILED', finished_at=?, error_code=?, error_detail=? where id=?",
                Timestamp.from(finishedAt), code, truncate(detail, 4000), runId);
    }

    /** A run left RUNNING by an agent that died is closed as failed, so it cannot block the next backup for ever. */
    public List<Map<String, Object>> failStaleRunning(Instant now) {
        return jdbc.queryForList("update backup_run set status='FAILED', finished_at=?, error_code='AGENT_RESTARTED', "
                + "error_detail='The agent stopped while this backup was running' where status='RUNNING' returning backup_id, id", Timestamp.from(now));
    }

    public void insertComponent(UUID runId, String component, String status, Long sizeBytes, Long objectCount, String sha256, String rowCountsJson) {
        jdbc.update("insert into backup_component_result(run_id, component, status, size_bytes, object_count, sha256, row_counts_json) values (?,?,?,?,?,?,?::jsonb)",
                runId, component, status, sizeBytes, objectCount, sha256, rowCountsJson);
    }

    public void insertLocation(UUID runId, String targetCode, String path, Instant writtenAt, String readbackSha256, boolean ok) {
        jdbc.update("insert into backup_set_location(run_id, target_code, path, written_at, readback_sha256, ok) values (?,?,?,?,?,?)",
                runId, targetCode, path, Timestamp.from(writtenAt), readbackSha256, ok);
    }

    public void insertManifest(UUID runId, String text, String sha256, String signature, String keyId, String previousSha) {
        jdbc.update("insert into backup_manifest(run_id, manifest_text, manifest_sha256, signature_base64, signing_key_id, previous_manifest_sha256) values (?,?,?,?,?,?)",
                runId, text, sha256, signature, keyId, previousSha);
    }

    public Optional<String> latestManifestSha256() {
        return jdbc.queryForList("select m.manifest_sha256 from backup_manifest m join backup_run r on r.id = m.run_id where r.status='COMPLETED' order by r.started_at desc limit 1", String.class)
                .stream().findFirst();
    }

    public Optional<Long> lastCompletedSize() {
        return jdbc.queryForList("select size_bytes from backup_run where status='COMPLETED' and size_bytes is not null order by started_at desc limit 1", Long.class)
                .stream().findFirst();
    }

    public Optional<Integer> activePolicyVersion() {
        return jdbc.queryForList("select version from backup_policy where status='ACTIVE'", Integer.class).stream().findFirst();
    }

    public Optional<Map<String, Object>> runByBackupId(String backupId) {
        return jdbc.queryForList("select * from backup_run where backup_id = ?", backupId).stream().findFirst();
    }

    public void insertVerification(UUID runId, String tier, String result, String detailJson, Instant at, String by) {
        jdbc.update("insert into backup_verification(run_id, tier, result, detail_json, verified_at, verified_by) values (?,?,?,?::jsonb,?,?)",
                runId, tier, result, detailJson, Timestamp.from(at), by);
    }

    public void insertAlert(String severity, String code, String detail, String ref) {
        jdbc.update("insert into backup_alert(severity, code, detail, ref) values (?,?,?,?)", severity, code, truncate(detail, 2000), ref);
    }

    private static String truncate(String text, int max) {
        return text == null || text.length() <= max ? text : text.substring(0, max);
    }

    public record Blob(String bucket, String key, String versionId, String plainSha256, long plainSize, String cipherSha256, long cipherSize, String path, UUID firstRunId) {
    }

    private static Blob blob(java.sql.ResultSet rs, int row) throws java.sql.SQLException {
        return new Blob(rs.getString("bucket"), rs.getString("object_key"), rs.getString("version_id"), rs.getString("plain_sha256"), rs.getLong("plain_size"),
                rs.getString("cipher_sha256"), rs.getLong("cipher_size"), rs.getString("blob_path"), rs.getObject("first_run_id", UUID.class));
    }

    /** Every stored version, which is the "known" set of the incremental algorithm (SDS 20.2). */
    public List<Blob> allBlobs() {
        return jdbc.query("select * from backup_object_blob order by id", BackupRepository::blob);
    }

    /** Versions stored by this run or by an earlier one: the full view a backup must be able to restore. */
    public List<Blob> blobsUpTo(UUID runId) {
        return jdbc.query("select b.* from backup_object_blob b join backup_run r on r.id = b.first_run_id "
                + "where r.started_at <= (select started_at from backup_run where id = ?) order by b.id", BackupRepository::blob, runId);
    }

    public void insertBlob(Blob b) {
        jdbc.update("insert into backup_object_blob(bucket, object_key, version_id, plain_sha256, plain_size, cipher_sha256, cipher_size, blob_path, first_run_id) values (?,?,?,?,?,?,?,?,?)",
                b.bucket(), b.key(), b.versionId(), b.plainSha256(), b.plainSize(), b.cipherSha256(), b.cipherSize(), b.path(), b.firstRunId());
    }

    /** Where a backup set was written, and whether the copy there was confirmed. */
    public List<Map<String, Object>> locationsFor(UUID runId) {
        return jdbc.queryForList("select target_code, ok from backup_set_location where run_id = ? order by target_code", runId);
    }
}
