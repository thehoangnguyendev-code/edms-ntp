package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import com.eqms.repository.UserAccountRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * "Work suspended" after a failed assessment (SOP.0003 5.3.7, D-12). When a trainee does not pass, a flag is raised and the person, the unit heads and the organizer are told. It is a flag
 * and a notice: no other function is blocked. It is cleared only by itself, when the person passes the retraining (or passes the assessment again); nobody can resume the work by hand
 * (decision of the owner, 2026-11-23, replacing the earlier D-12 way of resuming). Every step is in the Audit Trail of the training activity.
 */
@Service
public class TrainingSuspensionService {
    static final String TYPE = "TRAINING_WORK_SUSPENSION";

    private final JdbcTemplate jdbc;
    private final TrainingAccess access;
    private final TrainingStore store;
    private final UserAccountRepository users;
    private final TrainingNotifier notifier;
    private final TrainingRecipients recipients;

    public TrainingSuspensionService(JdbcTemplate jdbc, TrainingAccess access, TrainingStore store, UserAccountRepository users,
                                     TrainingNotifier notifier, TrainingRecipients recipients) {
        this.jdbc = jdbc;
        this.access = access;
        this.store = store;
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
                name + " did not pass" + (percent == null ? "" : " (" + percent + "%)") + ". The work that depends on this training is suspended until the person is retrained and passes, or the head of the unit resumes it.",
                java.util.List.of(com.eqms.util.AuditChanges.of("Participant",null,name), com.eqms.util.AuditChanges.of("Score",null,percent == null ? null : percent + "%")));
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

    /**
     * The participant passed (a later attempt) or the person passed a retraining of the activity this one was made from. Every flag of the person that was raised in the same family (the original activity
     * and all its supplementary activities) ends: a person who failed the original, failed the first retraining too, and passed the second one has no flag left from the first retraining either.
     */
    @Transactional
    public void clearOnPass(UserAccount actor, Map<String, Object> activity, Map<String, Object> participant) {
        UUID person = (UUID) participant.get("person_user_id");
        if (person == null) return;
        UUID parent = (UUID) activity.get("parent_activity_id");
        UUID root = parent != null ? parent : (UUID) activity.get("id");
        List<Map<String, Object>> open = jdbc.queryForList("select id, activity_id from training_work_suspensions where status = 'OPEN' and (participant_id = ? or (person_user_id = ? and (activity_id = ? or activity_id in (select id from training_activities where parent_activity_id = ?))))",
                new Object[] {participant.get("id"), person, root, root});
        for (Map<String, Object> row : open) {
            int done = jdbc.update("update training_work_suspensions set status='CLEARED', cleared_at=now(), cleared_by=?, clear_basis='RETRAINED_PASSED', clear_activity_id=? where id=? and status='OPEN'",
                    actor == null ? null : actor.getId(), activity.get("id"), row.get("id"));
            if (done == 0) continue;
            Map<String, Object> original = store.activity((UUID) row.get("activity_id")).orElse(activity);
            store.auditActivity(actor, original, "TRAINING_WORK_SUSPENSION_CLEARED", "OPEN", "CLEARED",
                    participant.get("full_name") + " passed (" + activity.get("training_number") + "). The suspension ends because the retraining was passed.",
                java.util.List.of(com.eqms.util.AuditChanges.of("Participant",null,participant.get("full_name")), com.eqms.util.AuditChanges.of("Reason",null,"Retraining was passed")));
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
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("data", TrainingRows.camel(rows));
        long count = total == null ? 0 : total;
        result.put("pagination", Map.of("page", safePage, "limit", safeLimit, "total", count, "totalPages", Math.max(1, (count + safeLimit - 1) / safeLimit)));
        return result;
    }
}
