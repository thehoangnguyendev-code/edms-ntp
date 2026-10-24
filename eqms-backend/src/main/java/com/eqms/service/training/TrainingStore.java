package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import com.eqms.service.AuditTrailService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** Small data-access helpers shared by the Training services: the activity row, the business events, and the audit entry that goes with a change. */
@Component
public class TrainingStore {
    public static final String OBJECT_ACTIVITY = "TRAINING_ACTIVITY";

    private final JdbcTemplate jdbc;
    private final AuditTrailService audit;
    private final ObjectMapper json = new ObjectMapper();

    public TrainingStore(JdbcTemplate jdbc, AuditTrailService audit) {
        this.jdbc = jdbc;
        this.audit = audit;
    }

    public Optional<Map<String, Object>> activity(UUID id) {
        List<Map<String, Object>> rows = jdbc.queryForList("select * from training_activities where id=?", id);
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.getFirst());
    }

    /** The row is locked until the end of the transaction: used before a status change. */
    public Optional<Map<String, Object>> activityForUpdate(UUID id) {
        List<Map<String, Object>> rows = jdbc.queryForList("select * from training_activities where id=? for update", id);
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.getFirst());
    }

    public Optional<Map<String, Object>> byRevision(UUID revisionId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "select * from training_activities where revision_id=? and parent_activity_id is null and status <> 'CANCELLED'", revisionId);
        if (rows.isEmpty()) {
            // A revision of a related document shares the Training Number (and the activity) of the document it goes with: the link is on the revision.
            rows = jdbc.queryForList("""
                select a.* from training_activities a join document_revisions r on r.training_activity_id = a.id
                 where r.id = ? and a.parent_activity_id is null and a.status <> 'CANCELLED'
                """, revisionId);
        }
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.getFirst());
    }

    /** The activity of a new document that is waiting for its first revision. */
    public Optional<Map<String, Object>> pendingByDocument(UUID documentId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "select * from training_activities where document_id=? and revision_id is null and parent_activity_id is null and status <> 'CANCELLED'", documentId);
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.getFirst());
    }

    public void event(String objectType, UUID objectId, UUID activityId, String type, Map<String, Object> payload, UUID actorId) {
        String body;
        try {
            body = payload == null ? null : json.writeValueAsString(payload);
        } catch (JsonProcessingException invalid) {
            body = null;
        }
        jdbc.update("insert into training_events(id, object_type, object_id, activity_id, event_type, payload, actor_user_id) values (?,?,?,?,?,cast(? as jsonb),?)",
                UUID.randomUUID(), objectType, objectId, activityId, type, body, actorId);
    }

    /** One Audit Trail entry about an activity; the entity id is never empty (the Audit Trail refuses an entry without it). */
    public void auditActivity(UserAccount actor, Map<String, Object> activity, String action, String from, String to, String comment) {
        audit.logAs(actor, OBJECT_ACTIVITY, String.valueOf(activity.get("training_number")), (UUID) activity.get("id"), action, from, to, comment);
    }

    /** The same, with the field-level changes the Audit Trail shows (before and after). */
    public void auditActivity(UserAccount actor, Map<String, Object> activity, String action, String from, String to, String comment, java.util.List<com.eqms.dto.audittrail.AuditTrailChangeResponse> changes) {
        audit.logAs(actor, OBJECT_ACTIVITY, String.valueOf(activity.get("training_number")), (UUID) activity.get("id"), action, from, to, comment, changes);
    }

    public void setStatus(UUID id, String status) {
        jdbc.update("update training_activities set status=?, version=version+1, updated_at=now() where id=?", status, id);
    }

    public void cancel(Map<String, Object> activity, String reason, UserAccount actor) {
        UUID id = (UUID) activity.get("id");
        String from = String.valueOf(activity.get("status"));
        jdbc.update("update training_activities set status='CANCELLED', cancel_reason=?, version=version+1, updated_at=now() where id=?", reason, id);
        event(OBJECT_ACTIVITY, id, id, "CANCELLED", Map.of("reason", reason, "from", from), actor == null ? null : actor.getId());
        auditActivity(actor, activity, "TRAINING_NUMBER_CANCELLED", from, "CANCELLED", reason);
    }

    public void open(Map<String, Object> activity, LocalDate approvedOn, LocalDate dueDate, UserAccount actor) {
        UUID id = (UUID) activity.get("id");
        jdbc.update("update training_activities set status='PLANNED', approved_on=?, due_date=?, version=version+1, updated_at=now() where id=?", approvedOn, dueDate, id);
        event(OBJECT_ACTIVITY, id, id, "OPENED", Map.of("approvedOn", approvedOn.toString(), "dueDate", dueDate.toString()), actor == null ? null : actor.getId());
        auditActivity(actor, activity, "TRAINING_ACTIVITY_OPENED", String.valueOf(activity.get("status")), "PLANNED",
                "Document approved; training due " + dueDate);
    }
}
