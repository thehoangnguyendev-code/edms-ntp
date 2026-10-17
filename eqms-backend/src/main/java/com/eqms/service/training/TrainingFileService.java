package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import com.eqms.service.AuditTrailService;
import com.eqms.service.ClamAvScanService;
import com.eqms.service.FileStorageService;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * The files of a training activity: the content and the test (materials), and the scans of the sheets and tests that were signed on paper. A file must be a PDF,
 * a picture or an Office document of a bounded size, its type is checked on the content and not only on the name, and it is scanned for malware. It is stored
 * in the records bucket with its SHA-256 and never changed or deleted. Materials can be added and marked as removed only until their content is reviewed. A paper
 * scan is received by a second person who checked it against the paper; receiving it records the paper signature of the person it belongs to.
 */
@Service
public class TrainingFileService {
    private static final int MAX_BYTES = 20 * 1024 * 1024;
    private static final int MAX_VIDEO_BYTES = 100 * 1024 * 1024;
    private static final Map<String, String> TYPES = Map.of(
            "pdf", "application/pdf", "png", "image/png", "jpg", "image/jpeg", "jpeg", "image/jpeg",
            "docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "mp4", "video/mp4");

    private final JdbcTemplate jdbc;
    private final TrainingAccess access;
    private final TrainingStore store;
    private final AuditTrailService audit;
    private final FileStorageService files;
    private final ClamAvScanService virusScan;
    private final com.eqms.service.OnlyOfficeDocumentEditService onlyOffice;

    public TrainingFileService(JdbcTemplate jdbc, TrainingAccess access, TrainingStore store, AuditTrailService audit, FileStorageService files, ClamAvScanService virusScan, com.eqms.service.OnlyOfficeDocumentEditService onlyOffice) {
        this.jdbc = jdbc;
        this.access = access;
        this.store = store;
        this.audit = audit;
        this.files = files;
        this.virusScan = virusScan;
        this.onlyOffice = onlyOffice;
    }

    public record RemoveRequest(String reason) {}

    // ----------------------------------------------------------------------------------------------------------------------------- reading

    @Transactional(readOnly = true)
    public Map<String, Object> list(UserAccount actor, UUID activityId) {
        Map<String, Object> activity = readable(actor, activityId);
        boolean manager = canManage(actor, activity);
        boolean answerKeyViewer = canSeeAnswerKey(actor, activity);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("materials", TrainingRows.camel(jdbc.queryForList("""
            select m.id, m.title, m.purpose, m.link_url, m.original_name, m.content_type, m.size_bytes, m.sha256, m.created_at, m.removed_at, m.remove_reason, u.full_name as uploaded_by_name
              from training_materials m join app_users u on u.id = m.uploaded_by where m.activity_id=? """ + (manager ? " " : " and m.removed_at is null ") + (answerKeyViewer ? " " : " and m.purpose <> 'ANSWER_KEY' ") + " order by m.created_at", activityId)));
        out.put("canSeeAnswerKey", answerKeyViewer);
        out.put("evidence", manager || access.has(actor, "training.activity.view") ? TrainingRows.camel(jdbc.queryForList("""
            select e.id, e.kind, e.original_name, e.content_type, e.size_bytes, e.sha256, e.remark, e.uploaded_at, e.received_at, e.participant_id, p.full_name as participant_name,
                   u.full_name as uploaded_by_name, r.full_name as received_by_name
              from training_paper_evidence e join app_users u on u.id = e.uploaded_by left join app_users r on r.id = e.received_by left join training_participants p on p.id = e.participant_id
             where e.activity_id=? order by e.uploaded_at
            """, activityId)) : List.of());
        out.put("canUploadMaterial", manager && Set.of("PLANNED", "NOTIFIED").contains(String.valueOf(activity.get("status"))) && !contentReviewed(activityId));
        out.put("canUploadEvidence", conductor(actor, activity) && Set.of("NOTIFIED", "IN_PROGRESS", "PENDING_QA_CONFIRMATION").contains(String.valueOf(activity.get("status"))));
        out.put("canReceive", conductor(actor, activity));
        return out;
    }

    private Map<String, Object> readable(UserAccount actor, UUID activityId) {
        Map<String, Object> activity = store.activity(activityId).orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        Integer participant = jdbc.queryForObject("select count(*) from training_participants where activity_id=? and person_user_id=?", Integer.class, activityId, actor.getId());
        if (participant != null && participant > 0 && Set.of("NOTIFIED", "IN_PROGRESS", "PENDING_QA_CONFIRMATION", "COMPLETED").contains(String.valueOf(activity.get("status")))) return activity;
        access.require(actor, "training.activity.view");
        access.requireScope(actor, (UUID) activity.get("organizer_department_id"));
        return activity;
    }

    private boolean canManage(UserAccount actor, Map<String, Object> activity) {
        return access.has(actor, "training.activity.organize") && access.inScope(actor, (UUID) activity.get("organizer_department_id"));
    }

    /** The answer key is for the organizers and for the people asked to review or approve the content; nobody else, not even the participants. */
    private boolean canSeeAnswerKey(UserAccount actor, Map<String, Object> activity) {
        if (canManage(actor, activity)) return true;
        Integer assigned = jdbc.queryForObject("select count(*) from training_approval_assignments where object_type='TRAINING_ACTIVITY' and object_id=? and assignee_user_id=? and step_code in ('CONTENT_REVIEW','CONTENT_APPROVE')",
                Integer.class, activity.get("id"), actor.getId());
        return assigned != null && assigned > 0;
    }

    private boolean conductor(UserAccount actor, Map<String, Object> activity) {
        return access.has(actor, "training.activity.conduct", "training.activity.organize") && access.inScope(actor, (UUID) activity.get("organizer_department_id"));
    }

    private boolean contentReviewed(UUID activityId) {
        Integer count = jdbc.queryForObject("select count(*) from training_activity_confirmations where activity_id=? and kind='CONTENT_REVIEWED'", Integer.class, activityId);
        return count != null && count > 0;
    }

    // ----------------------------------------------------------------------------------------------------------------------------- materials

    @Transactional
    public Map<String, Object> uploadMaterial(UserAccount actor, UUID activityId, MultipartFile file, String title, String purpose) {
        Map<String, Object> activity = store.activityForUpdate(activityId).orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        access.require(actor, "training.activity.organize");
        access.requireScope(actor, (UUID) activity.get("organizer_department_id"));
        if (!Set.of("PLANNED", "NOTIFIED").contains(String.valueOf(activity.get("status")))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_ACTIVITY_INVALID_TRANSITION");
        if (contentReviewed(activityId)) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_CONTENT_ALREADY_REVIEWED");
        String kind = purpose == null || purpose.isBlank() ? "CONTENT" : purpose;
        if (!Set.of("CONTENT", "EXAM", "ANSWER_KEY").contains(kind)) throw new IllegalArgumentException("TRAINING_FILE_REJECTED");
        if (!"CONTENT".equals(kind)) {
            Integer same = jdbc.queryForObject("select count(*) from training_materials where activity_id=? and purpose=? and removed_at is null", Integer.class, activityId, kind);
            if (same != null && same > 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_MATERIAL_PURPOSE_EXISTS");
        }
        Checked checked = check(file);
        if (!"CONTENT".equals(kind) && !Set.of("pdf", "docx").contains(checked.extension())) throw new IllegalArgumentException("TRAINING_FILE_REJECTED");
        String name = title == null || title.isBlank() ? checked.name() : title.trim();
        if (name.length() > 255) throw new IllegalArgumentException("TRAINING_FILE_REJECTED");
        UUID id = UUID.randomUUID();
        FileStorageService.StorageWriteResult stored = write("training/materials/" + activityId + "/" + id + "." + checked.extension(), checked);
        jdbc.update("insert into training_materials(id, activity_id, title, purpose, original_name, provider, stored_path, content_type, size_bytes, sha256, uploaded_by) values (?,?,?,?,?,?,?,?,?,?,?)",
                id, activityId, name, kind, checked.name(), stored.provider(), stored.storedPath(), checked.contentType(), checked.bytes().length, checked.sha256(), actor.getId());
        store.event(TrainingStore.OBJECT_ACTIVITY, id, activityId, "MATERIAL_ADDED", Map.of("name", checked.name(), "sha256", checked.sha256()), actor.getId());
        store.auditActivity(actor, activity, "TRAINING_MATERIAL_ADDED", null, null, name + " (SHA-256 " + checked.sha256().substring(0, 12) + ")");
        return list(actor, activityId);
    }

    /** A link (for example a video or a web page) as training content. It is outside the controlled files: nothing is stored or fingerprinted, and the screen says so. */
    @Transactional
    public Map<String, Object> addLink(UserAccount actor, UUID activityId, String title, String url) {
        Map<String, Object> activity = store.activityForUpdate(activityId).orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        access.require(actor, "training.activity.organize");
        access.requireScope(actor, (UUID) activity.get("organizer_department_id"));
        if (!Set.of("PLANNED", "NOTIFIED").contains(String.valueOf(activity.get("status")))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_ACTIVITY_INVALID_TRANSITION");
        if (contentReviewed(activityId)) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_CONTENT_ALREADY_REVIEWED");
        String link = url == null ? "" : url.trim();
        java.net.URI uri;
        try { uri = java.net.URI.create(link); } catch (IllegalArgumentException e) { throw new IllegalArgumentException("TRAINING_LINK_INVALID"); }
        if (link.length() > 1000 || uri.getHost() == null || !"https".equalsIgnoreCase(uri.getScheme())) throw new IllegalArgumentException("TRAINING_LINK_INVALID");
        String name = title == null || title.isBlank() ? uri.getHost() : title.trim();
        if (name.length() > 255) throw new IllegalArgumentException("TRAINING_LINK_INVALID");
        UUID id = UUID.randomUUID();
        jdbc.update("insert into training_materials(id, activity_id, title, purpose, link_url, uploaded_by) values (?,?,?,'CONTENT',?,?)", id, activityId, name, link, actor.getId());
        store.event(TrainingStore.OBJECT_ACTIVITY, id, activityId, "MATERIAL_LINK_ADDED", Map.of("title", name, "url", link), actor.getId());
        store.auditActivity(actor, activity, "TRAINING_MATERIAL_LINK_ADDED", null, null, name + " (" + link + ")");
        return list(actor, activityId);
    }

    @Transactional
    public Map<String, Object> removeMaterial(UserAccount actor, UUID id, RemoveRequest request) {
        Map<String, Object> m = jdbc.queryForList("select * from training_materials where id=? for update", id).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        UUID activityId = (UUID) m.get("activity_id");
        Map<String, Object> activity = store.activityForUpdate(activityId).orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        access.require(actor, "training.activity.organize");
        access.requireScope(actor, (UUID) activity.get("organizer_department_id"));
        if (m.get("removed_at") != null || !Set.of("PLANNED", "NOTIFIED").contains(String.valueOf(activity.get("status"))) || contentReviewed(activityId)) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_CONTENT_ALREADY_REVIEWED");
        if (request == null || request.reason() == null || request.reason().isBlank()) throw new IllegalArgumentException("TRAINING_REASON_REQUIRED");
        jdbc.update("update training_materials set removed_at=now(), removed_by=?, remove_reason=? where id=?", actor.getId(), request.reason().trim(), id);
        store.auditActivity(actor, activity, "TRAINING_MATERIAL_REMOVED", null, null, m.get("title") + ": " + request.reason().trim());
        return list(actor, activityId);
    }

    @Transactional
    public Map<String, Object> downloadMaterial(UserAccount actor, UUID id) {
        Map<String, Object> m = jdbc.queryForList("select * from training_materials where id=?", id).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        Map<String, Object> activity = readable(actor, (UUID) m.get("activity_id"));
        if (m.get("removed_at") != null && !canManage(actor, activity)) throw new SecurityException(TrainingAccess.DENIED);
        if (m.get("link_url") != null) throw new IllegalArgumentException("TRAINING_FILE_REJECTED");
        if ("ANSWER_KEY".equals(m.get("purpose")) && !canSeeAnswerKey(actor, activity)) throw new SecurityException(TrainingAccess.DENIED);
        return read(actor, activity, m, "TRAINING_MATERIAL_DOWNLOADED");
    }

    private Map<String, Object> viewable(UserAccount actor, UUID id) {
        Map<String, Object> m = jdbc.queryForList("select * from training_materials where id=?", id).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        if (m.get("link_url") != null) throw new IllegalArgumentException("TRAINING_FILE_REJECTED");
        Map<String, Object> activity = readable(actor, (UUID) m.get("activity_id"));
        if (m.get("removed_at") != null && !canManage(actor, activity)) throw new SecurityException(TrainingAccess.DENIED);
        if ("ANSWER_KEY".equals(m.get("purpose")) && !canSeeAnswerKey(actor, activity)) throw new SecurityException(TrainingAccess.DENIED);
        m.put("_activity", activity);
        return m;
    }

    /** A PDF to look at in the browser, as it is stored. A Word file is shown by the OnlyOffice viewer instead (see viewConfigOfMaterial); nothing is converted. */
    @Transactional
    @SuppressWarnings("unchecked")
    public Map<String, Object> previewMaterial(UserAccount actor, UUID id) {
        Map<String, Object> m = viewable(actor, id);
        if (!String.valueOf(m.get("original_name")).toLowerCase(Locale.ROOT).endsWith(".pdf")) throw new IllegalArgumentException("TRAINING_PREVIEW_UNAVAILABLE");
        return read(actor, (Map<String, Object>) m.get("_activity"), m, "TRAINING_MATERIAL_PREVIEWED");
    }

    /** The read-only OnlyOffice viewer config of a Word file. The file is served to the document server by a token that names it, after its SHA-256 is checked. */
    @Transactional
    @SuppressWarnings("unchecked")
    public Map<String, Object> viewConfigOfMaterial(UserAccount actor, UUID id) {
        Map<String, Object> m = viewable(actor, id);
        String name = String.valueOf(m.get("original_name"));
        if (!name.toLowerCase(Locale.ROOT).endsWith(".docx") || !onlyOffice.isConfigured()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "TRAINING_PREVIEW_UNAVAILABLE");
        store.auditActivity(actor, (Map<String, Object>) m.get("_activity"), "TRAINING_MATERIAL_PREVIEWED", null, null, name);
        return new java.util.LinkedHashMap<>(com.fasterxml.jackson.databind.json.JsonMapper.builder().build().convertValue(
                onlyOffice.buildStoredFileViewConfig("training-material", id, String.valueOf(m.get("sha256")), name, actor), Map.class));
    }

    /** The bytes the OnlyOffice document server fetches for the viewer (authenticated by its token, not by a session); the SHA-256 is checked. */
    @Transactional(readOnly = true)
    public byte[] materialBytesForViewer(UUID id) {
        Map<String, Object> m = jdbc.queryForList("select * from training_materials where id=?", id).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        if (m.get("link_url") != null || !String.valueOf(m.get("original_name")).toLowerCase(Locale.ROOT).endsWith(".docx")) throw new SecurityException(TrainingAccess.DENIED);
        try {
            byte[] bytes = files.readReportArtifact(String.valueOf(m.get("provider")), String.valueOf(m.get("stored_path")));
            if (!sha256(bytes).equals(m.get("sha256"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_FILE_INTEGRITY_FAILED");
            return bytes;
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "TRAINING_FILE_UNAVAILABLE");
        }
    }

    // ----------------------------------------------------------------------------------------------------------------------------- paper evidence

    @Transactional
    public Map<String, Object> uploadEvidence(UserAccount actor, UUID activityId, MultipartFile file, String kind, UUID participantId, String remark) {
        Map<String, Object> activity = store.activityForUpdate(activityId).orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        if (!conductor(actor, activity)) throw new SecurityException(TrainingAccess.DENIED);
        if (!Set.of("NOTIFIED", "IN_PROGRESS", "PENDING_QA_CONFIRMATION").contains(String.valueOf(activity.get("status")))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_ACTIVITY_INVALID_TRANSITION");
        if (kind == null || !Set.of("ATTENDANCE_SHEET", "ASSESSMENT", "OTHER").contains(kind)) throw new IllegalArgumentException("TRAINING_FILE_REJECTED");
        if (participantId != null) {
            Integer belongs = jdbc.queryForObject("select count(*) from training_participants where id=? and activity_id=?", Integer.class, participantId, activityId);
            if (belongs == null || belongs == 0) throw new IllegalArgumentException("TRAINING_PARTICIPANT_NOT_ELIGIBLE");
        }
        Checked checked = check(file);
        if ("mp4".equals(checked.extension())) throw new IllegalArgumentException("TRAINING_FILE_REJECTED");
        UUID id = UUID.randomUUID();
        FileStorageService.StorageWriteResult stored = write("training/paper-evidence/" + activityId + "/" + id + "." + checked.extension(), checked);
        jdbc.update("insert into training_paper_evidence(id, activity_id, participant_id, kind, original_name, provider, stored_path, content_type, size_bytes, sha256, remark, uploaded_by) values (?,?,?,?,?,?,?,?,?,?,?,?)",
                id, activityId, participantId, kind, checked.name(), stored.provider(), stored.storedPath(), checked.contentType(), checked.bytes().length, checked.sha256(),
                remark == null || remark.isBlank() ? null : remark.trim(), actor.getId());
        store.auditActivity(actor, activity, "TRAINING_PAPER_EVIDENCE_UPLOADED", null, null, kind + ": " + checked.name() + " (SHA-256 " + checked.sha256().substring(0, 12) + ")");
        return list(actor, activityId);
    }

    /** A second person checks the scan against the paper. Then the paper signature of the person it belongs to is recorded. */
    @Transactional
    public Map<String, Object> receiveEvidence(UserAccount actor, UUID id) {
        Map<String, Object> e = jdbc.queryForList("select * from training_paper_evidence where id=? for update", id).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        UUID activityId = (UUID) e.get("activity_id");
        Map<String, Object> activity = store.activityForUpdate(activityId).orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        if (!conductor(actor, activity)) throw new SecurityException(TrainingAccess.DENIED);
        if (e.get("received_at") != null) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_EVIDENCE_ALREADY_RECEIVED");
        if (actor.getId().equals(e.get("uploaded_by"))) throw new IllegalArgumentException(TrainingApprovalService.SEGREGATION);
        jdbc.update("update training_paper_evidence set received_by=?, received_at=now() where id=?", actor.getId(), id);
        if (e.get("participant_id") != null) jdbc.update("update training_participants set sign_mode='PAPER_SCAN', version=version+1 where id=?", e.get("participant_id"));
        store.auditActivity(actor, activity, "TRAINING_PAPER_EVIDENCE_RECEIVED", null, null, e.get("original_name") + " checked against the paper");
        return list(actor, activityId);
    }

    @Transactional
    public Map<String, Object> downloadEvidence(UserAccount actor, UUID id) {
        Map<String, Object> e = jdbc.queryForList("select * from training_paper_evidence where id=?", id).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        UUID activityId = (UUID) e.get("activity_id");
        Map<String, Object> activity = store.activity(activityId).orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        access.require(actor, "training.activity.view");
        access.requireScope(actor, (UUID) activity.get("organizer_department_id"));
        return read(actor, activity, e, "TRAINING_PAPER_EVIDENCE_DOWNLOADED");
    }

    // ----------------------------------------------------------------------------------------------------------------------------- helpers

    private Map<String, Object> read(UserAccount actor, Map<String, Object> activity, Map<String, Object> row, String action) {
        try {
            byte[] bytes = files.readReportArtifact(String.valueOf(row.get("provider")), String.valueOf(row.get("stored_path")));
            if (!sha256(bytes).equals(row.get("sha256"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_FILE_INTEGRITY_FAILED");
            store.auditActivity(actor, activity, action, null, null, String.valueOf(row.get("original_name")));
            return Map.of("bytes", bytes, "contentType", String.valueOf(row.get("content_type")), "name", String.valueOf(row.get("original_name")));
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "TRAINING_FILE_UNAVAILABLE");
        }
    }

    private FileStorageService.StorageWriteResult write(String key, Checked checked) {
        try {
            return files.storeReportArtifact(key, new ByteArrayInputStream(checked.bytes()), checked.contentType());
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "TRAINING_FILE_UNAVAILABLE");
        }
    }

    private record Checked(byte[] bytes, String name, String extension, String contentType, String sha256) {}

    private Checked check(MultipartFile file) {
        if (file == null || file.isEmpty() || file.getSize() > MAX_VIDEO_BYTES) throw new IllegalArgumentException("TRAINING_FILE_REJECTED");
        String original = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().replace('\\', '/');
        String name = original.substring(original.lastIndexOf('/') + 1).replaceAll("[\\p{Cntrl}]", "").trim();
        int dot = name.lastIndexOf('.');
        String ext = dot < 0 ? "" : name.substring(dot + 1).toLowerCase(Locale.ROOT);
        if (name.isEmpty() || name.length() > 255 || !TYPES.containsKey(ext)) throw new IllegalArgumentException("TRAINING_FILE_REJECTED");
        if (file.getSize() > MAX_BYTES && !"mp4".equals(ext)) throw new IllegalArgumentException("TRAINING_FILE_REJECTED");
        byte[] bytes;
        try { bytes = file.getBytes(); } catch (IOException e) { throw new IllegalArgumentException("TRAINING_FILE_REJECTED"); }
        if (!matches(ext, bytes)) throw new IllegalArgumentException("TRAINING_FILE_REJECTED");
        if (!virusScan.scan(bytes).clean()) throw new IllegalArgumentException("TRAINING_FILE_REJECTED");
        return new Checked(bytes, name, ext, TYPES.get(ext), sha256(bytes));
    }

    /** The content must be what the name says: PDF, PNG, JPEG, or a ZIP package for the Office types. */
    private static boolean matches(String ext, byte[] b) {
        return switch (ext) {
            case "pdf" -> b.length > 5 && b[0] == '%' && b[1] == 'P' && b[2] == 'D' && b[3] == 'F';
            case "png" -> b.length > 8 && (b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G';
            case "jpg", "jpeg" -> b.length > 3 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF;
            case "docx", "xlsx", "pptx" -> b.length > 4 && b[0] == 'P' && b[1] == 'K' && b[2] == 3 && b[3] == 4;
            case "mp4" -> b.length > 12 && b[4] == 'f' && b[5] == 't' && b[6] == 'y' && b[7] == 'p';
            default -> false;
        };
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
