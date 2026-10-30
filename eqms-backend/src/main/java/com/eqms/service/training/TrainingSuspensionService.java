package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.ElectronicSignatureService;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * "Work suspended" after a failed assessment (SOP.0003 5.3.7, D-12). When a trainee does not pass, a flag is raised and the person, the unit heads and the organizer are told. It is a flag
 * and a notice: no other function is blocked. It is cleared by itself when the person passes the retraining (or passes the assessment again), or by the head of the unit with a
 * reason and an electronic signature. Every step is in the Audit Trail of the training activity.
 */
@Service
public class TrainingSuspensionService {
    static final String TYPE = "TRAINING_WORK_SUSPENSION";
    public record ResumeRequest(String reason, String signatureToken) {}

    private final JdbcTemplate jdbc;
    private final TrainingAccess access;
    private final TrainingStore store;
    private final ElectronicSignatureService signatures;
    private final UserAccountRepository users;
    private final TrainingNotifier notifier;
    private final TrainingRecipients recipients;

    public TrainingSuspensionService(JdbcTemplate jdbc, TrainingAccess access, TrainingStore store, ElectronicSignatureService signatures, UserAccountRepository users,
                                     TrainingNotifier notifier, TrainingRecipients recipients) {
        this.jdbc = jdbc;
        this.access = access;
        this.store = store;
        this.signatures = signatures;
        this.users = users;
        this.notifier = notifier;
        this.recipients = recipients;
    }

    /** A trainee did not pass. A second failure of the same participant changes nothing: the flag is already up. */
    @Transactional
    public void raise(UserAccount actor, Map<String, Object> activity, Map<String, Object> participant, BigDecimal percent) {
        UUID person = (UUID) participant.get("person_user_id");
        if (person == null) return;
        UUID id = UUID.randomUUID();
        String topic = jdbc.queryForList("select string_agg(topic_text, '; ') from training_session_topics where session_id=?", String.class, participant.get("session_id")).stream().findFirst().orElse(null);
        int raised = jdbc.update("""
            insert into training_work_suspensions(id, person_user_id, activity_id, participant_id, topic_text, percent, raised_by) values (?,?,?,?,?,?,?)
            on conflict (participant_id) where status = 'OPEN' do nothing
            """, id, person, activity.get("id"), participant.get("id"), topic == null ? String.valueOf(activity.get("training_topics")) : (topic.length() > 500 ? topic.substring(0, 500) : topic), percent, actor == null ? null : actor.getId());
        if (raised == 0) return;
        UUID activityId = (UUID) activity.get("id");
        String name = String.valueOf(participant.get("full_name"));
        store.event(TrainingStore.OBJECT_ACTIVITY, activityId, activityId, "WORK_SUSPENSION_RAISED", Map.of("person", name), actor == null ? null : actor.getId());
        store.auditActivity(actor, activity, "TRAINING_WORK_SUSPENSION_RAISED", null, "OPEN",
                name + " did not pass" + (percent == null ? "" : " (" + percent + "%)") + ". The work that depends on this training is suspended until the person is retrained and passes, or the head of the unit resumes it.");
        UserAccount trainee = users.findById(person).orElse(null);
        String title = "Training: retraining required";
        if (trainee != null) {
            notifier.send("TRAINING_WORK_SUSPENDED", trainee, actor, title, "You did not pass the assessment of " + activity.get("training_topics") + " (" + activity.get("training_number")
                    + "). Retraining is arranged; the work that depends on this training is suspended until you pass.", TrainingStore.OBJECT_ACTIVITY, activityId, "suspension:" + id + ":person");
            for (UserAccount head : recipients.holders("training.job_assignment.manage", access.departmentOf(trainee))) {
                if (head.getId().equals(person)) continue;
                notifier.send("TRAINING_WORK_SUSPENDED", head, actor, "Training: work suspended after a failed assessment",
                        name + " did not pass the assessment of " + activity.get("training_topics") + " (" + activity.get("training_number") + "). The work that depends on this training is suspended until the retraining is passed.",
                        "TRAINING_COMPLIANCE_SUSPENSIONS", access.departmentOf(trainee), "suspension:" + id + ":" + head.getId());
            }
        }
    }

    /** The participant passed (a later attempt) or the person passed the retraining of the activity this one was made from. */
    @Transactional
    public void clearOnPass(UserAccount actor, Map<String, Object> activity, Map<String, Object> participant) {
        UUID person = (UUID) participant.get("person_user_id");
        if (person == null) return;
        UUID parent = (UUID) activity.get("parent_activity_id");
        List<Map<String, Object>> open = jdbc.queryForList("select id, activity_id from training_work_suspensions where status = 'OPEN' and (participant_id = ?" + (parent == null ? ")" : " or (person_user_id = ? and activity_id = ?))"),
                parent == null ? new Object[] {participant.get("id")} : new Object[] {participant.get("id"), person, parent});
        for (Map<String, Object> row : open) {
            int done = jdbc.update("update training_work_suspensions set status='CLEARED', cleared_at=now(), cleared_by=?, clear_basis='RETRAINED_PASSED', clear_activity_id=? where id=? and status='OPEN'",
                    actor == null ? null : actor.getId(), activity.get("id"), row.get("id"));
            if (done == 0) continue;
            Map<String, Object> original = store.activity((UUID) row.get("activity_id")).orElse(activity);
            store.auditActivity(actor, original, "TRAINING_WORK_SUSPENSION_CLEARED", "OPEN", "CLEARED",
                    participant.get("full_name") + " passed (" + activity.get("training_number") + "). The suspension ends because the retraining was passed.");
        }
    }

    private UUID departmentOfPerson(UUID personId) {
        return users.findById(personId).map(access::departmentOf).orElse(null);
    }

    /** The suspensions of the people of a department, newest first. */
    @Transactional(readOnly = true)
    public Map<String, Object> list(UserAccount actor, UUID departmentId, String status, String search, String sortBy, String sortDirection, int page, int limit) {
        access.require(actor, "training.compliance.view");
        UUID department = departmentId != null ? departmentId : access.departmentOf(actor);
        if (department == null) throw new IllegalArgumentException("TRAINING_DEPARTMENT_REQUIRED");
        access.requireScope(actor, department);
        List<Object> args = new ArrayList<>();
        args.add(department);
        StringBuilder where = new StringBuilder(" where 1=1");
        if (status != null && !status.isBlank()) {
            if (!List.of("OPEN", "CLEARED").contains(status)) throw new IllegalArgumentException("TRAINING_STATUS_INVALID");
            where.append(" and s.status = ?");
            args.add(status);
        }
        if (search != null && !search.isBlank()) {
            String like = "%" + search.trim().toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
            where.append(" and (lower(u.full_name) like ? escape '\\' or lower(coalesce(u.employee_code,'')) like ? escape '\\' or lower(coalesce(u.position,'')) like ? escape '\\' or lower(coalesce(s.topic_text,'')) like ? escape '\\' or lower(a.training_number) like ? escape '\\')");
            for (int i = 0; i < 5; i++) args.add(like);
        }
        String from = " from training_work_suspensions s join app_users u on u.id = s.person_user_id join training_activities a on a.id = s.activity_id"
                + " join departments d on lower(trim(d.name)) = lower(trim(u.department)) and d.id = ? left join app_users cu on cu.id = s.cleared_by left join training_activities ca on ca.id = s.clear_activity_id";
        int safeLimit = Math.min(Math.max(limit, 1), 100), safePage = Math.max(page, 1);
        Long total = jdbc.queryForObject("select count(*)" + from + where, Long.class, args.toArray());
        args.add(safeLimit);
        args.add((safePage - 1) * safeLimit);
        // The department is the first argument of the join, the filters follow it.
        List<Map<String, Object>> rows = jdbc.queryForList("select s.id, s.person_user_id, u.full_name, u.employee_code, u.avatar, u.position, a.id as activity_id, a.training_number, s.topic_text, s.percent, s.status, s.raised_at,"
                + " s.cleared_at, s.clear_basis, s.clear_reason, cu.full_name as cleared_by_name, ca.training_number as clear_training_number" + from + where
                + TrainingRows.orderBy(sortBy, sortDirection, Map.of("fullName", "u.full_name", "employeeCode", "u.employee_code", "position", "u.position", "trainingNumber", "a.training_number", "topic", "s.topic_text",
                        "percent", "s.percent", "status", "s.status", "raisedAt", "s.raised_at", "clearedAt", "s.cleared_at"), "s.raised_at desc") + " limit ? offset ?", args.toArray());
        boolean manage = access.has(actor, "training.job_assignment.manage");
        for (Map<String, Object> row : rows) row.put("can_resume", manage && "OPEN".equals(row.get("status")) && !actor.getId().equals(row.get("person_user_id")));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("data", TrainingRows.camel(rows));
        long count = total == null ? 0 : total;
        result.put("pagination", Map.of("page", safePage, "limit", safeLimit, "total", count, "totalPages", Math.max(1, (count + safeLimit - 1) / safeLimit)));
        return result;
    }

    /** The head of the unit decides that the work may resume: a reason and an electronic signature, never the person concerned. */
    @Transactional
    public Map<String, Object> resume(UserAccount actor, UUID id, ResumeRequest request) {
        Map<String, Object> row = jdbc.queryForList("select * from training_work_suspensions where id=? for update", id).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        access.require(actor, "training.job_assignment.manage");
        UUID person = (UUID) row.get("person_user_id");
        access.requireScope(actor, departmentOfPerson(person));
        if (!"OPEN".equals(row.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_SUSPENSION_NOT_OPEN");
        if (actor.getId().equals(person)) throw new IllegalArgumentException(TrainingApprovalService.SEGREGATION);
        if (request == null || request.reason() == null || request.reason().isBlank()) throw new IllegalArgumentException("TRAINING_REASON_REQUIRED");
        if (request.signatureToken() == null || request.signatureToken().isBlank()) throw new IllegalArgumentException("TRAINING_SIGNATURE_REQUIRED");
        Map<String, Object> activity = store.activity((UUID) row.get("activity_id")).orElseThrow();
        UUID signature = signatures.createEntitySignature(TYPE, id, activity.get("training_number") + " work suspension", actor, request.signatureToken(), "TRAINING_WORK_RESUMED",
                "Training Management: work resumed after a failed assessment", null, null, null).getId();
        jdbc.update("update training_work_suspensions set status='CLEARED', cleared_at=now(), cleared_by=?, clear_basis='RESUMED_BY_HEAD', clear_reason=?, signature_id=? where id=?", actor.getId(), request.reason().trim(), signature, id);
        String name = users.findById(person).map(UserAccount::getFullName).orElse(String.valueOf(person));
        store.auditActivity(actor, activity, "TRAINING_WORK_SUSPENSION_CLEARED", "OPEN", "CLEARED", name + ": work resumed by " + actor.getFullName() + ". Reason: " + request.reason().trim());
        users.findById(person).ifPresent(p -> notifier.send("TRAINING_WORK_RESUMED", p, actor, "Training: work resumed", "The head of your unit decided that the work suspended after the assessment of "
                + activity.get("training_topics") + " may resume.", TrainingStore.OBJECT_ACTIVITY, (UUID) activity.get("id"), "resume:" + id));
        return Map.of("id", id, "status", "CLEARED");
    }
}
