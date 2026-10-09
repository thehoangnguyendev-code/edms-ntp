package com.eqms.backup.agent.export;

import com.eqms.backup.agent.backup.BackupRepository;
import com.eqms.backup.agent.config.AgentProperties;
import com.eqms.backup.agent.job.JobQueue;
import com.eqms.backup.agent.ledger.CanonicalJson;
import com.eqms.backup.agent.ledger.LedgerService;
import com.eqms.backup.agent.manifest.ManifestService;
import com.eqms.backup.agent.manifest.SigningKeys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Stream;

/**
 * Export Backup Set (SDS 6.5). A verified backup is written, with everything it depends on, to a registered offline medium so it
 * can be kept somewhere else. The request and the approval are two different people; the package is built by the agent from the
 * stored (already encrypted) data, read back file by file, and closed with a signed receipt. A package without a valid receipt is
 * not a package.
 */
@Service
public class ExportService {

    private static final Logger log = LoggerFactory.getLogger(ExportService.class);
    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("yyyyMMdd").withZone(ZoneOffset.UTC);
    private static final int MAX_REASON = 500;

    public record Page(List<Map<String, Object>> data, int page, int limit, long total) {
    }

    private final JdbcTemplate jdbc;
    private final TransactionTemplate tx;
    private final LedgerService ledger;
    private final BackupRepository repository;
    private final MediaService media;
    private final JobQueue queue;
    private final ManifestService manifests;
    private final SigningKeys keys;
    private final AgentProperties properties;

    public ExportService(JdbcTemplate jdbc, TransactionTemplate tx, LedgerService ledger, BackupRepository repository, MediaService media,
                         JobQueue queue, ManifestService manifests, SigningKeys keys, AgentProperties properties) {
        this.jdbc = jdbc;
        this.tx = tx;
        this.ledger = ledger;
        this.repository = repository;
        this.media = media;
        this.queue = queue;
        this.manifests = manifests;
        this.keys = keys;
        this.properties = properties;
    }

    // ------------------------------------------------------------------ reading

    private static final String SELECT = "select e.id, e.export_id, r.backup_id, m.label as media_label, m.id as media_id, e.status, e.requested_by, e.reason, e.requested_at, e.approved_by, "
            + "e.decided_at, e.decision_reason, e.started_at, e.finished_at, e.estimated_bytes, e.size_bytes, e.file_count, e.receipt_sha256, e.package_path, e.error_code, "
            + "e.error_detail, e.notes_json::text as notes from backup_export e join backup_run r on r.id = e.run_id join offline_media m on m.id = e.media_id";

    public Page page(String search, String status, String backupId, String sortBy, boolean ascending, int page, int limit) {
        int safeLimit = Math.min(Math.max(limit, 1), 100);
        int safePage = Math.max(page, 1);
        List<Object> args = new ArrayList<>();
        StringBuilder where = new StringBuilder(" where 1=1");
        if (status != null && !status.isBlank()) {
            where.append(" and e.status = ?");
            args.add(status.trim().toUpperCase(Locale.ROOT));
        }
        if (backupId != null && !backupId.isBlank()) {
            where.append(" and r.backup_id = ?");
            args.add(backupId.trim());
        }
        if (search != null && !search.isBlank()) {
            where.append(" and (lower(e.export_id) like ? or lower(r.backup_id) like ? or lower(m.label) like ? or lower(e.requested_by) like ? or lower(coalesce(e.approved_by,'')) like ?)");
            String like = "%" + search.trim().toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
            for (int i = 0; i < 5; i++) args.add(like);
        }
        String column = switch (sortBy == null ? "" : sortBy) {
            case "status" -> "e.status";
            case "backupId" -> "r.backup_id";
            case "media" -> "m.label";
            case "requestedBy" -> "e.requested_by";
            case "finishedAt" -> "e.finished_at";
            default -> "e.requested_at";
        };
        Long total = jdbc.queryForObject("select count(*) from backup_export e join backup_run r on r.id = e.run_id join offline_media m on m.id = e.media_id" + where, Long.class, args.toArray());
        List<Object> pageArgs = new ArrayList<>(args);
        pageArgs.add(safeLimit);
        pageArgs.add((safePage - 1) * safeLimit);
        List<Map<String, Object>> rows = jdbc.queryForList(SELECT + where + " order by " + column + (ascending ? " asc" : " desc") + " nulls last, e.export_id desc limit ? offset ?", pageArgs.toArray())
                .stream().map(ExportService::view).toList();
        return new Page(rows, safePage, safeLimit, total == null ? 0 : total);
    }

    public Map<String, Object> get(String exportId) {
        return jdbc.queryForList(SELECT + " where e.export_id = ?", exportId).stream().findFirst().map(ExportService::view)
                .orElseThrow(() -> ExportException.notFound("EXPORT_NOT_FOUND", "There is no export " + exportId));
    }

    private static Map<String, Object> view(Map<String, Object> row) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", String.valueOf(row.get("id")));
        m.put("exportId", row.get("export_id"));
        m.put("backupId", row.get("backup_id"));
        m.put("mediaId", String.valueOf(row.get("media_id")));
        m.put("mediaLabel", row.get("media_label"));
        m.put("status", row.get("status"));
        m.put("requestedBy", row.get("requested_by"));
        m.put("reason", row.get("reason"));
        m.put("requestedAt", instant(row.get("requested_at")));
        m.put("approvedBy", row.get("approved_by"));
        m.put("decidedAt", instant(row.get("decided_at")));
        m.put("decisionReason", row.get("decision_reason"));
        m.put("startedAt", instant(row.get("started_at")));
        m.put("finishedAt", instant(row.get("finished_at")));
        m.put("estimatedBytes", row.get("estimated_bytes"));
        m.put("sizeBytes", row.get("size_bytes"));
        m.put("fileCount", row.get("file_count"));
        m.put("receiptSha256", row.get("receipt_sha256") == null ? null : String.valueOf(row.get("receipt_sha256")).trim());
        m.put("packagePath", row.get("package_path"));
        m.put("errorCode", row.get("error_code"));
        m.put("errorDetail", row.get("error_detail"));
        m.put("notes", row.get("notes"));
        return m;
    }

    private static String instant(Object value) {
        return value instanceof Timestamp t ? t.toInstant().toString() : null;
    }

    /** What exporting this backup would write: the database, the document index and every stored document version it depends on. */
    public Map<String, Object> estimate(String backupId) {
        Map<String, Object> run = exportableRun(backupId);
        UUID runId = (UUID) run.get("id");
        long bytes = 0;
        int files = 6; // manifest, signature, checksums, package checksums, receipt and its signature; tools and README are tiny
        for (Map<String, Object> c : jdbc.queryForList("select size_bytes from backup_component_result where run_id = ? and status = 'COMPLETED'", runId)) {
            bytes += ((Number) c.get("size_bytes")).longValue();
            files++;
        }
        for (BackupRepository.Blob blob : repository.blobsUpTo(runId)) {
            bytes += blob.cipherSize();
            files++;
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("backupId", backupId);
        out.put("estimatedBytes", bytes);
        out.put("fileCount", files);
        return out;
    }

    // ------------------------------------------------------------------ the steps

    public Map<String, Object> request(String backupId, UUID mediaId, String reason, String by) {
        String requester = person(by);
        String why = reason == null ? "" : reason.trim();
        if (why.isEmpty() || why.length() > MAX_REASON) throw ExportException.invalid("EXPORT_REASON_REQUIRED", "A reason is required (at most " + MAX_REASON + " characters)");
        Map<String, Object> run = exportableRun(backupId);
        Map<String, Object> medium = media.get(mediaId);
        if (!"AVAILABLE".equals(medium.get("status"))) throw ExportException.conflict("EXPORT_MEDIA_NOT_AVAILABLE", "The medium is " + medium.get("status") + "; only an available medium can receive a package");
        long estimate = ((Number) estimate(backupId).get("estimatedBytes")).longValue();
        if ((long) (estimate * 1.1) > ((Number) medium.get("capacityBytes")).longValue()) {
            throw ExportException.conflict("EXPORT_MEDIA_TOO_SMALL", "The package needs about " + estimate + " bytes and the medium holds " + medium.get("capacityBytes"));
        }
        Map<String, Object> notes = new LinkedHashMap<>();
        if (sameDisk()) {
            if (!"DEV".equalsIgnoreCase(properties.getEnvironment())) {
                throw ExportException.conflict("EXPORT_SAME_DISK", "The export folder is on the same disk as T1, so it would not protect against losing that disk");
            }
            notes.put("sameDiskAsT1", true);
        }
        try {
            String exportId = tx.execute(status -> {
                Long seq = jdbc.queryForObject("select nextval('backup_export_seq')", Long.class);
                String id = "EXP-" + DAY.format(Instant.now()) + "-" + String.format("%04d", seq);
                jdbc.update("insert into backup_export(export_id, run_id, media_id, status, requested_by, reason, estimated_bytes, notes_json) values (?,?,?,'REQUESTED',?,?,?,?::jsonb)",
                        id, run.get("id"), mediaId, requester, why, estimate, CanonicalJson.of(notes));
                return id;
            });
            ledger.append(requester, "BACKUP_EXPORT_REQUESTED", backupId, Map.of("exportId", exportId, "media", medium.get("label")));
            return get(exportId);
        } catch (DuplicateKeyException e) {
            throw ExportException.conflict("EXPORT_MEDIA_BUSY", "Another export is already waiting or running for this medium");
        }
    }

    public Map<String, Object> approve(String exportId, String by) {
        String approver = person(by);
        Map<String, Object> export = get(exportId);
        requireStatus(export, "REQUESTED");
        if (approver.equalsIgnoreCase((String) export.get("requestedBy"))) {
            ledger.append(approver, "BACKUP_EXPORT_REFUSED", String.valueOf(export.get("backupId")), Map.of("exportId", exportId, "reason", "SAME_PERSON"));
            throw new ExportException(ExportException.Kind.SEPARATION, "EXPORT_SAME_PERSON", "The person who requested an export cannot be the one who approves it");
        }
        tx.executeWithoutResult(s -> {
            jdbc.update("update backup_export set status = 'APPROVED', approved_by = ?, decided_at = now() where export_id = ? and status = 'REQUESTED'", approver, exportId);
            queue.enqueue("EXPORT", CanonicalJson.of(Map.of("exportId", exportId)), approver);
        });
        ledger.append(approver, "BACKUP_EXPORT_APPROVED", String.valueOf(export.get("backupId")), Map.of("exportId", exportId, "requestedBy", export.get("requestedBy")));
        return get(exportId);
    }

    public Map<String, Object> reject(String exportId, String by, String reason) {
        String actor = person(by);
        String why = reason == null ? "" : reason.trim();
        if (why.isEmpty() || why.length() > MAX_REASON) throw ExportException.invalid("EXPORT_REASON_REQUIRED", "A reason is required");
        Map<String, Object> export = get(exportId);
        requireStatus(export, "REQUESTED");
        jdbc.update("update backup_export set status = 'REJECTED', approved_by = null, decided_at = now(), decision_reason = ? where export_id = ? and status = 'REQUESTED'", why, exportId);
        ledger.append(actor, "BACKUP_EXPORT_REJECTED", String.valueOf(export.get("backupId")), Map.of("exportId", exportId, "reason", why));
        return get(exportId);
    }

    // ------------------------------------------------------------------ building the package (agent job)

    /** Result of a run: the export record after the attempt. A failure is recorded, alerted and returned, never thrown. */
    public Map<String, Object> run(String exportId, String by) {
        Map<String, Object> export = get(exportId);
        if (!"APPROVED".equals(export.get("status"))) throw ExportException.conflict("EXPORT_STATE", "Export " + exportId + " is " + export.get("status") + ", not approved");
        jdbc.update("update backup_export set status = 'RUNNING', started_at = now() where export_id = ? and status = 'APPROVED'", exportId);
        String backupId = (String) export.get("backupId");
        UUID mediaId = UUID.fromString((String) export.get("mediaId"));
        Map<String, Object> medium = media.get(mediaId);
        Path partial = null;
        try {
            Map<String, Object> run = repository.runByBackupId(backupId).orElseThrow(() -> new PackageException("EXPORT_BACKUP_MISSING", "The backup is no longer recorded"));
            UUID runId = (UUID) run.get("id");
            Path root = properties.getExports().getRoot().toAbsolutePath().normalize();
            Files.createDirectories(root);
            Path mediaDir = root.resolve((String) medium.get("exportDir")).normalize();
            if (!mediaDir.startsWith(root) || Files.isSymbolicLink(mediaDir)) throw new PackageException("EXPORT_PATH_NOT_ALLOWED", "The medium folder is outside the export root");
            Files.createDirectories(mediaDir);
            Path setDir = Path.of(jdbc.queryForObject("select path from backup_set_location where run_id = ? and target_code = 'T1'", String.class, runId));
            Path envRoot = setDir.getParent().getParent().getParent();
            String name = "EXPORT-" + backupId + "-" + DAY.format(Instant.now());
            Path finalDir = mediaDir.resolve(name);
            if (Files.exists(finalDir, LinkOption.NOFOLLOW_LINKS)) throw new PackageException("EXPORT_PACKAGE_EXISTS", "A package named " + name + " is already on the medium");
            partial = mediaDir.resolve(name + ".partial");
            Files.createDirectories(partial);

            long estimated = ((Number) export.get("estimatedBytes")).longValue();
            long free = Files.getFileStore(mediaDir).getUsableSpace();
            if (free < (long) (estimated * 1.1)) throw new PackageException("EXPORT_INSUFFICIENT_SPACE", "The export folder has " + free + " bytes free; about " + estimated + " are needed");

            // 1. what the backup set holds
            for (String file : List.of("database/eqms.dump.gpg", "objects/index.json.gpg", "manifest.json", "manifest.sig", "SHA256SUMS")) {
                Path src = setDir.resolve(file);
                if (Files.isRegularFile(src)) copy(src, partial.resolve(file));
            }
            // 2. every document version the backup depends on
            for (BackupRepository.Blob blob : repository.blobsUpTo(runId)) {
                Path src = envRoot.resolve(blob.path());
                Path dest = partial.resolve(blob.path());
                copy(src, dest);
                if (!sha256(dest).equals(blob.cipherSha256())) throw new PackageException("EXPORT_COPY_MISMATCH", "The stored document " + blob.path() + " does not match its recorded SHA-256");
            }
            // 3. the tools and the readme that make the package usable on its own
            writeResource("export/README-RESTORE.txt", partial.resolve("README-RESTORE.txt"));
            writeResource("export/verify-chain.sh", partial.resolve("tools/verify-chain.sh"));
            writeResource("export/verify-chain.ps1", partial.resolve("tools/verify-chain.ps1"));
            Files.createDirectories(partial.resolve("public-keys"));
            Files.writeString(partial.resolve("public-keys/manifest-signing.pub"), keys.publicKeyBase64() + "\n", StandardCharsets.US_ASCII);

            // 4. the checksum list of the whole package, then the signed receipt that closes it
            List<String> sums = new ArrayList<>();
            long total = 0;
            try (Stream<Path> walk = Files.walk(partial)) {
                for (Path file : walk.filter(Files::isRegularFile).sorted().toList()) {
                    sums.add(sha256(file) + "  " + partial.relativize(file).toString().replace('\\', '/'));
                    total += Files.size(file);
                }
            }
            String sumsText = String.join("\n", sums) + "\n";
            Files.writeString(partial.resolve("PACKAGE-SHA256SUMS"), sumsText, StandardCharsets.UTF_8);
            Map<String, Object> receipt = new LinkedHashMap<>();
            receipt.put("schema", "eqms-export-receipt/1");
            receipt.put("exportId", exportId);
            receipt.put("backupId", backupId);
            receipt.put("environment", properties.getEnvironment().toUpperCase());
            receipt.put("createdAt", Instant.now().toString());
            receipt.put("manifestSha256", sha256(partial.resolve("manifest.json")));
            receipt.put("packageSumsSha256", ManifestService.sha256(sumsText));
            receipt.put("fileCount", sums.size());
            receipt.put("totalBytes", total);
            receipt.put("signingKeyId", keys.keyId());
            String receiptText = CanonicalJson.of(receipt);
            Files.writeString(partial.resolve("EXPORT-RECEIPT.json"), receiptText, StandardCharsets.UTF_8);
            Files.writeString(partial.resolve("EXPORT-RECEIPT.sig"), keys.sign(receiptText.getBytes(StandardCharsets.UTF_8)) + "\n", StandardCharsets.US_ASCII);

            // 5. read everything back from the medium: every file against the list, the manifest and the receipt against their signatures
            for (String line : sums) {
                String sha = line.substring(0, 64);
                String rel = line.substring(66);
                if (!sha256(partial.resolve(rel)).equals(sha)) throw new PackageException("EXPORT_READBACK_MISMATCH", rel + " read back differently from what was written");
            }
            String manifestText = Files.readString(partial.resolve("manifest.json"), StandardCharsets.UTF_8);
            if (!manifests.signatureValid(manifestText, Files.readString(partial.resolve("manifest.sig"), StandardCharsets.US_ASCII))) {
                throw new PackageException("EXPORT_SIGNATURE_INVALID", "The manifest signature does not verify");
            }
            Files.move(partial, finalDir, StandardCopyOption.ATOMIC_MOVE);
            partial = null;

            String receiptSha = ManifestService.sha256(receiptText);
            int fileCount = sums.size() + 3; // + PACKAGE-SHA256SUMS and the receipt pair
            long size = total;
            tx.executeWithoutResult(s -> {
                jdbc.update("update backup_export set status = 'COMPLETED', finished_at = now(), size_bytes = ?, file_count = ?, receipt_sha256 = ?, package_path = ? where export_id = ?",
                        size, fileCount, receiptSha, finalDir.toString(), exportId);
                media.markExported(mediaId, exportId, by, receiptSha);
            });
            ledger.append(by, "BACKUP_EXPORTED", backupId, Map.of("exportId", exportId, "media", medium.get("label"), "receiptSha256", receiptSha, "fileCount", fileCount));
        } catch (PackageException e) {
            return failed(exportId, backupId, medium, partial, e.code, e.getMessage());
        } catch (IOException | RuntimeException e) {
            log.error("Export {} failed", exportId, e);
            return failed(exportId, backupId, medium, partial, "EXPORT_UNEXPECTED_ERROR", e.getClass().getSimpleName() + ": " + e.getMessage());
        }
        return get(exportId);
    }

    private Map<String, Object> failed(String exportId, String backupId, Map<String, Object> medium, Path partial, String code, String detail) {
        if (partial != null && Files.exists(partial)) {
            try {
                Files.move(partial, partial.resolveSibling(partial.getFileName().toString().replace(".partial", ".invalid")), StandardCopyOption.ATOMIC_MOVE);
            } catch (IOException ignored) {
                // left as it is; a .partial folder is never listed as a package
            }
        }
        jdbc.update("update backup_export set status = 'INVALID', finished_at = now(), error_code = ?, error_detail = ? where export_id = ?", code, detail.length() > 4000 ? detail.substring(0, 4000) : detail, exportId);
        ledger.append("agent", "BACKUP_EXPORT_FAILED", backupId, Map.of("exportId", exportId, "code", code));
        repository.insertAlert("HIGH", code, "Export " + exportId + " of " + backupId + " to " + medium.get("label") + " failed: " + detail + ". Wipe the medium securely before it is used again.", exportId);
        return get(exportId);
    }

    // ------------------------------------------------------------------ helpers

    private Map<String, Object> exportableRun(String backupId) {
        Map<String, Object> run = repository.runByBackupId(backupId).orElseThrow(() -> ExportException.notFound("BACKUP_NOT_FOUND", "There is no backup " + backupId));
        if (!"COMPLETED".equals(run.get("status"))) throw ExportException.conflict("EXPORT_BACKUP_NOT_COMPLETED", "Only a completed backup can be exported");
        String latest = jdbc.queryForList("select result from backup_verification where run_id = ? order by verified_at desc limit 1", String.class, run.get("id")).stream().findFirst().orElse("NOT_VERIFIED");
        if (!"VERIFIED".equals(latest)) throw ExportException.conflict("EXPORT_BACKUP_NOT_VERIFIED", "Only a backup whose latest integrity check passed can be exported");
        return run;
    }

    private boolean sameDisk() {
        try {
            Path root = properties.getExports().getRoot();
            Files.createDirectories(root);
            Files.createDirectories(properties.getTargets().getT1());
            return Files.getFileStore(root).equals(Files.getFileStore(properties.getTargets().getT1()));
        } catch (IOException e) {
            return false;
        }
    }

    private static void requireStatus(Map<String, Object> export, String expected) {
        if (!expected.equals(export.get("status"))) throw ExportException.conflict("EXPORT_STATE", "Export " + export.get("exportId") + " is " + export.get("status") + ", not " + expected);
    }

    private static String person(String by) {
        if (by == null || by.isBlank()) throw ExportException.invalid("PERSON_REQUIRED", "Who is doing this must be known");
        return by.trim();
    }

    private static void copy(Path from, Path to) throws IOException {
        Files.createDirectories(to.getParent());
        Files.copy(from, to, StandardCopyOption.REPLACE_EXISTING);
    }

    private static void writeResource(String resource, Path to) throws IOException {
        Files.createDirectories(to.getParent());
        try (InputStream in = ExportService.class.getClassLoader().getResourceAsStream(resource)) {
            if (in == null) throw new IOException("Missing resource " + resource);
            Files.write(to, in.readAllBytes());
        }
    }

    private static String sha256(Path file) throws IOException {
        try (InputStream in = Files.newInputStream(file)) {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] buffer = new byte[1 << 16];
            int read;
            while ((read = in.read(buffer)) >= 0) digest.update(buffer, 0, read);
            return HexFormat.of().formatHex(digest.digest());
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static final class PackageException extends Exception {
        final String code;

        PackageException(String code, String message) {
            super(message);
            this.code = code;
        }
    }
}
