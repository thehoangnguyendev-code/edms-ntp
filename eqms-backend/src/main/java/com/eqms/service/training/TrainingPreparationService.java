package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import com.eqms.repository.UserAccountRepository;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * What has to be ready before a session (SOP.0003 5.3.6, TR-35, proposal D-46): the venue, the equipment, the materials, and the notice to the trainees and the trainer.
 * The checklist of a session has four fixed items, each pending, done or not needed, with an optional person who has to do it. It warns; it never blocks a session.
 */
@Service
public class TrainingPreparationService {
    public static final List<String> ITEMS = List.of("VENUE", "EQUIPMENT", "MATERIALS", "NOTICE");
    private static final Set<String> STATES = Set.of("PENDING", "DONE", "NOT_NEEDED");

    public record UpdateRequest(String status, UUID assignedTo, String note) {}

    private final JdbcTemplate jdbc;
    private final TrainingAccess access;
    private final TrainingStore store;
    private final TrainingNotifier notifier;
    private final UserAccountRepository users;

    public TrainingPreparationService(JdbcTemplate jdbc, TrainingAccess access, TrainingStore store, TrainingNotifier notifier, UserAccountRepository users) {
        this.jdbc = jdbc;
        this.access = access;
        this.store = store;
        this.notifier = notifier;
        this.users = users;
    }

    /** The checklist of every open session of the activity. An item nobody touched is pending. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> get(UserAccount actor, UUID activityId) {
        access.require(actor, "training.activity.view", "training.activity.organize", "training.activity.conduct");
        UUID department = jdbc.queryForObject("select organizer_department_id from training_activities where id = ?", UUID.class, activityId);
        access.requireScope(actor, department);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> session : jdbc.queryForList("select id, session_no, status from training_sessions where activity_id = ? and status <> 'CANCELLED' order by session_no", activityId)) {
            Map<String, Map<String, Object>> stored = new LinkedHashMap<>();
            for (Map<String, Object> row : jdbc.queryForList("""
                select p.item_code, p.status, p.assigned_to, u.full_name as assigned_to_name, p.note, p.updated_at, w.full_name as updated_by_name
                  from training_session_preparation p left join app_users u on u.id = p.assigned_to left join app_users w on w.id = p.updated_by where p.session_id = ?
                """, session.get("id"))) stored.put((String) row.get("item_code"), row);
            List<Map<String, Object>> items = new ArrayList<>();
            int open = 0;
            for (String code : ITEMS) {
                Map<String, Object> row = stored.get(code);
                Map<String, Object> item = row == null ? new LinkedHashMap<>(Map.of("itemCode", code, "status", "PENDING")) : TrainingRows.camel(row);
                if ("PENDING".equals(item.get("status"))) open++;
                items.add(item);
            }
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("sessionId", session.get("id"));
            entry.put("sessionNo", session.get("session_no"));
            entry.put("sessionStatus", session.get("status"));
            entry.put("open", open);
            entry.put("items", items);
            out.add(entry);
        }
        return out;
    }

    /**
     * Fills in what the record already answers (owner decision 2026-11-23: Prepare Training fills everything the system can): the room is Done when the session has a place or a meeting link;
     * the materials when the training has material or comes from a document; the notice when the people were notified; the equipment is Not needed unless the session is practical, where only
     * a person can say. A line a person already set is never changed. Each line written says it came from the record and who pressed the button; the Audit Trail keeps the change.
     */
    @Transactional
    public List<Map<String, Object>> autoFill(UserAccount actor, UUID activityId) {
        access.require(actor, "training.activity.organize", "training.activity.conduct");
        Map<String, Object> activity = store.activityForUpdate(activityId).orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        access.requireScope(actor, (UUID) activity.get("organizer_department_id"));
        if (!"NOTIFIED".equals(activity.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_PREPARATION_NOT_NOTIFIED");
        List<String> written = new ArrayList<>();
        for (Map<String, Object> session : jdbc.queryForList("select * from training_sessions where activity_id = ? and status = 'PLANNED' order by session_no", activityId)) {
            UUID sessionId = (UUID) session.get("id");
            Integer materials = jdbc.queryForObject("select count(*) from training_materials where activity_id = ? and removed_at is null and purpose = 'CONTENT' and (session_id is null or session_id = ?)", Integer.class, activityId, sessionId);
            boolean haveMaterial = (materials != null && materials > 0) || activity.get("document_id") != null;
            String location = String.valueOf(session.get("location_type"));
            boolean place = ("ONLINE".equals(location) ? false : session.get("venue") != null && !String.valueOf(session.get("venue")).isBlank())
                    || (!"ONSITE".equals(location) && session.get("meeting_link") != null && !String.valueOf(session.get("meeting_link")).isBlank());
            Map<String, String> answers = new LinkedHashMap<>();
            if (place) answers.put("VENUE", "DONE");
            if (haveMaterial) answers.put("MATERIALS", "DONE");
            answers.put("NOTICE", "DONE");
            if (!"PRACTICAL".equals(session.get("method"))) answers.put("EQUIPMENT", "NOT_NEEDED");
            for (Map.Entry<String, String> answer : answers.entrySet()) {
                String current = jdbc.queryForList("select status from training_session_preparation where session_id = ? and item_code = ?", String.class, sessionId, answer.getKey()).stream().findFirst().orElse("PENDING");
                if (!"PENDING".equals(current)) continue;
                jdbc.update("""
                    insert into training_session_preparation(session_id, item_code, status, note, updated_by, updated_at) values (?,?,?,?,?, now())
                    on conflict (session_id, item_code) do update set status = excluded.status, note = excluded.note, updated_by = excluded.updated_by, updated_at = now()
                    """, sessionId, answer.getKey(), answer.getValue(), "Filled in from the record", actor.getId());
                written.add("S" + session.get("session_no") + " " + TrainingStore.words(answer.getKey()) + ": " + TrainingStore.words(answer.getValue()));
            }
        }
        if (!written.isEmpty()) store.auditActivity(actor, activity, "TRAINING_PREPARATION_FILLED", null, null, "Filled in from the record: " + String.join("; ", written),
                List.of(new com.eqms.dto.audittrail.AuditTrailChangeResponse("Preparation Filled In From The Record", null, String.valueOf(written.size()))));
        return get(actor, activityId);
    }

    @Transactional
    public List<Map<String, Object>> update(UserAccount actor, UUID sessionId, String itemCode, UpdateRequest request) {
        if (itemCode == null || !ITEMS.contains(itemCode)) throw new IllegalArgumentException("TRAINING_PREPARATION_ITEM_INVALID");
        if (request == null || request.status() == null || !STATES.contains(request.status())) throw new IllegalArgumentException("TRAINING_PREPARATION_STATUS_INVALID");
        Map<String, Object> session = jdbc.queryForList("select s.activity_id, s.session_no, s.status, a.organizer_department_id from training_sessions s join training_activities a on a.id = s.activity_id where s.id = ?", sessionId)
                .stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        UUID activityId = (UUID) session.get("activity_id");
        Map<String, Object> activity = store.activityForUpdate(activityId).orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        Map<String, Object> current = jdbc.queryForList("select assigned_to from training_session_preparation where session_id = ? and item_code = ?", sessionId, itemCode).stream().findFirst().orElse(null);
        UUID currentAssignee = current == null ? null : (UUID) current.get("assigned_to");
        // The organizer or the conductor may change everything; the person the item was given to may only report it done or not needed.
        boolean manager = access.has(actor, "training.activity.organize") || access.has(actor, "training.activity.conduct");
        boolean assignee = actor.getId().equals(currentAssignee);
        if (manager) access.requireScope(actor, (UUID) session.get("organizer_department_id"));
        else if (!assignee) throw new SecurityException(TrainingAccess.DENIED);
        if (Set.of("COMPLETED", "CANCELLED", "RESERVED").contains(String.valueOf(activity.get("status")))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_ACTIVITY_CLOSED");
        if (!"PLANNED".equals(session.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_PREPARATION_SESSION_CLOSED");
        UUID assignedTo = manager ? request.assignedTo() : currentAssignee;
        if (assignedTo != null && !assignedTo.equals(currentAssignee)) {
            Integer ok = jdbc.queryForObject("select count(*) from app_users where id = ? and status = 'Active'", Integer.class, assignedTo);
            if (ok == null || ok == 0) throw new IllegalArgumentException("TRAINING_PREPARATION_ASSIGNEE_INVALID");
        }
        String note = request.note() == null || request.note().isBlank() ? null : request.note().trim();
        if (note != null && note.length() > 500) throw new IllegalArgumentException("TRAINING_NOTE_TOO_LONG");
        String previousStatus = jdbc.queryForList("select status from training_session_preparation where session_id = ? and item_code = ?", String.class, sessionId, itemCode)
                .stream().findFirst().orElse(null);
        jdbc.update("""
            insert into training_session_preparation(session_id, item_code, status, assigned_to, note, updated_by, updated_at) values (?,?,?,?,?,?, now())
            on conflict (session_id, item_code) do update set status = excluded.status, assigned_to = excluded.assigned_to, note = excluded.note, updated_by = excluded.updated_by, updated_at = now()
            """, sessionId, itemCode, request.status(), assignedTo, note, actor.getId());
        String itemField = "Session S" + session.get("session_no") + " › " + TrainingStore.words(itemCode);
        List<com.eqms.dto.audittrail.AuditTrailChangeResponse> preparationChanges = new ArrayList<>();
        preparationChanges.add(new com.eqms.dto.audittrail.AuditTrailChangeResponse(itemField + " › Status",
                previousStatus == null ? null : TrainingStore.words(previousStatus), TrainingStore.words(request.status())));
        if (note != null) preparationChanges.add(new com.eqms.dto.audittrail.AuditTrailChangeResponse(itemField + " › Note", null, note));
        store.auditActivity(actor, activity, "TRAINING_PREPARATION_UPDATED", null, request.status(), "Session S" + session.get("session_no") + ", " + TrainingStore.words(itemCode) + (note == null ? "" : ". " + note), preparationChanges);
        if (assignedTo != null && !assignedTo.equals(currentAssignee) && !assignedTo.equals(actor.getId())) {
            users.findById(assignedTo).ifPresent(person -> notifier.send("TRAINING_PREPARATION_ASSIGNED", person, actor, "Preparation for training " + activity.get("training_number"),
                    "You were asked to prepare: " + itemCode.toLowerCase() + " for session " + session.get("session_no") + " of " + activity.get("training_topics") + ".", "TRAINING_ACTIVITY", activityId, null));
        }
        return get(actor, activityId);
    }
}
