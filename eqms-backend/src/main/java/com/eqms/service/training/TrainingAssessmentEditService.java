package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.EntityChangeBroadcaster;
import com.eqms.service.OnlyOfficeDocumentEditService;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * The exam template and the answer key of an activity, written in OnlyOffice. A person who prepares the activity starts from the current form template (for example
 * APD.0009), from the file that is already there, or, for the answer key, from a copy of the exam template; the editor saves into the activity as a new file of the same
 * purpose, and the file that was there stays on record, marked as removed. It works only while the content has not been sent to review (the same rule as an upload).
 * The document server reaches this service through two calls that carry no session, each with a token that names the edit session (see OnlyOfficeController).
 */
@Service
public class TrainingAssessmentEditService {
    private static final Logger log = LoggerFactory.getLogger(TrainingAssessmentEditService.class);
    private static final Set<String> DOCX = Set.of("docx");
    private static final long STALE_HOURS = 12;

    public record OpenRequest(String purpose, String source, UUID templateId) {}

    private final JdbcTemplate jdbc;
    private final TrainingAccess access;
    private final TrainingStore store;
    private final TrainingFileService files;
    private final OnlyOfficeDocumentEditService onlyOffice;
    private final UserAccountRepository users;

    public TrainingAssessmentEditService(JdbcTemplate jdbc, TrainingAccess access, TrainingStore store, TrainingFileService files, OnlyOfficeDocumentEditService onlyOffice, UserAccountRepository users) {
        this.jdbc = jdbc;
        this.access = access;
        this.store = store;
        this.files = files;
        this.onlyOffice = onlyOffice;
        this.users = users;
    }

    private boolean contentReviewed(UUID activityId) {
        Integer count = jdbc.queryForObject("select count(*) from training_activity_confirmations where activity_id = ? and kind = 'CONTENT_REVIEWED'", Integer.class, activityId);
        return count != null && count > 0;
    }

    private static String safeName(String value) {
        return value.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "-").trim();
    }

    /** Opens (or joins) the edit session of a purpose and returns the editor configuration signed for the document server. */
    @Transactional
    public Map<String, Object> open(UserAccount actor, UUID activityId, OpenRequest request) {
        Map<String, Object> activity = store.activityForUpdate(activityId).orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        access.require(actor, "training.activity.organize");
        access.requireScope(actor, (UUID) activity.get("organizer_department_id"));
        if (!Set.of("PLANNED", "NOTIFIED").contains(String.valueOf(activity.get("status")))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_ACTIVITY_INVALID_TRANSITION");
        if (contentReviewed(activityId)) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_CONTENT_ALREADY_REVIEWED");
        if ("EXTERNAL".equals(activity.get("kind"))) throw new IllegalArgumentException("TRAINING_FILE_REJECTED");
        if (request == null || request.purpose() == null || !Set.of("EXAM", "ANSWER_KEY").contains(request.purpose())) throw new IllegalArgumentException("TRAINING_FILE_REJECTED");
        if (!onlyOffice.isConfigured()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "TRAINING_EDITOR_UNAVAILABLE");
        String purpose = request.purpose();

        Map<String, Object> session = jdbc.queryForList("select * from training_edit_sessions where activity_id = ? and purpose = ? and status = 'OPEN' for update", activityId, purpose).stream().findFirst().orElse(null);
        if (session != null) {
            java.sql.Timestamp opened = (java.sql.Timestamp) session.get("opened_at");
            if (opened.toInstant().isBefore(java.time.Instant.now().minus(java.time.Duration.ofHours(STALE_HOURS)))) {
                jdbc.update("update training_edit_sessions set status = 'CLOSED' where id = ?", session.get("id"));
                session = null;
            }
        }
        if (session == null) session = create(actor, activity, purpose, request);
        UUID sessionId = (UUID) session.get("id");
        String fileName = String.valueOf(session.get("file_name"));
        ObjectNode config = onlyOffice.buildTrainingEditConfig(sessionId, "training-edit-" + sessionId, fileName, actor);
        store.auditActivity(actor, activity, "TRAINING_ASSESSMENT_EDIT_OPENED", null, null, ("EXAM".equals(purpose) ? "Exam template" : "Answer key") + ": " + fileName);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("config", config);
        out.put("fileName", fileName);
        out.put("purpose", purpose);
        return out;
    }

    private Map<String, Object> create(UserAccount actor, Map<String, Object> activity, String purpose, OpenRequest request) {
        UUID activityId = (UUID) activity.get("id");
        String source = request.source() == null ? "" : request.source();
        byte[] bytes;
        String name;
        String kind;
        UUID ref;
        String number = safeName(String.valueOf(activity.get("training_number")));
        switch (source) {
            case "TEMPLATE" -> {
                if (!"EXAM".equals(purpose) || request.templateId() == null) throw new IllegalArgumentException("TRAINING_FILE_REJECTED");
                Map<String, Object> t = jdbc.queryForList("select * from training_form_templates where id = ? and status = 'ENABLED'", request.templateId()).stream().findFirst()
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_TEMPLATE_NOT_ENABLED"));
                bytes = files.readStored(String.valueOf(t.get("provider")), String.valueOf(t.get("stored_path")), String.valueOf(t.get("sha256")));
                name = safeName(t.get("code") + " - " + number) + ".docx";
                kind = "TEMPLATE";
                ref = (UUID) t.get("id");
            }
            case "EXISTING" -> {
                Map<String, Object> m = activeMaterial(activityId, purpose);
                bytes = files.readStored(String.valueOf(m.get("provider")), String.valueOf(m.get("stored_path")), String.valueOf(m.get("sha256")));
                name = String.valueOf(m.get("original_name"));
                kind = "MATERIAL";
                ref = (UUID) m.get("id");
            }
            case "EXAM_COPY" -> {
                if (!"ANSWER_KEY".equals(purpose)) throw new IllegalArgumentException("TRAINING_FILE_REJECTED");
                Map<String, Object> m = activeMaterial(activityId, "EXAM");
                bytes = files.readStored(String.valueOf(m.get("provider")), String.valueOf(m.get("stored_path")), String.valueOf(m.get("sha256")));
                name = safeName("Answer key - " + number) + ".docx";
                kind = "MATERIAL";
                ref = (UUID) m.get("id");
            }
            default -> throw new IllegalArgumentException("TRAINING_FILE_REJECTED");
        }
        if (!name.toLowerCase(Locale.ROOT).endsWith(".docx")) throw new IllegalArgumentException("TRAINING_FILE_REJECTED");
        UUID id = UUID.randomUUID();
        TrainingFileService.StoredFile stored = files.storeBytes(bytes, name, "training/edit-sessions/" + id, DOCX);
        jdbc.update("""
            insert into training_edit_sessions(id, activity_id, purpose, source_kind, source_ref, file_name, provider, stored_path, sha256, opened_by) values (?,?,?,?,?,?,?,?,?,?)
            """, id, activityId, purpose, kind, ref, name, stored.provider(), stored.path(), stored.sha256(), actor.getId());
        return jdbc.queryForList("select * from training_edit_sessions where id = ?", id).getFirst();
    }

    private Map<String, Object> activeMaterial(UUID activityId, String purpose) {
        return jdbc.queryForList("select * from training_materials where activity_id = ? and purpose = ? and removed_at is null and link_url is null and lower(original_name) like '%.docx' order by created_at desc limit 1", activityId, purpose)
                .stream().findFirst().orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_EDIT_SOURCE_MISSING"));
    }

    /** What the document server fetches when it opens the session: the file as it was last saved (or as the session started). */
    @Transactional(readOnly = true)
    public byte[] bytesForEditor(UUID sessionId) {
        Map<String, Object> s = jdbc.queryForList("select * from training_edit_sessions where id = ?", sessionId).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        return files.readStored(String.valueOf(s.get("provider")), String.valueOf(s.get("stored_path")), String.valueOf(s.get("sha256")));
    }

    /**
     * A save reported by the document server: the edited file becomes the new file of the activity for the purpose. {@code closing} is true when the last editor left, which
     * also closes the session. A save that comes after the content was sent to review is not accepted.
     */
    @Transactional
    public void applySave(UUID sessionId, byte[] edited, UUID editorId, boolean closing) {
        Map<String, Object> s = jdbc.queryForList("select * from training_edit_sessions where id = ? for update", sessionId).stream().findFirst().orElse(null);
        if (s == null || !"OPEN".equals(s.get("status"))) return;
        UUID activityId = (UUID) s.get("activity_id");
        Map<String, Object> activity = store.activityForUpdate(activityId).orElse(null);
        if (activity == null || !Set.of("PLANNED", "NOTIFIED").contains(String.valueOf(activity.get("status"))) || contentReviewed(activityId)) {
            log.warn("A save of the edit session {} was not accepted: the content of the activity is no longer open", sessionId);
            jdbc.update("update training_edit_sessions set status = 'CLOSED' where id = ?", sessionId);
            return;
        }
        UUID editor = editorId != null && users.existsById(editorId) ? editorId : (UUID) s.get("opened_by");
        String purpose = String.valueOf(s.get("purpose"));
        UUID materialId = UUID.randomUUID();
        TrainingFileService.StoredFile stored = files.storeBytes(edited, String.valueOf(s.get("file_name")), "training/materials/" + activityId + "/" + materialId, DOCX);
        if (stored.sha256().equals(s.get("sha256"))) {
            if (closing) jdbc.update("update training_edit_sessions set status = 'CLOSED' where id = ?", sessionId);
            return;
        }
        jdbc.update("insert into training_materials(id, activity_id, title, purpose, original_name, provider, stored_path, content_type, size_bytes, sha256, uploaded_by) values (?,?,?,?,?,?,?,?,?,?,?)",
                materialId, activityId, stored.name(), purpose, stored.name(), stored.provider(), stored.path(), stored.contentType(), stored.size(), stored.sha256(), editor);
        jdbc.update("update training_materials set removed_at = now(), removed_by = ?, remove_reason = 'Replaced by a newer save in the editor' where activity_id = ? and purpose = ? and removed_at is null and id <> ?",
                editor, activityId, purpose, materialId);
        jdbc.update("update training_edit_sessions set provider = ?, stored_path = ?, sha256 = ?, last_saved_at = now(), saved_material_id = ?, status = ? where id = ?",
                stored.provider(), stored.path(), stored.sha256(), materialId, closing ? "CLOSED" : "OPEN", sessionId);
        UserAccount who = users.findById(editor).orElse(null);
        if (who != null) store.auditActivity(who, activity, "TRAINING_ASSESSMENT_EDIT_SAVED", null, null, ("EXAM".equals(purpose) ? "Exam template" : "Answer key") + " saved: " + stored.name() + " (SHA-256 " + stored.sha256().substring(0, 12) + ")");
        store.event(TrainingStore.OBJECT_ACTIVITY, materialId, activityId, "MATERIAL_EDITED", Map.of("name", stored.name(), "sha256", stored.sha256()), editor);
        EntityChangeBroadcaster.changed("TRAINING", materialId, null);
    }

    /** The last editor left without a change (or the document server dropped the session): the session is closed. */
    @Transactional
    public void close(UUID sessionId) {
        jdbc.update("update training_edit_sessions set status = 'CLOSED' where id = ? and status = 'OPEN'", sessionId);
    }
}
