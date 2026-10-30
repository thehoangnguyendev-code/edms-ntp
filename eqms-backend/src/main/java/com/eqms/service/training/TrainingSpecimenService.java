package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.AuditTrailService;
import com.eqms.service.ClamAvScanService;
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
 * Specimen signatures (SOP.0003 section 5.3.9; FRM.0007): the scan of the paper that a person signed by hand, kept as a record for comparison with signed records. The paper is the original
 * (owner decision 2026-10-28, TRAINING-FRM-PAPER): the system does not write the form and does not ask anybody to confirm the scan. The person (or someone who manages them) uploads the
 * scans; each file is checked (a real PNG, JPEG, WebP or BMP picture, not a GIF, of a bounded size), scanned for malware and stored in the records bucket, which never deletes. The newest
 * upload is the current record of the person and the older one stays on record (Superseded). A record that was confirmed under the earlier workflow keeps its confirmer and signature. The image
 * is never part of a list; opening it is recorded in the Audit Trail.
 */
@Service
public class TrainingSpecimenService {
    private static final String TYPE = "TRAINING_SPECIMEN_SIGNATURE";
    private static final int MAX_BYTES = 5 * 1024 * 1024;
    private static final int MAX_WIDTH = 5000, MAX_HEIGHT = 5000;

    private final JdbcTemplate jdbc;
    private final TrainingAccess access;
    private final AuditTrailService audit;
    private final UserAccountRepository users;
    private final FileStorageService files;
    private final ClamAvScanService virusScan;

    public TrainingSpecimenService(JdbcTemplate jdbc, TrainingAccess access, AuditTrailService audit,
                                   UserAccountRepository users, FileStorageService files, ClamAvScanService virusScan) {
        this.jdbc = jdbc;
        this.access = access;
        this.audit = audit;
        this.users = users;
        this.files = files;
        this.virusScan = virusScan;
    }

    private static final String SELECT = """
        select s.id, s.person_user_id, u.full_name, u.employee_code, u.avatar, u.department, s.version_no, s.status, s.effective_date, s.content_type, s.size_bytes, s.sha256,
               s.change_reason, s.reject_reason, s.created_at, (s.sha256_2 is not null) as has_second, uu.full_name as uploaded_by_name, cu.full_name as confirmed_by_name
          from training_specimen_signatures s join app_users u on u.id = s.person_user_id join app_users uu on uu.id = s.uploaded_by left join app_users cu on cu.id = s.confirmed_by
        """;

    // ----------------------------------------------------------------------------------------------------------------------------- reading

    @Transactional(readOnly = true)
    public Map<String, Object> list(UserAccount actor, String search, String status, String sortBy, String sortDirection, int page, int limit) {
        return list(actor, search, status, sortBy, sortDirection, page, limit, Map.of());
    }

    @Transactional(readOnly = true)
    public Map<String, Object> list(UserAccount actor, String search, String status, String sortBy, String sortDirection, int page, int limit, Map<String, String> more) {
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
            where.append(" and (lower(u.full_name) like ? escape '\\' or lower(coalesce(u.employee_code,'')) like ? escape '\\' or lower(coalesce(u.department,'')) like ? escape '\\' or lower(coalesce(s.change_reason,'')) like ? escape '\\' or lower(coalesce(uu.full_name,'')) like ? escape '\\' or lower(coalesce(cu.full_name,'')) like ? escape '\\')");
            args.add(like); args.add(like); args.add(like); args.add(like); args.add(like); args.add(like);
        }
        TrainingListFilter extra = new TrainingListFilter().contains(more.get("uploadedBy"), "uu.full_name")
                .dateRange("s.effective_date", more.get("effectiveFrom"), more.get("effectiveTo")).timeRange("s.created_at", more.get("uploadedFrom"), more.get("uploadedTo"));
        if (more.get("department") != null && !more.get("department").isBlank()) extra.raw("lower(trim(u.department)) = lower(trim(?))", more.get("department"));
        // The same person's own entries, for the "related" card of a detail screen.
        if (more.get("personId") != null && !more.get("personId").isBlank()) extra.raw("s.person_user_id = ?", java.util.UUID.fromString(more.get("personId")));
        where.append(extra.and());
        args.addAll(extra.args());
        Long total = jdbc.queryForObject("select count(*) from training_specimen_signatures s join app_users u on u.id = s.person_user_id join app_users uu on uu.id = s.uploaded_by left join app_users cu on cu.id = s.confirmed_by" + where, Long.class, args.toArray());
        int safeLimit = Math.min(Math.max(limit, 1), 100), safePage = Math.max(page, 1);
        args.add(safeLimit); args.add((safePage - 1) * safeLimit);
        List<Map<String, Object>> rows = TrainingRows.camel(jdbc.queryForList(SELECT + where + TrainingRows.orderBy(sortBy, sortDirection, Map.of("employee", "u.full_name", "employeeCode", "u.employee_code", "department", "u.department", "version", "s.version_no", "status", "s.status", "uploadedBy", "uu.full_name", "confirmedBy", "cu.full_name", "effective", "s.effective_date", "reason", "s.change_reason", "createdAt", "s.created_at"),
                "s.created_at desc") + " limit ? offset ?", args.toArray()));
        for (Map<String, Object> row : rows) row.put("capabilities", capabilities(actor, (UUID) row.get("id"), (UUID) row.get("personUserId"), String.valueOf(row.get("status")), row.get("rejectReason") != null));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("data", rows);
        long count = total == null ? 0 : total;
        result.put("pagination", Map.of("page", safePage, "limit", safeLimit, "total", count, "totalPages", Math.max(1, (count + safeLimit - 1) / safeLimit)));
        return result;
    }

    /** The row of a specimen signature the person may see: their own, or one of the department (all with the right to see every department). Anything else is denied without saying it exists. */
    private Map<String, Object> visibleRow(UserAccount actor, UUID id) {
        Map<String, Object> s = jdbc.queryForList(SELECT + " where s.id = ?", id).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        if (actor.getId().equals(s.get("person_user_id"))) return s;
        if (!access.has(actor, "training.signature.view", "training.signature.manage", "training.signature.confirm")) throw new SecurityException(TrainingAccess.DENIED);
        if (!access.allDepartments(actor)) {
            String own = actor.getDepartment() == null ? "" : actor.getDepartment().trim();
            if (!own.equalsIgnoreCase(String.valueOf(s.get("department") == null ? "" : s.get("department")).trim())) throw new SecurityException(TrainingAccess.DENIED);
        }
        return s;
    }

    /** One specimen signature, as the list shows it, for its detail screen. */
    @Transactional(readOnly = true)
    public Map<String, Object> get(UserAccount actor, UUID id) {
        Map<String, Object> row = TrainingRows.camel(visibleRow(actor, id));
        row.put("capabilities", capabilities(actor, id, (UUID) row.get("personUserId"), String.valueOf(row.get("status")), row.get("rejectReason") != null));
        return row;
    }

    /** Every version of the specimen signature of the same person, searched, sorted and paged here; {@code current} marks the one the person is looking at. */
    @Transactional(readOnly = true)
    public Map<String, Object> revisions(UserAccount actor, UUID id, String search, String sortBy, String sortDirection, int page, int limit) {
        Map<String, Object> s = visibleRow(actor, id);
        List<Object> args = new ArrayList<>();
        args.add(s.get("person_user_id"));
        StringBuilder where = new StringBuilder(" where s.person_user_id = ?");
        if (search != null && !search.isBlank()) {
            String like = "%" + search.trim().toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
            where.append(" and (cast(s.version_no as text) like ? escape '\\' or lower(uu.full_name) like ? escape '\\' or lower(coalesce(cu.full_name,'')) like ? escape '\\' or lower(coalesce(s.change_reason,'')) like ? escape '\\')");
            args.add(like); args.add(like); args.add(like); args.add(like);
        }
        String from = " from training_specimen_signatures s join app_users uu on uu.id = s.uploaded_by left join app_users cu on cu.id = s.confirmed_by";
        Long total = jdbc.queryForObject("select count(*)" + from + where, Long.class, args.toArray());
        int safeLimit = Math.min(Math.max(limit, 1), 100), safePage = Math.max(page, 1);
        args.add(safeLimit); args.add((safePage - 1) * safeLimit);
        List<Map<String, Object>> rows = TrainingRows.camel(jdbc.queryForList("select s.id, s.version_no, s.status, s.effective_date, s.created_at, s.change_reason, s.reject_reason, uu.full_name as uploaded_by_name, cu.full_name as confirmed_by_name"
                + from + where + TrainingRows.orderBy(sortBy, sortDirection, Map.of("versionNo", "s.version_no", "created", "s.created_at", "uploadedBy", "uu.full_name", "confirmedBy", "cu.full_name", "effective", "s.effective_date", "status", "s.status"), "s.version_no desc") + " limit ? offset ?", args.toArray()));
        for (Map<String, Object> row : rows) row.put("current", id.equals(row.get("id")));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("data", rows);
        long count = total == null ? 0 : total;
        result.put("pagination", Map.of("page", safePage, "limit", safeLimit, "total", count, "totalPages", Math.max(1, (count + safeLimit - 1) / safeLimit)));
        return result;
    }

    private Map<String, Object> capabilities(UserAccount actor, UUID id, UUID personId, String status, boolean rejected) {
        Map<String, Object> caps = new LinkedHashMap<>();
        caps.put("viewImage", actor.getId().equals(personId) || access.has(actor, "training.signature.view", "training.signature.manage", "training.signature.confirm"));
        return caps;
    }

    /**
     * The specimen signature of a person that is in force now (Approved), for the person who checks a scan against the paper: only what is needed to open the image (its id, the number of
     * images). The same check as the image itself; nothing is opened here, so nothing is written to the Audit Trail until the image is. {@code null} when the person has none.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> currentOf(UserAccount actor, UUID personId) {
        if (!actor.getId().equals(personId)) {
            access.require(actor, "training.signature.view", "training.signature.manage", "training.signature.confirm");
            UUID department = access.departmentOf(users.findById(personId).orElseThrow(() -> new SecurityException(TrainingAccess.DENIED)));
            if (!(access.allDepartments(actor) || (department != null && access.inScope(actor, department)))) throw new SecurityException(TrainingAccess.DENIED);
        }
        return jdbc.queryForList("select s.id, s.version_no, s.effective_date, (s.stored_path_2 is not null) as has_second, u.full_name from training_specimen_signatures s join app_users u on u.id = s.person_user_id "
                + "where s.person_user_id = ? and s.status = 'APPROVED' order by s.version_no desc limit 1", personId).stream().findFirst().map(TrainingRows::camel).orElse(null);
    }

    /** The image: bytes and type. The person, or someone who may see specimen signatures of the department. Opening it is recorded in the Audit Trail. */
    @Transactional
    public Map<String, Object> image(UserAccount actor, UUID id, int which) {
        Map<String, Object> s = row(id);
        UUID person = (UUID) s.get("person_user_id");
        if (!actor.getId().equals(person)) {
            access.require(actor, "training.signature.view", "training.signature.manage", "training.signature.confirm");
            UUID department = access.departmentOf(users.findById(person).orElseThrow());
            if (!(access.allDepartments(actor) || (department != null && access.inScope(actor, department)))) throw new SecurityException(TrainingAccess.DENIED);
        }
        if (which != 1 && which != 2) throw new IllegalArgumentException("TRAINING_FILE_REJECTED");
        String suffix = which == 2 ? "_2" : "";
        if (which == 2 && s.get("stored_path_2") == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "TRAINING_FILE_UNAVAILABLE");
        try {
            byte[] bytes = files.readReportArtifact(String.valueOf(s.get("provider" + suffix)), String.valueOf(s.get("stored_path" + suffix)));
            audit.logAs(actor, TYPE, "Specimen signature #" + s.get("version_no"), id, "TRAINING_SPECIMEN_VIEWED", null, null, "Image " + which + " opened");
            return Map.of("bytes", bytes, "contentType", String.valueOf(s.get("content_type" + suffix)));
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "TRAINING_FILE_UNAVAILABLE");
        }
    }

    // ----------------------------------------------------------------------------------------------------------------------------- writing

    /** The scans of the paper that a person signed: they become the current record of the person at once; the earlier current record becomes Superseded and stays on record. */
    @Transactional
    public Map<String, Object> upload(UserAccount actor, UUID personId, MultipartFile file, MultipartFile file2, String reason) {
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
        // FRM.0007: the 1st and the 2nd specimen signature; both are required and both are checked the same way.
        if (file2 == null || file2.isEmpty()) throw new IllegalArgumentException("TRAINING_SPECIMEN_SECOND_REQUIRED");
        Checked first = check(file), second = check(file2);
        jdbc.queryForList("select id from training_specimen_signatures where person_user_id=? for update", person);
        Integer current = jdbc.queryForObject("select count(*) from training_specimen_signatures where person_user_id=? and status='APPROVED'", Integer.class, person);
        if (current != null && current > 0 && (reason == null || reason.isBlank())) throw new IllegalArgumentException("TRAINING_REASON_REQUIRED");
        int versionNo = ((Number) jdbc.queryForObject("select coalesce(max(version_no),0)+1 from training_specimen_signatures where person_user_id=?", Number.class, person)).intValue();
        UUID id = UUID.randomUUID();
        FileStorageService.StorageWriteResult stored, stored2;
        try {
            stored = files.storeReportArtifact("training/specimen-signatures/" + person + "/" + id + extensionOf(first.type()), new ByteArrayInputStream(first.bytes()), first.type());
            stored2 = files.storeReportArtifact("training/specimen-signatures/" + person + "/" + id + "-2" + extensionOf(second.type()), new ByteArrayInputStream(second.bytes()), second.type());
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "TRAINING_FILE_UNAVAILABLE");
        }
        jdbc.update("update training_specimen_signatures set status='OBSOLETED', updated_at=now() where person_user_id=? and status='APPROVED'", person);
        jdbc.update("""
            insert into training_specimen_signatures(id, person_user_id, version_no, status, effective_date, provider, stored_path, object_key, content_type, size_bytes, sha256, uploaded_by, change_reason,
                                                     provider_2, stored_path_2, object_key_2, content_type_2, size_bytes_2, sha256_2)
            values (?,?,?,'APPROVED',current_date,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """, id, person, versionNo, stored.provider(), stored.storedPath(), stored.objectKey(), first.type(), first.bytes().length, sha256(first.bytes()), actor.getId(), reason == null || reason.isBlank() ? null : reason.trim(),
                stored2.provider(), stored2.storedPath(), stored2.objectKey(), second.type(), second.bytes().length, sha256(second.bytes()));
        audit.logAs(actor, TYPE, "Specimen signature of " + owner.getFullName() + " #" + versionNo, id, "TRAINING_SPECIMEN_UPLOADED", current != null && current > 0 ? "APPROVED" : null, "APPROVED",
                reason == null || reason.isBlank() ? "Scan of the signed paper kept as the current record" : reason.trim());
        return TrainingRows.camel(jdbc.queryForList(SELECT + " where s.id=?", id).getFirst());
    }

    private record Checked(byte[] bytes, String type) {}

    /** One image of a specimen signature: size, real type, dimensions and a virus scan. */
    private Checked check(MultipartFile file) {
        if (file == null || file.isEmpty() || file.getSize() > MAX_BYTES) throw new IllegalArgumentException("TRAINING_FILE_REJECTED");
        byte[] bytes;
        try { bytes = file.getBytes(); } catch (IOException e) { throw new IllegalArgumentException("TRAINING_FILE_REJECTED"); }
        String type = detectType(bytes);
        if (type == null) throw new IllegalArgumentException("TRAINING_FILE_REJECTED");
        int[] size = dimensions(type, bytes);
        if (size == null || size[0] > MAX_WIDTH || size[1] > MAX_HEIGHT || size[0] < 40 || size[1] < 20) throw new IllegalArgumentException("TRAINING_FILE_REJECTED");
        ClamAvScanService.ScanResult scan = virusScan.scan(bytes);
        if (!scan.clean()) throw new IllegalArgumentException("TRAINING_FILE_REJECTED");
        return new Checked(bytes, type);
    }

    // ----------------------------------------------------------------------------------------------------------------------------- helpers

    private Map<String, Object> row(UUID id) {
        return jdbc.queryForList("select * from training_specimen_signatures where id=?", id).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
    }

    /** The kind of image, from its content and not from its name. A GIF (and anything else) is refused; only a picture that every browser shows is kept. */
    private static String detectType(byte[] b) {
        if (b.length > 8 && (b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G') return "image/png";
        if (b.length > 3 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) return "image/jpeg";
        if (b.length > 30 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F' && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P') return "image/webp";
        if (b.length > 30 && b[0] == 'B' && b[1] == 'M') return "image/bmp";
        return null;
    }

    private static String extensionOf(String type) {
        return switch (type) {
            case "image/png" -> ".png";
            case "image/webp" -> ".webp";
            case "image/bmp" -> ".bmp";
            default -> ".jpg";
        };
    }

    /** Width and height of the picture, or null when it cannot be read. WebP is read from its header; the others by the image reader of the platform. */
    private static int[] dimensions(String type, byte[] b) {
        try {
            if ("image/webp".equals(type)) return webpDimensions(b);
            BufferedImage image = ImageIO.read(new ByteArrayInputStream(b));
            return image == null ? null : new int[]{image.getWidth(), image.getHeight()};
        } catch (IOException | RuntimeException e) {
            return null;
        }
    }

    private static int[] webpDimensions(byte[] b) {
        String chunk = new String(b, 12, 4, StandardCharsets.US_ASCII);
        if ("VP8 ".equals(chunk) && b.length > 30) return new int[]{((b[26] & 0xFF) | ((b[27] & 0xFF) << 8)) & 0x3FFF, ((b[28] & 0xFF) | ((b[29] & 0xFF) << 8)) & 0x3FFF};
        if ("VP8L".equals(chunk) && b.length > 25) {
            int bits = (b[21] & 0xFF) | ((b[22] & 0xFF) << 8) | ((b[23] & 0xFF) << 16) | ((b[24] & 0xFF) << 24);
            return new int[]{(bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1};
        }
        if ("VP8X".equals(chunk) && b.length > 29) {
            return new int[]{1 + ((b[24] & 0xFF) | ((b[25] & 0xFF) << 8) | ((b[26] & 0xFF) << 16)), 1 + ((b[27] & 0xFF) | ((b[28] & 0xFF) << 8) | ((b[29] & 0xFF) << 16))};
        }
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
