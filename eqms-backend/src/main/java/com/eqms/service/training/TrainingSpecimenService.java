package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.UserAccountRepository;
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

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Specimen signatures (SOP.0003 section 5.3.9): the image of the signature of a person, kept for comparison with signed records. The person (or someone who
 * manages them) uploads it and chooses who confirms it; the file is checked (a real PNG or JPEG of a bounded size), scanned for malware and stored in the records
 * bucket, which never deletes. The person chosen confirms with a signature and cannot be the person themselves or the uploader. Only one image is approved for
 * a person; a newer approved one replaces it and the older one stays on record. The image is never part of a list; opening it is recorded in the Audit Trail.
 */
@Service
public class TrainingSpecimenService {
    private static final String TYPE = "TRAINING_SPECIMEN_SIGNATURE";
    private static final int MAX_BYTES = 512 * 1024;
    private static final int MAX_WIDTH = 2000, MAX_HEIGHT = 1000;

    private final JdbcTemplate jdbc;
    private final TrainingAccess access;
    private final TrainingApprovalService approvals;
    private final ElectronicSignatureService signatures;
    private final AuditTrailService audit;
    private final UserAccountRepository users;
    private final FileStorageService files;
    private final ClamAvScanService virusScan;

    public TrainingSpecimenService(JdbcTemplate jdbc, TrainingAccess access, TrainingApprovalService approvals, ElectronicSignatureService signatures, AuditTrailService audit,
                                   UserAccountRepository users, FileStorageService files, ClamAvScanService virusScan) {
        this.jdbc = jdbc;
        this.access = access;
        this.approvals = approvals;
        this.signatures = signatures;
        this.audit = audit;
        this.users = users;
        this.files = files;
        this.virusScan = virusScan;
    }

    public record SignRequest(String signatureToken) {}
    public record RejectRequest(String reason) {}

    private static final String SELECT = """
        select s.id, s.person_user_id, u.full_name, u.employee_code, u.department, s.version_no, s.status, s.effective_date, s.content_type, s.size_bytes, s.sha256,
               s.change_reason, s.reject_reason, s.created_at, uu.full_name as uploaded_by_name, cu.full_name as confirmed_by_name
          from training_specimen_signatures s join app_users u on u.id = s.person_user_id join app_users uu on uu.id = s.uploaded_by left join app_users cu on cu.id = s.confirmed_by
        """;

    // ----------------------------------------------------------------------------------------------------------------------------- reading

    @Transactional(readOnly = true)
    public Map<String, Object> list(UserAccount actor, String search, String status, int page, int limit) {
        boolean wide = access.has(actor, "training.signature.view", "training.signature.manage", "training.signature.confirm");
        if (!wide) access.require(actor, "training.self.view");
        List<Object> args = new ArrayList<>();
        StringBuilder where = new StringBuilder(" where 1=1");
        if (!wide) {
            where.append(" and s.person_user_id = ?");
            args.add(actor.getId());
        } else if (!access.allDepartments(actor)) {
            where.append(" and (lower(trim(u.department)) = lower(trim(?)) or s.person_user_id = ?)");
            args.add(actor.getDepartment() == null ? "" : actor.getDepartment());
            args.add(actor.getId());
        }
        if (status != null && !status.isBlank()) { where.append(" and s.status = ?"); args.add(status); }
        if (search != null && !search.isBlank()) {
            String like = "%" + search.trim().toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
            where.append(" and (lower(u.full_name) like ? escape '\\' or lower(coalesce(u.employee_code,'')) like ? escape '\\')");
            args.add(like); args.add(like);
        }
        Long total = jdbc.queryForObject("select count(*) from training_specimen_signatures s join app_users u on u.id = s.person_user_id" + where, Long.class, args.toArray());
        int safeLimit = Math.min(Math.max(limit, 1), 100), safePage = Math.max(page, 1);
        args.add(safeLimit); args.add((safePage - 1) * safeLimit);
        List<Map<String, Object>> rows = TrainingRows.camel(jdbc.queryForList(SELECT + where + " order by s.created_at desc limit ? offset ?", args.toArray()));
        for (Map<String, Object> row : rows) row.put("capabilities", capabilities(actor, (UUID) row.get("id"), (UUID) row.get("personUserId"), String.valueOf(row.get("status"))));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("data", rows);
        long count = total == null ? 0 : total;
        result.put("pagination", Map.of("page", safePage, "limit", safeLimit, "total", count, "totalPages", Math.max(1, (count + safeLimit - 1) / safeLimit)));
        return result;
    }

    private Map<String, Object> capabilities(UserAccount actor, UUID id, UUID personId, String status) {
        boolean assigned = jdbc.queryForObject("select count(*) from training_approval_assignments where object_type=? and object_id=? and status='PENDING' and assignee_user_id=?",
                Integer.class, TYPE, id, actor.getId()) > 0;
        Map<String, Object> caps = new LinkedHashMap<>();
        caps.put("viewImage", actor.getId().equals(personId) || access.has(actor, "training.signature.view", "training.signature.manage", "training.signature.confirm"));
        caps.put("confirm", "PENDING".equals(status) && assigned && access.has(actor, "training.signature.confirm"));
        caps.put("reject", caps.get("confirm"));
        return caps;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> eligibleConfirmers(UserAccount actor, UUID personId, String search, int page, int limit) {
        UUID person = personId == null ? actor.getId() : personId;
        return approvals.eligibleApprovers(actor, subjectFor(person, null), "SPECIMEN_CONFIRM", search, page, limit, TrainingApprovalService.apart(person, actor.getId()));
    }

    /** The image: bytes and type. The person, or someone who may see specimen signatures of the department. Opening it is recorded in the Audit Trail. */
    @Transactional
    public Map<String, Object> image(UserAccount actor, UUID id) {
        Map<String, Object> s = row(id);
        UUID person = (UUID) s.get("person_user_id");
        if (!actor.getId().equals(person)) {
            access.require(actor, "training.signature.view", "training.signature.manage", "training.signature.confirm");
            UUID department = access.departmentOf(users.findById(person).orElseThrow());
            if (!(access.allDepartments(actor) || (department != null && access.inScope(actor, department)))) throw new SecurityException(TrainingAccess.DENIED);
        }
        try {
            byte[] bytes = files.readReportArtifact(String.valueOf(s.get("provider")), String.valueOf(s.get("stored_path")));
            audit.logAs(actor, TYPE, "Specimen signature #" + s.get("version_no"), id, "TRAINING_SPECIMEN_VIEWED", null, null, "Image opened");
            return Map.of("bytes", bytes, "contentType", String.valueOf(s.get("content_type")));
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "TRAINING_FILE_UNAVAILABLE");
        }
    }

    // ----------------------------------------------------------------------------------------------------------------------------- writing

    /** A new specimen image for a person, waiting for the confirmation of the person chosen. */
    @Transactional
    public Map<String, Object> upload(UserAccount actor, UUID personId, MultipartFile file, UUID confirmerId, String reason) {
        UUID person = personId == null ? actor.getId() : personId;
        boolean self = actor.getId().equals(person);
        if (self) access.require(actor, "training.self.view", "training.signature.manage");
        else {
            access.require(actor, "training.signature.manage");
            UUID department = access.departmentOf(users.findById(person).orElseThrow(() -> new IllegalArgumentException("TRAINING_PARTICIPANT_NOT_ELIGIBLE")));
            if (!access.allDepartments(actor) && (department == null || !access.inScope(actor, department))) throw new SecurityException(TrainingAccess.DENIED);
        }
        UserAccount owner = users.findById(person).orElseThrow(() -> new IllegalArgumentException("TRAINING_PARTICIPANT_NOT_ELIGIBLE"));
        if (owner.getStatus() != UserStatus.Active) throw new IllegalArgumentException("TRAINING_PARTICIPANT_NOT_ELIGIBLE");
        if (file == null || file.isEmpty() || file.getSize() > MAX_BYTES) throw new IllegalArgumentException("TRAINING_FILE_REJECTED");
        byte[] bytes;
        try { bytes = file.getBytes(); } catch (IOException e) { throw new IllegalArgumentException("TRAINING_FILE_REJECTED"); }
        String type = detectType(bytes);
        if (type == null) throw new IllegalArgumentException("TRAINING_FILE_REJECTED");
        try {
            BufferedImage image = ImageIO.read(new ByteArrayInputStream(bytes));
            if (image == null || image.getWidth() > MAX_WIDTH || image.getHeight() > MAX_HEIGHT || image.getWidth() < 40 || image.getHeight() < 20) throw new IllegalArgumentException("TRAINING_FILE_REJECTED");
        } catch (IOException e) {
            throw new IllegalArgumentException("TRAINING_FILE_REJECTED");
        }
        ClamAvScanService.ScanResult scan = virusScan.scan(bytes);
        if (!scan.clean()) throw new IllegalArgumentException("TRAINING_FILE_REJECTED");
        Integer pending = jdbc.queryForObject("select count(*) from training_specimen_signatures where person_user_id=? and status='PENDING'", Integer.class, person);
        if (pending != null && pending > 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_SPECIMEN_PENDING_EXISTS");
        Integer approved = jdbc.queryForObject("select count(*) from training_specimen_signatures where person_user_id=? and status='APPROVED'", Integer.class, person);
        if (approved != null && approved > 0 && (reason == null || reason.isBlank())) throw new IllegalArgumentException("TRAINING_REASON_REQUIRED");
        int versionNo = ((Number) jdbc.queryForObject("select coalesce(max(version_no),0)+1 from training_specimen_signatures where person_user_id=?", Number.class, person)).intValue();
        UUID id = UUID.randomUUID();
        FileStorageService.StorageWriteResult stored;
        try {
            stored = files.storeReportArtifact("training/specimen-signatures/" + person + "/" + id + ("image/png".equals(type) ? ".png" : ".jpg"), new ByteArrayInputStream(bytes), type);
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "TRAINING_FILE_UNAVAILABLE");
        }
        jdbc.update("""
            insert into training_specimen_signatures(id, person_user_id, version_no, provider, stored_path, object_key, content_type, size_bytes, sha256, uploaded_by, change_reason)
            values (?,?,?,?,?,?,?,?,?,?,?)
            """, id, person, versionNo, stored.provider(), stored.storedPath(), stored.objectKey(), type, bytes.length, sha256(bytes), actor.getId(), reason == null || reason.isBlank() ? null : reason.trim());
        approvals.designate(actor, subjectFor(person, id), "SPECIMEN_CONFIRM", confirmerId, TrainingApprovalService.apart(person, actor.getId()));
        audit.logAs(actor, TYPE, "Specimen signature of " + owner.getFullName() + " #" + versionNo, id, "TRAINING_SPECIMEN_UPLOADED", null, "PENDING", reason == null ? "Uploaded" : reason.trim());
        return TrainingRows.camel(jdbc.queryForList(SELECT + " where s.id=?", id).getFirst());
    }

    @Transactional
    public Map<String, Object> confirm(UserAccount actor, UUID id, SignRequest request) {
        Map<String, Object> s = lock(id);
        requirePending(s);
        UUID person = (UUID) s.get("person_user_id");
        UUID assignment = approvals.requireCanSign(actor, subjectFor(person, id), "SPECIMEN_CONFIRM", TrainingApprovalService.apart(person, (UUID) s.get("uploaded_by")));
        if (request == null || request.signatureToken() == null || request.signatureToken().isBlank()) throw new IllegalArgumentException("TRAINING_SIGNATURE_REQUIRED");
        UUID signature = signatures.createEntitySignature(TYPE, id, "Specimen signature #" + s.get("version_no"), actor, request.signatureToken(), "TRAINING_SPECIMEN_APPROVED",
                "Training Management: specimen signature approved", null, null, null).getId();
        approvals.complete(assignment, signature);
        jdbc.update("update training_specimen_signatures set status='SUPERSEDED', updated_at=now() where person_user_id=? and status='APPROVED'", person);
        jdbc.update("update training_specimen_signatures set status='APPROVED', confirmed_by=?, confirmed_signature_id=?, effective_date=current_date, updated_at=now() where id=?", actor.getId(), signature, id);
        audit.logAs(actor, TYPE, "Specimen signature #" + s.get("version_no"), id, "TRAINING_SPECIMEN_APPROVED", "PENDING", "APPROVED", "Specimen signature confirmed");
        return TrainingRows.camel(jdbc.queryForList(SELECT + " where s.id=?", id).getFirst());
    }

    @Transactional
    public Map<String, Object> reject(UserAccount actor, UUID id, RejectRequest request) {
        Map<String, Object> s = lock(id);
        requirePending(s);
        UUID person = (UUID) s.get("person_user_id");
        if (request == null || request.reason() == null || request.reason().isBlank()) throw new IllegalArgumentException("TRAINING_REASON_REQUIRED");
        UUID assignment = approvals.requireCanSign(actor, subjectFor(person, id), "SPECIMEN_CONFIRM", TrainingApprovalService.apart(person, (UUID) s.get("uploaded_by")));
        approvals.complete(assignment, null);
        jdbc.update("update training_specimen_signatures set status='REJECTED', reject_reason=?, confirmed_by=?, updated_at=now() where id=?", request.reason().trim(), actor.getId(), id);
        audit.logAs(actor, TYPE, "Specimen signature #" + s.get("version_no"), id, "TRAINING_SPECIMEN_REJECTED", "PENDING", "REJECTED", request.reason().trim());
        return TrainingRows.camel(jdbc.queryForList(SELECT + " where s.id=?", id).getFirst());
    }

    // ----------------------------------------------------------------------------------------------------------------------------- helpers

    private Map<String, Object> row(UUID id) {
        return jdbc.queryForList("select * from training_specimen_signatures where id=?", id).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
    }

    private Map<String, Object> lock(UUID id) {
        return jdbc.queryForList("select * from training_specimen_signatures where id=? for update", id).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
    }

    private static void requirePending(Map<String, Object> s) {
        if (!"PENDING".equals(s.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_SPECIMEN_INVALID_TRANSITION");
    }

    /** The department of the person is the department of the confirmation; a person without a department can only be handled by someone with the right on all departments. */
    private TrainingApprovalService.Subject subjectFor(UUID personId, UUID id) {
        UserAccount person = users.findById(personId).orElseThrow(() -> new IllegalArgumentException("TRAINING_PARTICIPANT_NOT_ELIGIBLE"));
        return new TrainingApprovalService.Subject(TYPE, id, access.departmentOf(person), "Specimen signature of " + person.getFullName(), "training.signature.manage");
    }

    private static String detectType(byte[] b) {
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

    @SuppressWarnings("unused")
    private static byte[] utf8(String value) { return value.getBytes(StandardCharsets.UTF_8); }
}
