package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import com.eqms.service.AuditTrailService;
import com.eqms.service.ClamAvScanService;
import com.eqms.service.ElectronicSignatureService;
import com.eqms.service.FileStorageService;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Training evidence of documents imported from paper (decision D-27). Each imported revision that required training needs the scan of its paper training record,
 * or a declaration, with a reason, that there is none. The person who submits it chooses who verifies it; that person signs, is not the one who submitted, and after
 * that the evidence is read-only. The queue shows every imported revision with what is still missing, so nothing is forgotten.
 */
@Service
public class TrainingLegacyEvidenceService {
    private static final String TYPE = "TRAINING_LEGACY_EVIDENCE";
    private static final int MAX_BYTES = 20 * 1024 * 1024;

    private final JdbcTemplate jdbc;
    private final TrainingAccess access;
    private final TrainingApprovalService approvals;
    private final ElectronicSignatureService signatures;
    private final AuditTrailService audit;
    private final FileStorageService files;
    private final ClamAvScanService virusScan;

    public TrainingLegacyEvidenceService(JdbcTemplate jdbc, TrainingAccess access, TrainingApprovalService approvals, ElectronicSignatureService signatures, AuditTrailService audit,
                                         FileStorageService files, ClamAvScanService virusScan) {
        this.jdbc = jdbc;
        this.access = access;
        this.approvals = approvals;
        this.signatures = signatures;
        this.audit = audit;
        this.files = files;
        this.virusScan = virusScan;
    }

    public record SignRequest(String signatureToken) {}
    public record RejectRequest(String reason) {}

    /** Every imported revision that required training, with the state of its evidence. */
    @Transactional(readOnly = true)
    public Map<String, Object> queue(UserAccount actor, String status, String search, int page, int limit) {
        access.require(actor, "training.activity.view", "training.compliance.view", "training.activity.organize");
        List<Object> args = new ArrayList<>();
        StringBuilder where = new StringBuilder(" where r.training_origin = 'LEGACY_IMPORT' and r.requires_training");
        if (!access.allDepartments(actor)) {
            UUID own = access.departmentOf(actor);
            where.append(" and d.department_id = ?");
            args.add(own == null ? new UUID(0, 0) : own);
        }
        if (status != null && !status.isBlank()) {
            switch (status) {
                case "MISSING" -> where.append(" and le.id is null");
                case "SUBMITTED", "VERIFIED" -> { where.append(" and le.status = ?"); args.add(status); }
                default -> throw new IllegalArgumentException("TRAINING_STATUS_INVALID");
            }
        }
        if (search != null && !search.isBlank()) {
            String like = "%" + search.trim().toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
            where.append(" and (lower(d.document_number) like ? escape '\\' or lower(d.document_name) like ? escape '\\')");
            args.add(like); args.add(like);
        }
        String from = """
             from document_revisions r join documents d on d.id = r.document_id
             left join training_legacy_evidence le on le.revision_id = r.id and le.status in ('SUBMITTED','VERIFIED')
            """;
        Long total = jdbc.queryForObject("select count(*)" + from + where, Long.class, args.toArray());
        int safeLimit = Math.min(Math.max(limit, 1), 100), safePage = Math.max(page, 1);
        args.add(safeLimit); args.add((safePage - 1) * safeLimit);
        List<Map<String, Object>> rows = TrainingRows.camel(jdbc.queryForList("""
            select r.id as revision_id, d.document_number, d.document_name, r.revision_number, r.training_completion_date as completion_date, r.training_number as paper_training_number,
                   le.id as evidence_id, le.status as evidence_status, le.not_evidenced, le.not_evidenced_reason, le.original_name, le.submitted_at, le.verified_at,
                   su.full_name as submitted_by_name, vu.full_name as verified_by_name
            """ + from + """
              left join app_users su on su.id = le.submitted_by left join app_users vu on vu.id = le.verified_by
            """ + where + " order by d.document_number, r.revision_number limit ? offset ?", args.toArray()));
        for (Map<String, Object> row : rows) {
            row.put("pendingForMe", row.get("evidenceId") != null && "SUBMITTED".equals(row.get("evidenceStatus")) && jdbc.queryForObject(
                    "select count(*) from training_approval_assignments where object_type=? and object_id=? and status='PENDING' and assignee_user_id=?", Integer.class, TYPE, row.get("evidenceId"), actor.getId()) > 0);
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("data", rows);
        long count = total == null ? 0 : total;
        result.put("pagination", Map.of("page", safePage, "limit", safeLimit, "total", count, "totalPages", Math.max(1, (count + safeLimit - 1) / safeLimit)));
        result.put("canSubmit", access.has(actor, "training.activity.organize"));
        return result;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> eligibleVerifiers(UserAccount actor, UUID revisionId, String search, int page, int limit) {
        Map<String, Object> r = revision(revisionId);
        return approvals.eligibleApprovers(actor, subject(r, null), "LEGACY_EVIDENCE_VERIFY", search, page, limit, TrainingApprovalService.apart(actor.getId()));
    }

    /** Attaches the scan of the paper training record, or declares that there is none (with a reason), and designates who verifies. */
    @Transactional
    public Map<String, Object> submit(UserAccount actor, UUID revisionId, MultipartFile file, boolean notEvidenced, String reason, UUID verifierId) {
        Map<String, Object> r = revision(revisionId);
        access.require(actor, "training.activity.organize");
        access.requireScope(actor, (UUID) r.get("department_id"));
        Integer open = jdbc.queryForObject("select count(*) from training_legacy_evidence where revision_id=? and status in ('SUBMITTED','VERIFIED')", Integer.class, revisionId);
        if (open != null && open > 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_LEGACY_EVIDENCE_EXISTS");
        UUID id = UUID.randomUUID();
        if (notEvidenced) {
            if (reason == null || reason.isBlank()) throw new IllegalArgumentException("TRAINING_REASON_REQUIRED");
            jdbc.update("insert into training_legacy_evidence(id, revision_id, document_number, revision_number, document_name, completion_date, paper_training_number, not_evidenced, not_evidenced_reason, submitted_by) values (?,?,?,?,?,?,?,true,?,?)",
                    id, revisionId, r.get("document_number"), r.get("revision_number"), r.get("document_name"), r.get("training_completion_date"), r.get("training_number"), reason.trim(), actor.getId());
        } else {
            if (file == null || file.isEmpty() || file.getSize() > MAX_BYTES) throw new IllegalArgumentException("TRAINING_FILE_REJECTED");
            byte[] bytes;
            try { bytes = file.getBytes(); } catch (IOException e) { throw new IllegalArgumentException("TRAINING_FILE_REJECTED"); }
            String type = detect(bytes);
            if (type == null || !virusScan.scan(bytes).clean()) throw new IllegalArgumentException("TRAINING_FILE_REJECTED");
            String original = file.getOriginalFilename() == null ? "scan" : file.getOriginalFilename().replace('\\', '/');
            original = original.substring(original.lastIndexOf('/') + 1).replaceAll("[\\p{Cntrl}]", "");
            FileStorageService.StorageWriteResult stored;
            try {
                stored = files.storeReportArtifact("training/legacy-evidence/" + revisionId + "/" + id + ("application/pdf".equals(type) ? ".pdf" : "image/png".equals(type) ? ".png" : ".jpg"), new ByteArrayInputStream(bytes), type);
            } catch (IOException e) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "TRAINING_FILE_UNAVAILABLE");
            }
            jdbc.update("""
                insert into training_legacy_evidence(id, revision_id, document_number, revision_number, document_name, completion_date, paper_training_number, original_name, provider, stored_path, content_type, size_bytes, sha256, submitted_by)
                values (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """, id, revisionId, r.get("document_number"), r.get("revision_number"), r.get("document_name"), r.get("training_completion_date"), r.get("training_number"),
                    original.length() > 255 ? original.substring(0, 255) : original, stored.provider(), stored.storedPath(), type, bytes.length, sha256(bytes), actor.getId());
        }
        approvals.designate(actor, subject(r, id), "LEGACY_EVIDENCE_VERIFY", verifierId, TrainingApprovalService.apart(actor.getId()));
        audit.logAs(actor, TYPE, label(r), id, "TRAINING_LEGACY_EVIDENCE_SUBMITTED", null, "SUBMITTED", notEvidenced ? "Declared without evidence: " + reason.trim() : "Scan of the paper record attached");
        return queueRow(actor, revisionId);
    }

    @Transactional
    public Map<String, Object> verify(UserAccount actor, UUID evidenceId, SignRequest request) {
        Map<String, Object> e = lock(evidenceId);
        requireSubmitted(e);
        Map<String, Object> r = revision((UUID) e.get("revision_id"));
        UUID assignment = approvals.requireCanSign(actor, subject(r, evidenceId), "LEGACY_EVIDENCE_VERIFY", TrainingApprovalService.apart((UUID) e.get("submitted_by")));
        if (request == null || request.signatureToken() == null || request.signatureToken().isBlank()) throw new IllegalArgumentException("TRAINING_SIGNATURE_REQUIRED");
        UUID signature = signatures.createEntitySignature(TYPE, evidenceId, label(r), actor, request.signatureToken(), "TRAINING_LEGACY_VERIFIED",
                "Training Management: legacy training evidence verified", null, null, null).getId();
        approvals.complete(assignment, signature);
        jdbc.update("update training_legacy_evidence set status='VERIFIED', verified_by=?, verified_at=now(), signature_id=? where id=?", actor.getId(), signature, evidenceId);
        audit.logAs(actor, TYPE, label(r), evidenceId, "TRAINING_LEGACY_EVIDENCE_VERIFIED", "SUBMITTED", "VERIFIED", Boolean.TRUE.equals(e.get("not_evidenced")) ? "Verified as not evidenced" : "Scan verified");
        return queueRow(actor, (UUID) e.get("revision_id"));
    }

    @Transactional
    public Map<String, Object> reject(UserAccount actor, UUID evidenceId, RejectRequest request) {
        Map<String, Object> e = lock(evidenceId);
        requireSubmitted(e);
        Map<String, Object> r = revision((UUID) e.get("revision_id"));
        if (request == null || request.reason() == null || request.reason().isBlank()) throw new IllegalArgumentException("TRAINING_REASON_REQUIRED");
        UUID assignment = approvals.requireCanSign(actor, subject(r, evidenceId), "LEGACY_EVIDENCE_VERIFY", TrainingApprovalService.apart((UUID) e.get("submitted_by")));
        approvals.complete(assignment, null);
        jdbc.update("update training_legacy_evidence set status='REJECTED', verified_by=?, verified_at=now(), reject_reason=? where id=?", actor.getId(), request.reason().trim(), evidenceId);
        audit.logAs(actor, TYPE, label(r), evidenceId, "TRAINING_LEGACY_EVIDENCE_REJECTED", "SUBMITTED", "REJECTED", request.reason().trim());
        return queueRow(actor, (UUID) e.get("revision_id"));
    }

    @Transactional
    public Map<String, Object> download(UserAccount actor, UUID evidenceId) {
        Map<String, Object> e = jdbc.queryForList("select * from training_legacy_evidence where id=?", evidenceId).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        Map<String, Object> r = revision((UUID) e.get("revision_id"));
        access.require(actor, "training.activity.view", "training.compliance.view", "training.activity.organize");
        access.requireScope(actor, (UUID) r.get("department_id"));
        if (e.get("stored_path") == null) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_LEGACY_NO_FILE");
        try {
            byte[] bytes = files.readReportArtifact(String.valueOf(e.get("provider")), String.valueOf(e.get("stored_path")));
            if (!sha256(bytes).equals(e.get("sha256"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_FILE_INTEGRITY_FAILED");
            audit.logAs(actor, TYPE, label(r), evidenceId, "TRAINING_LEGACY_EVIDENCE_DOWNLOADED", null, null, "Downloaded");
            return Map.of("bytes", bytes, "contentType", String.valueOf(e.get("content_type")), "name", String.valueOf(e.get("original_name")));
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "TRAINING_FILE_UNAVAILABLE");
        }
    }

    // ----------------------------------------------------------------------------------------------------------------------------- helpers

    private Map<String, Object> queueRow(UserAccount actor, UUID revisionId) {
        Map<String, Object> page = queue(actor, null, null, 1, 100);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> rows = (List<Map<String, Object>>) page.get("data");
        return rows.stream().filter(x -> revisionId.equals(x.get("revisionId"))).findFirst().orElse(Map.of());
    }

    private Map<String, Object> revision(UUID revisionId) {
        Map<String, Object> r = jdbc.queryForList("""
            select r.id, r.revision_number, r.training_completion_date, r.training_number, r.training_origin, r.requires_training, d.document_number, d.document_name, d.department_id
              from document_revisions r join documents d on d.id = r.document_id where r.id=?
            """, revisionId).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        if (!"LEGACY_IMPORT".equals(r.get("training_origin")) || !Boolean.TRUE.equals(r.get("requires_training"))) throw new IllegalArgumentException("TRAINING_LEGACY_NOT_APPLICABLE");
        return r;
    }

    private Map<String, Object> lock(UUID id) {
        return jdbc.queryForList("select * from training_legacy_evidence where id=? for update", id).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
    }

    private static void requireSubmitted(Map<String, Object> e) {
        if (!"SUBMITTED".equals(e.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_LEGACY_INVALID_TRANSITION");
    }

    private TrainingApprovalService.Subject subject(Map<String, Object> r, UUID id) {
        return new TrainingApprovalService.Subject(TYPE, id, (UUID) r.get("department_id"), label(r), "training.activity.organize");
    }

    private static String label(Map<String, Object> r) {
        return "Legacy training evidence " + r.get("document_number") + " Rev " + r.get("revision_number");
    }

    private static String detect(byte[] b) {
        if (b.length > 5 && b[0] == '%' && b[1] == 'P' && b[2] == 'D' && b[3] == 'F') return "application/pdf";
        if (b.length > 8 && (b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G') return "image/png";
        if (b.length > 3 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) return "image/jpeg";
        return null;
    }

    private static String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (java.security.NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }
}
