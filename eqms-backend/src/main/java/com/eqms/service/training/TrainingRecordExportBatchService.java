package com.eqms.service.training;

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
import java.security.MessageDigest;
import java.sql.Date;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * The yearly print of the personal training records of a department (SOP.0003 5.3.10, TR-44, proposal D-48). One batch is prepared with a signature by one person and
 * approved with a signature by a different person designated; only then is a ZIP written, with one APD.0014 PDF for every person of the department who has records up to the
 * end of the year chosen. The batch is as large as one request can carry (at most 150 people), so it is made in the approval itself and not in the background.
 */
@Service
public class TrainingRecordExportBatchService {
    public static final String TYPE = "TRAINING_RECORD_EXPORT_BATCH";
    private static final String STEP = "RECORD_EXPORT_APPROVE";
    static final int MAX_PEOPLE = 150;

    public record CreateRequest(UUID departmentId, Integer year, String reason, UUID approverUserId, String signatureToken) {}
    public record SignRequest(String signatureToken) {}
    public record RejectRequest(String reason) {}

    private final JdbcTemplate jdbc;
    private final TrainingAccess access;
    private final TrainingApprovalService approvals;
    private final ElectronicSignatureService signatures;
    private final AuditTrailService audit;
    private final UserAccountRepository users;
    private final FileStorageService files;
    private final TrainingRecordExportService exports;

    public TrainingRecordExportBatchService(JdbcTemplate jdbc, TrainingAccess access, TrainingApprovalService approvals, ElectronicSignatureService signatures, AuditTrailService audit,
                                            UserAccountRepository users, FileStorageService files, TrainingRecordExportService exports) {
        this.jdbc = jdbc;
        this.access = access;
        this.approvals = approvals;
        this.signatures = signatures;
        this.audit = audit;
        this.users = users;
        this.files = files;
        this.exports = exports;
    }

    private static final String SELECT = """
        select b.id, b.department_id, d.name as department_name, b.year, b.status, b.reason, b.reject_reason, b.person_count, b.generated_at, b.sha256, b.size_bytes, b.created_at,
               pu.full_name as prepared_by_name, au.full_name as approved_by_name
          from training_record_export_batches b join departments d on d.id = b.department_id join app_users pu on pu.id = b.prepared_by left join app_users au on au.id = b.approved_by
        """;

    private TrainingApprovalService.Subject subject(UUID id, UUID departmentId, String departmentName, int year) {
        return new TrainingApprovalService.Subject(TYPE, id, departmentId, "Batch export of training records, " + departmentName + " " + year, "training.record.export");
    }

    private String departmentName(UUID departmentId) {
        return jdbc.queryForList("select name from departments where id = ?", String.class, departmentId).stream().findFirst().orElseThrow(() -> new IllegalArgumentException("TRAINING_DEPARTMENT_REQUIRED"));
    }

    /** The people of the department with at least one record up to the end of the year (voided records stay in the record, so they count). */
    private List<UserAccount> people(String departmentName, int year) {
        List<UUID> ids = jdbc.queryForList("""
            select u.id from app_users u where lower(trim(u.department)) = lower(trim(?)) and exists
              (select 1 from training_records r where r.person_user_id = u.id and r.completed_on <= ?) order by u.full_name limit ?
            """, UUID.class, departmentName, Date.valueOf(LocalDate.of(year, 12, 31)), MAX_PEOPLE + 1);
        List<UserAccount> out = new ArrayList<>();
        for (UUID id : ids) users.findById(id).ifPresent(out::add);
        return out;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> list(UserAccount actor, String status, String sortBy, String sortDirection, int page, int limit) {
        return list(actor, status, sortBy, sortDirection, page, limit, Map.of());
    }

    @Transactional(readOnly = true)
    public Map<String, Object> list(UserAccount actor, String status, String sortBy, String sortDirection, int page, int limit, Map<String, String> more) {
        access.require(actor, "training.record.export");
        List<Object> args = new ArrayList<>();
        StringBuilder where = new StringBuilder(" where 1=1");
        if (!access.allDepartments(actor)) {
            UUID own = access.departmentOf(actor);
            where.append(" and b.department_id = ?");
            args.add(own == null ? new UUID(0, 0) : own);
        }
        if (status != null && !status.isBlank()) { where.append(" and b.status = ?"); args.add(status); }
        Integer yearFilter = null;
        try {
            yearFilter = more.get("year") == null || more.get("year").isBlank() ? null : Integer.valueOf(more.get("year").trim());
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("TRAINING_FILTER_INVALID");
        }
        TrainingListFilter extra = new TrainingListFilter().equal("b.year", yearFilter).contains(more.get("search"), "b.reason", "d.name").contains(more.get("preparedBy"), "pu.full_name").contains(more.get("approvedBy"), "au.full_name")
                .timeRange("b.generated_at", more.get("generatedFrom"), more.get("generatedTo")).timeRange("b.created_at", more.get("requestedFrom"), more.get("requestedTo"));
        if (more.get("departmentId") != null && !more.get("departmentId").isBlank()) {
            try {
                extra.raw("b.department_id = ?", UUID.fromString(more.get("departmentId").trim()));
            } catch (IllegalArgumentException e) {
                throw new IllegalArgumentException("TRAINING_FILTER_INVALID");
            }
        }
        where.append(extra.and());
        args.addAll(extra.args());
        Long total = jdbc.queryForObject("select count(*) from training_record_export_batches b join departments d on d.id = b.department_id left join app_users pu on pu.id = b.prepared_by left join app_users au on au.id = b.approved_by" + where, Long.class, args.toArray());
        int safeLimit = Math.min(Math.max(limit, 1), 100), safePage = Math.max(page, 1);
        args.add(safeLimit); args.add((safePage - 1) * safeLimit);
        List<Map<String, Object>> rows = TrainingRows.camel(jdbc.queryForList(SELECT + where + TrainingRows.orderBy(sortBy, sortDirection, Map.of("department", "d.name", "year", "b.year", "status", "b.status", "people", "b.person_count", "reason", "b.reason", "preparedBy", "pu.full_name", "approvedBy", "au.full_name", "generated", "b.generated_at", "createdAt", "b.created_at"),
                "b.created_at desc") + " limit ? offset ?", args.toArray()));
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
    public Map<String, Object> eligibleApprovers(UserAccount actor, UUID departmentId, String search, int page, int limit) {
        access.require(actor, "training.record.export");
        access.requireScope(actor, departmentId);
        return approvals.eligibleApprovers(actor, subject(null, departmentId, departmentName(departmentId), 0), STEP, search, page, limit, TrainingApprovalService.apart(actor.getId()));
    }

    /** How many people a batch would hold: shown to the person before preparing it. */
    @Transactional(readOnly = true)
    public Map<String, Object> preview(UserAccount actor, UUID departmentId, int year) {
        access.require(actor, "training.record.export");
        access.requireScope(actor, departmentId);
        if (year < 2000 || year > 2100) throw new IllegalArgumentException("TRAINING_YEAR_INVALID");
        int n = people(departmentName(departmentId), year).size();
        return Map.of("people", Math.min(n, MAX_PEOPLE), "tooMany", n > MAX_PEOPLE, "limit", MAX_PEOPLE);
    }

    @Transactional
    public Map<String, Object> create(UserAccount actor, CreateRequest request) {
        access.require(actor, "training.record.export");
        if (request == null || request.departmentId() == null) throw new IllegalArgumentException("TRAINING_DEPARTMENT_REQUIRED");
        access.requireScope(actor, request.departmentId());
        int year = request.year() == null ? 0 : request.year();
        if (year < 2000 || year > 2100) throw new IllegalArgumentException("TRAINING_YEAR_INVALID");
        if (request.reason() == null || request.reason().isBlank()) throw new IllegalArgumentException("TRAINING_REASON_REQUIRED");
        if (request.signatureToken() == null || request.signatureToken().isBlank()) throw new IllegalArgumentException("TRAINING_SIGNATURE_REQUIRED");
        String department = departmentName(request.departmentId());
        int count = people(department, year).size();
        if (count == 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_EXPORT_BATCH_EMPTY");
        if (count > MAX_PEOPLE) throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "TRAINING_EXPORT_BATCH_TOO_LARGE");
        UUID id = UUID.randomUUID();
        TrainingApprovalService.Subject subject = subject(id, request.departmentId(), department, year);
        UUID prepared = signatures.createEntitySignature(TYPE, id, subject.label(), actor, request.signatureToken(), "TRAINING_RECORD_PREPARED", request.reason().trim(), null, null, null).getId();
        jdbc.update("insert into training_record_export_batches(id, department_id, year, reason, person_count, prepared_by, prepared_signature_id) values (?,?,?,?,?,?,?)",
                id, request.departmentId(), year, request.reason().trim(), count, actor.getId(), prepared);
        approvals.designate(actor, subject, STEP, request.approverUserId(), TrainingApprovalService.apart(actor.getId()));
        audit.logAs(actor, TYPE, subject.label(), id, "TRAINING_RECORD_EXPORT_BATCH_PREPARED", null, "PENDING_APPROVAL", count + " people. " + request.reason().trim());
        return TrainingRows.camel(jdbc.queryForList(SELECT + " where b.id = ?", id).getFirst());
    }

    /** The approver signs; the PDFs are made now, from the records as they are at this moment, put in one ZIP and never made again. */
    @Transactional
    public Map<String, Object> approve(UserAccount actor, UUID id, SignRequest request) {
        Map<String, Object> b = lock(id);
        if (!"PENDING_APPROVAL".equals(b.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_EXPORT_INVALID_TRANSITION");
        UUID departmentId = (UUID) b.get("department_id");
        int year = ((Number) b.get("year")).intValue();
        String department = departmentName(departmentId);
        TrainingApprovalService.Subject subject = subject(id, departmentId, department, year);
        UUID assignment = approvals.requireCanSign(actor, subject, STEP, TrainingApprovalService.apart((UUID) b.get("prepared_by")));
        if (request == null || request.signatureToken() == null || request.signatureToken().isBlank()) throw new IllegalArgumentException("TRAINING_SIGNATURE_REQUIRED");
        UserAccount preparer = users.findById((UUID) b.get("prepared_by")).orElseThrow();
        List<UserAccount> people = people(department, year);
        if (people.isEmpty() || people.size() > MAX_PEOPLE) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_EXPORT_BATCH_CHANGED");
        UUID signature = signatures.createEntitySignature(TYPE, id, subject.label(), actor, request.signatureToken(), "TRAINING_RECORD_APPROVED", "Training Management: batch export approved", null, null, null).getId();
        approvals.complete(assignment, signature);
        OffsetDateTime now = OffsetDateTime.now();
        byte[] zip;
        try (ByteArrayOutputStream out = new ByteArrayOutputStream(); ZipOutputStream z = new ZipOutputStream(out)) {
            int n = 0;
            for (UserAccount person : people) {
                byte[] pdf = exports.renderPersonal(person, preparer, actor, now, String.valueOf(b.get("reason")), id, LocalDate.of(year, 12, 31));
                String name = String.format("%03d-%s.pdf", ++n, safe(person.getEmployeeCode() == null ? person.getUsername() : person.getEmployeeCode()));
                z.putNextEntry(new ZipEntry(name));
                z.write(pdf);
                z.closeEntry();
            }
            z.finish();
            zip = out.toByteArray();
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "TRAINING_EXPORT_FAILED");
        }
        FileStorageService.StorageWriteResult stored;
        try {
            stored = files.storeReportArtifact("training/record-export-batches/" + departmentId + "/" + id + ".zip", new ByteArrayInputStream(zip), "application/zip");
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "TRAINING_FILE_UNAVAILABLE");
        }
        jdbc.update("update training_record_export_batches set status='APPROVED', approved_by=?, approved_signature_id=?, provider=?, stored_path=?, sha256=?, size_bytes=?, person_count=?, generated_at=now(), updated_at=now() where id=?",
                actor.getId(), signature, stored.provider(), stored.storedPath(), sha256(zip), zip.length, people.size(), id);
        audit.logAs(actor, TYPE, subject.label(), id, "TRAINING_RECORD_EXPORT_BATCH_APPROVED", "PENDING_APPROVAL", "APPROVED", people.size() + " people, SHA-256 " + sha256(zip));
        return TrainingRows.camel(jdbc.queryForList(SELECT + " where b.id = ?", id).getFirst());
    }

    @Transactional
    public Map<String, Object> reject(UserAccount actor, UUID id, RejectRequest request) {
        Map<String, Object> b = lock(id);
        if (!"PENDING_APPROVAL".equals(b.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_EXPORT_INVALID_TRANSITION");
        if (request == null || request.reason() == null || request.reason().isBlank()) throw new IllegalArgumentException("TRAINING_REASON_REQUIRED");
        UUID departmentId = (UUID) b.get("department_id");
        TrainingApprovalService.Subject subject = subject(id, departmentId, departmentName(departmentId), ((Number) b.get("year")).intValue());
        UUID assignment = approvals.requireCanSign(actor, subject, STEP, TrainingApprovalService.apart((UUID) b.get("prepared_by")));
        approvals.complete(assignment, null);
        jdbc.update("update training_record_export_batches set status='REJECTED', reject_reason=?, approved_by=?, updated_at=now() where id=?", request.reason().trim(), actor.getId(), id);
        audit.logAs(actor, TYPE, subject.label(), id, "TRAINING_RECORD_EXPORT_BATCH_REJECTED", "PENDING_APPROVAL", "REJECTED", request.reason().trim());
        return TrainingRows.camel(jdbc.queryForList(SELECT + " where b.id = ?", id).getFirst());
    }

    @Transactional
    public Map<String, Object> download(UserAccount actor, UUID id) {
        access.require(actor, "training.record.export");
        Map<String, Object> b = jdbc.queryForList("select * from training_record_export_batches where id = ?", id).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        access.requireScope(actor, (UUID) b.get("department_id"));
        if (!"APPROVED".equals(b.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_EXPORT_INVALID_TRANSITION");
        try {
            byte[] bytes = files.readReportArtifact(String.valueOf(b.get("provider")), String.valueOf(b.get("stored_path")));
            if (!sha256(bytes).equals(b.get("sha256"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_EXPORT_INTEGRITY_FAILED");
            String department = departmentName((UUID) b.get("department_id"));
            audit.logAs(actor, TYPE, "Batch export of training records, " + department + " " + b.get("year"), id, "TRAINING_RECORD_EXPORT_BATCH_DOWNLOADED", null, null, "Downloaded");
            return Map.of("bytes", bytes, "name", "training-records-" + safe(department) + "-" + b.get("year") + ".zip");
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "TRAINING_FILE_UNAVAILABLE");
        }
    }

    private Map<String, Object> lock(UUID id) {
        return jdbc.queryForList("select * from training_record_export_batches where id = ? for update", id).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
    }

    private static String safe(String value) { return value == null ? "x" : value.replaceAll("[^A-Za-z0-9._-]+", "-"); }

    private static String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (java.security.NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }
}
