package com.eqms.service.training;

import com.eqms.util.DateTimeFormatUtils;
import com.eqms.entity.UserAccount;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.AuditTrailService;
import com.eqms.service.ElectronicSignatureService;
import com.eqms.service.FileStorageService;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * The personal training record as a PDF (APD.0014). Preparing it needs a reason and a signature; a person designated, who is not the preparer, approves with a
 * signature; only then is the PDF written, with both signatures, the SHA-256 of the data and the list of records (voided ones marked). The file is stored in the
 * records bucket and never changed; every download is recorded in the Audit Trail.
 */
@Service
public class TrainingRecordExportService {
    private static final String TYPE = "TRAINING_RECORD_EXPORT";

    private final JdbcTemplate jdbc;
    private final TrainingAccess access;
    private final TrainingApprovalService approvals;
    private final ElectronicSignatureService signatures;
    private final AuditTrailService audit;
    private final UserAccountRepository users;
    private final FileStorageService files;
    private final TrainingFormExportService forms;
    private final TrainingFormTemplates templates;

    public TrainingRecordExportService(JdbcTemplate jdbc, TrainingAccess access, TrainingApprovalService approvals, ElectronicSignatureService signatures, AuditTrailService audit,
                                       UserAccountRepository users, FileStorageService files, TrainingFormExportService forms, TrainingFormTemplates templates) {
        this.jdbc = jdbc;
        this.access = access;
        this.approvals = approvals;
        this.signatures = signatures;
        this.audit = audit;
        this.users = users;
        this.files = files;
        this.forms = forms;
        this.templates = templates;
    }

    public record CreateRequest(UUID personUserId, String reason, UUID approverUserId, String signatureToken) {}
    public record SignRequest(String signatureToken) {}
    public record RejectRequest(String reason) {}

    private static final String SELECT = """
        select e.id, e.person_user_id, u.full_name, u.employee_code, u.avatar, e.status, e.reason, e.reject_reason, e.record_count, e.generated_at, e.sha256, e.created_at,
               pu.full_name as prepared_by_name, au.full_name as approved_by_name
          from training_record_exports e join app_users u on u.id = e.person_user_id join app_users pu on pu.id = e.prepared_by left join app_users au on au.id = e.approved_by
        """;

    @Transactional(readOnly = true)
    public Map<String, Object> list(UserAccount actor, UUID personId, String status, String sortBy, String sortDirection, int page, int limit) {
        return list(actor, personId, status, sortBy, sortDirection, page, limit, Map.of());
    }

    @Transactional(readOnly = true)
    public Map<String, Object> list(UserAccount actor, UUID personId, String status, String sortBy, String sortDirection, int page, int limit, Map<String, String> more) {
        access.require(actor, "training.record.export");
        List<Object> args = new ArrayList<>();
        StringBuilder where = new StringBuilder(" where 1=1");
        if (!access.allDepartments(actor)) {
            where.append(" and lower(trim(u.department)) = lower(trim(?))");
            args.add(actor.getDepartment() == null ? "" : actor.getDepartment());
        }
        if (personId != null) { where.append(" and e.person_user_id = ?"); args.add(personId); }
        if (status != null && !status.isBlank()) { where.append(" and e.status = ?"); args.add(status); }
        TrainingListFilter extra = new TrainingListFilter().contains(more.get("search"), "u.full_name", "u.employee_code", "e.reason", "pu.full_name", "au.full_name").contains(more.get("preparedBy"), "pu.full_name").contains(more.get("approvedBy"), "au.full_name")
                .timeRange("e.generated_at", more.get("generatedFrom"), more.get("generatedTo")).timeRange("e.created_at", more.get("requestedFrom"), more.get("requestedTo"));
        if (more.get("department") != null && !more.get("department").isBlank()) extra.raw("lower(trim(u.department)) = lower(trim(?))", more.get("department"));
        where.append(extra.and());
        args.addAll(extra.args());
        Long total = jdbc.queryForObject("select count(*) from training_record_exports e join app_users u on u.id = e.person_user_id left join app_users pu on pu.id = e.prepared_by left join app_users au on au.id = e.approved_by" + where, Long.class, args.toArray());
        int safeLimit = Math.min(Math.max(limit, 1), 100), safePage = Math.max(page, 1);
        args.add(safeLimit); args.add((safePage - 1) * safeLimit);
        List<Map<String, Object>> rows = TrainingRows.camel(jdbc.queryForList(SELECT + where + TrainingRows.orderBy(sortBy, sortDirection, Map.of("employee", "u.full_name", "employeeCode", "u.employee_code", "status", "e.status", "reason", "e.reason", "preparedBy", "pu.full_name", "approvedBy", "au.full_name", "records", "e.record_count", "generated", "e.generated_at", "createdAt", "e.created_at"),
                "e.created_at desc") + " limit ? offset ?", args.toArray()));
        for (Map<String, Object> row : rows) {
            boolean assigned = jdbc.queryForObject("select count(*) from training_approval_assignments where object_type=? and object_id=? and status='PENDING' and assignee_user_id=?",
                    Integer.class, TYPE, row.get("id"), actor.getId()) > 0;
            row.put("canApprove", "PENDING_APPROVAL".equals(row.get("status")) && assigned);
            row.put("canDownload", "APPROVED".equals(row.get("status")));
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("data", rows);
        long count = total == null ? 0 : total;
        result.put("pagination", Map.of("page", safePage, "limit", safeLimit, "total", count, "totalPages", Math.max(1, (count + safeLimit - 1) / safeLimit)));
        return result;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> eligibleApprovers(UserAccount actor, UUID personId, String search, int page, int limit) {
        access.require(actor, "training.record.export");
        return approvals.eligibleApprovers(actor, subject(null, personId), "RECORD_EXPORT_APPROVE", search, page, limit, TrainingApprovalService.apart(actor.getId()));
    }

    @Transactional
    public Map<String, Object> create(UserAccount actor, CreateRequest request) {
        access.require(actor, "training.record.export");
        if (request == null || request.personUserId() == null) throw new IllegalArgumentException("TRAINING_PARTICIPANT_NOT_ELIGIBLE");
        UserAccount person = users.findById(request.personUserId()).orElseThrow(() -> new IllegalArgumentException("TRAINING_PARTICIPANT_NOT_ELIGIBLE"));
        UUID department = access.departmentOf(person);
        if (!access.allDepartments(actor) && (department == null || !access.inScope(actor, department))) throw new SecurityException(TrainingAccess.DENIED);
        if (request.reason() == null || request.reason().isBlank()) throw new IllegalArgumentException("TRAINING_REASON_REQUIRED");
        if (request.signatureToken() == null || request.signatureToken().isBlank()) throw new IllegalArgumentException("TRAINING_SIGNATURE_REQUIRED");
        UUID id = UUID.randomUUID();
        UUID prepared = signatures.createEntitySignature(TYPE, id, label(person), actor, request.signatureToken(), "TRAINING_RECORD_PREPARED",
                request.reason().trim(), null, null, null).getId();
        jdbc.update("insert into training_record_exports(id, person_user_id, reason, prepared_by, prepared_signature_id) values (?,?,?,?,?)", id, person.getId(), request.reason().trim(), actor.getId(), prepared);
        approvals.designate(actor, subject(id, person.getId()), "RECORD_EXPORT_APPROVE", request.approverUserId(), TrainingApprovalService.apart(actor.getId()));
        audit.logAs(actor, TYPE, label(person), id, "TRAINING_RECORD_EXPORT_PREPARED", null, "PENDING_APPROVAL", request.reason().trim());
        return TrainingRows.camel(jdbc.queryForList(SELECT + " where e.id=?", id).getFirst());
    }

    /** The approver signs; the PDF is written now, from the records as they are at this moment, and never again. */
    @Transactional
    public Map<String, Object> approve(UserAccount actor, UUID id, SignRequest request) {
        Map<String, Object> e = lock(id);
        if (!"PENDING_APPROVAL".equals(e.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_EXPORT_INVALID_TRANSITION");
        UUID person = (UUID) e.get("person_user_id");
        UserAccount owner = users.findById(person).orElseThrow();
        UUID assignment = approvals.requireCanSign(actor, subject(id, person), "RECORD_EXPORT_APPROVE", TrainingApprovalService.apart((UUID) e.get("prepared_by")));
        if (request == null || request.signatureToken() == null || request.signatureToken().isBlank()) throw new IllegalArgumentException("TRAINING_SIGNATURE_REQUIRED");
        UUID signature = signatures.createEntitySignature(TYPE, id, label(owner), actor, request.signatureToken(), "TRAINING_RECORD_APPROVED",
                "Training Management: record export approved", null, null, null).getId();
        approvals.complete(assignment, signature);
        List<Map<String, Object>> records = jdbc.queryForList("""
            select r.record_no, r.training_number, r.topic_text, r.document_number, r.document_revision, r.completed_on, r.result, r.content_sha256, v.voided_at, v.reason as void_reason
              from training_records r left join training_record_voids v on v.record_id = r.id where r.person_user_id = ? order by r.completed_on, r.record_no
            """, person);
        UserAccount preparer = users.findById((UUID) e.get("prepared_by")).orElseThrow();
        OffsetDateTime now = OffsetDateTime.now();
        // the record is written in the form APD.0014 (the Word template that Training Administration enabled) and kept as the PDF made from it
        byte[] pdf = templates.pdf(forms.personalRecord(owner, qualification(owner), records, (UUID) e.get("prepared_signature_id"), e.get("created_at"), signature, now));
        FileStorageService.StorageWriteResult stored;
        try {
            stored = files.storeReportArtifact("training/record-exports/" + person + "/" + id + ".pdf", new ByteArrayInputStream(pdf), "application/pdf");
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "TRAINING_FILE_UNAVAILABLE");
        }
        jdbc.update("update training_record_exports set status='APPROVED', approved_by=?, approved_signature_id=?, provider=?, stored_path=?, sha256=?, size_bytes=?, record_count=?, generated_at=now(), updated_at=now() where id=?",
                actor.getId(), signature, stored.provider(), stored.storedPath(), sha256(pdf), pdf.length, records.size(), id);
        audit.logAs(actor, TYPE, label(owner), id, "TRAINING_RECORD_EXPORT_APPROVED", "PENDING_APPROVAL", "APPROVED", records.size() + " records, SHA-256 " + sha256(pdf));
        return TrainingRows.camel(jdbc.queryForList(SELECT + " where e.id=?", id).getFirst());
    }

    @Transactional
    public Map<String, Object> reject(UserAccount actor, UUID id, RejectRequest request) {
        Map<String, Object> e = lock(id);
        if (!"PENDING_APPROVAL".equals(e.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_EXPORT_INVALID_TRANSITION");
        if (request == null || request.reason() == null || request.reason().isBlank()) throw new IllegalArgumentException("TRAINING_REASON_REQUIRED");
        UUID assignment = approvals.requireCanSign(actor, subject(id, (UUID) e.get("person_user_id")), "RECORD_EXPORT_APPROVE", TrainingApprovalService.apart((UUID) e.get("prepared_by")));
        approvals.complete(assignment, null);
        jdbc.update("update training_record_exports set status='REJECTED', reject_reason=?, approved_by=?, updated_at=now() where id=?", request.reason().trim(), actor.getId(), id);
        audit.logAs(actor, TYPE, "Record export", id, "TRAINING_RECORD_EXPORT_REJECTED", "PENDING_APPROVAL", "REJECTED", request.reason().trim());
        return TrainingRows.camel(jdbc.queryForList(SELECT + " where e.id=?", id).getFirst());
    }

    @Transactional
    public Map<String, Object> download(UserAccount actor, UUID id) {
        access.require(actor, "training.record.export");
        Map<String, Object> e = jdbc.queryForList("select * from training_record_exports where id=?", id).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        UserAccount person = users.findById((UUID) e.get("person_user_id")).orElseThrow();
        UUID department = access.departmentOf(person);
        if (!access.allDepartments(actor) && (department == null || !access.inScope(actor, department))) throw new SecurityException(TrainingAccess.DENIED);
        if (!"APPROVED".equals(e.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_EXPORT_INVALID_TRANSITION");
        try {
            byte[] bytes = files.readReportArtifact(String.valueOf(e.get("provider")), String.valueOf(e.get("stored_path")));
            if (!sha256(bytes).equals(e.get("sha256"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_EXPORT_INTEGRITY_FAILED");
            audit.logAs(actor, TYPE, label(person), id, "TRAINING_RECORD_EXPORT_DOWNLOADED", null, null, "Downloaded");
            return Map.of("bytes", bytes, "name", "training-record-" + (person.getEmployeeCode() == null ? person.getUsername() : person.getEmployeeCode()) + ".pdf");
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "TRAINING_FILE_UNAVAILABLE");
        }
    }

    /** The APD.0014 file (Word) of one person with the records completed up to the cut-off date. Used by the batch export; nothing is stored here. */
    public byte[] renderPersonal(UserAccount person, UUID preparedSignature, UUID approvedSignature, OffsetDateTime at, java.time.LocalDate cutOff) {
        List<Map<String, Object>> records = jdbc.queryForList("""
            select r.record_no, r.training_number, r.topic_text, r.document_number, r.document_revision, r.completed_on, r.result, r.content_sha256, v.voided_at, v.reason as void_reason
              from training_records r left join training_record_voids v on v.record_id = r.id where r.person_user_id = ? and r.completed_on <= ? order by r.completed_on, r.record_no
            """, person.getId(), java.sql.Date.valueOf(cutOff));
        return forms.personalRecord(person, qualification(person), records, preparedSignature, at, approvedSignature, at);
    }

    /** The highest qualification the person has on record (APD.0014 v2.0.0): the latest degree with its field of study and institution. */
    private String qualification(UserAccount person) {
        return jdbc.queryForList("select degree, field_of_study, institution from user_educations where user_id = ? order by graduation_year desc nulls last, created_at desc limit 1", person.getId()).stream().findFirst()
                .map(r -> nvl((String) r.get("degree")) + (r.get("field_of_study") == null ? "" : ", " + r.get("field_of_study")) + (r.get("institution") == null ? "" : " (" + r.get("institution") + ")")).orElse("");
    }

    private static String nvl(String v) { return v == null ? "" : v; }

    // ----------------------------------------------------------------------------------------------------------------------------- helpers

    private Map<String, Object> lock(UUID id) {
        return jdbc.queryForList("select * from training_record_exports where id=? for update", id).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
    }

    private TrainingApprovalService.Subject subject(UUID id, UUID personId) {
        UserAccount person = users.findById(personId).orElseThrow(() -> new IllegalArgumentException("TRAINING_PARTICIPANT_NOT_ELIGIBLE"));
        return new TrainingApprovalService.Subject(TYPE, id, access.departmentOf(person), label(person), "training.record.export");
    }

    private static String label(UserAccount person) { return "Training record of " + person.getFullName(); }

    private static String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (java.security.NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }
}
