package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.AuditTrailService;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Who handles a review, approval or confirmation step (SDS-TR-001 section 8.5). Nothing is tied to a role name or an account: a step needs a permission, the
 * person who submits chooses any eligible user, and the server checks again when that user signs. The mode of a step is {@code DESIGNATED_REQUIRED} (only
 * the person designated may sign) or {@code ANY_ELIGIBLE} (any person who holds the permission may sign). The same service handles every object type that
 * has such a step; the object is described by a {@link Subject}.
 */
@Service
public class TrainingApprovalService {
    public static final String NOT_ELIGIBLE = "TRAINING_APPROVER_NOT_ELIGIBLE";
    public static final String SEGREGATION = "TRAINING_SEGREGATION_OF_DUTIES";

    /** What a step needs: the permission of the person, and the meaning of the electronic signature. */
    public record Step(String code, String permission, String meaning) {}

    /** The thing a step is about: its type, id, the department that owns it, a name for the Audit Trail, and the permission to designate for it. */
    public record Subject(String objectType, UUID id, UUID departmentId, String label, String designatePermission) {}

    private static final Map<String, Step> STEPS = Map.ofEntries(
            Map.entry("CONTENT_REVIEW", new Step("CONTENT_REVIEW", "training.content.review", "TRAINING_CONTENT_REVIEWED")),
            Map.entry("CONTENT_APPROVE", new Step("CONTENT_APPROVE", "training.content.approve", "TRAINING_CONTENT_APPROVED")),
            Map.entry("ACTIVITY_COMPLETE", new Step("ACTIVITY_COMPLETE", "training.activity.close", "TRAINING_COMPLETED")),
            Map.entry("MATRIX_APPROVE", new Step("MATRIX_APPROVE", "training.matrix.approve", "TRAINING_MATRIX_APPROVED")),
            Map.entry("JOB_ASSIGN_EXCEPTION", new Step("JOB_ASSIGN_EXCEPTION", "training.job_assignment.exception.approve", "TRAINING_JOB_EXCEPTION_APPROVED")),
            Map.entry("SPECIMEN_CONFIRM", new Step("SPECIMEN_CONFIRM", "training.signature.confirm", "TRAINING_SPECIMEN_APPROVED")),
            Map.entry("RECORD_EXPORT_APPROVE", new Step("RECORD_EXPORT_APPROVE", "training.record.export", "TRAINING_RECORD_APPROVED")),
            Map.entry("REQUIREMENT_REVIEW", new Step("REQUIREMENT_REVIEW", "training.requirement.review", "TRAINING_REQUIREMENT_REVIEWED")),
            Map.entry("REQUIREMENT_APPROVE", new Step("REQUIREMENT_APPROVE", "training.requirement.approve", "TRAINING_REQUIREMENT_APPROVED")),
            Map.entry("TRAINER_EXCEPTION", new Step("TRAINER_EXCEPTION", "training.trainer.exception.approve", "TRAINING_TRAINER_EXCEPTION_APPROVED")),
            Map.entry("LEGACY_EVIDENCE_VERIFY", new Step("LEGACY_EVIDENCE_VERIFY", "training.activity.close", "TRAINING_LEGACY_VERIFIED")));

    private final JdbcTemplate jdbc;
    private final TrainingAccess access;
    private final TrainingStore store;
    private final AuditTrailService audit;
    private final UserAccountRepository users;
    private final TrainingNotifier notifier;

    public TrainingApprovalService(JdbcTemplate jdbc, TrainingAccess access, TrainingStore store, AuditTrailService audit, UserAccountRepository users, TrainingNotifier notifier) {
        this.jdbc = jdbc;
        this.access = access;
        this.store = store;
        this.audit = audit;
        this.users = users;
        this.notifier = notifier;
    }

    /** The persons a step must be kept apart from, without failing when two of them are the same person. */
    public static Set<UUID> apart(UUID... ids) {
        Set<UUID> out = new java.util.HashSet<>();
        for (UUID id : ids) if (id != null) out.add(id);
        return out;
    }

    public Step step(String code) {
        Step step = code == null ? null : STEPS.get(code);
        if (step == null) throw new IllegalArgumentException("TRAINING_STEP_UNKNOWN");
        return step;
    }

    public static Subject activity(Map<String, Object> activity) {
        return new Subject("TRAINING_ACTIVITY", (UUID) activity.get("id"), (UUID) activity.get("organizer_department_id"), String.valueOf(activity.get("training_number")), "training.activity.organize");
    }

    public String mode(String stepCode) {
        List<String> rows = jdbc.queryForList("select designation_mode from training_approval_modes where step_code=?", String.class, stepCode);
        return rows.isEmpty() ? "DESIGNATED_REQUIRED" : rows.getFirst();
    }

    /** Is the person (still) able to handle the step for an object of the department, and not one of the persons the step must be kept apart from. */
    public boolean eligible(UserAccount person, Step step, UUID departmentId, Set<UUID> keptApart) {
        if (person == null || person.getStatus() != UserStatus.Active) return false;
        if (keptApart != null && keptApart.contains(person.getId())) return false;
        if (!access.codes(person).contains(step.permission())) return false;
        return access.inScope(person, departmentId);
    }

    /** The persons the submitter may choose from; the server decides who is on the list. */
    @Transactional(readOnly = true)
    public Map<String, Object> eligibleApprovers(UserAccount actor, Subject subject, String stepCode, String search, int page, int limit, Set<UUID> keptApart) {
        Step step = step(stepCode);
        access.requireScope(actor, subject.departmentId());
        access.require(actor, "training.approval.designate", subject.designatePermission());
        String needle = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        List<Map<String, Object>> all = new ArrayList<>();
        for (UserAccount candidate : users.findAll()) {
            if (candidate.getStatus() != UserStatus.Active) continue;
            if (!needle.isEmpty() && !(String.valueOf(candidate.getFullName()).toLowerCase(Locale.ROOT).contains(needle)
                    || String.valueOf(candidate.getUsername()).toLowerCase(Locale.ROOT).contains(needle))) continue;
            if (!eligible(candidate, step, subject.departmentId(), keptApart)) continue;
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", candidate.getId());
            row.put("fullName", candidate.getFullName());
            row.put("employeeCode", candidate.getEmployeeCode());
            row.put("department", candidate.getDepartment());
            row.put("position", candidate.getPosition());
            all.add(row);
        }
        all.sort((a, b) -> String.valueOf(a.get("fullName")).compareToIgnoreCase(String.valueOf(b.get("fullName"))));
        int safeLimit = Math.min(Math.max(limit, 1), 100);
        int safePage = Math.max(page, 1);
        int from = Math.min((safePage - 1) * safeLimit, all.size());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("data", all.subList(from, Math.min(from + safeLimit, all.size())));
        result.put("pagination", Map.of("page", safePage, "limit", safeLimit, "total", all.size(), "totalPages", Math.max(1, (all.size() + safeLimit - 1) / safeLimit)));
        return result;
    }

    /** The submitter chooses the person for a step. A person who is not eligible is refused; a step already designated is refused. */
    @Transactional
    public UUID designate(UserAccount actor, Subject subject, String stepCode, UUID assigneeId, Set<UUID> keptApart) {
        Step step = step(stepCode);
        access.requireScope(actor, subject.departmentId());
        access.require(actor, "training.approval.designate", subject.designatePermission());
        if (assigneeId == null) throw new IllegalArgumentException(NOT_ELIGIBLE);
        UserAccount assignee = users.findById(assigneeId).orElseThrow(() -> new IllegalArgumentException(NOT_ELIGIBLE));
        if (!eligible(assignee, step, subject.departmentId(), keptApart)) throw new IllegalArgumentException(NOT_ELIGIBLE);
        Integer open = jdbc.queryForObject("select count(*) from training_approval_assignments where object_type=? and object_id=? and step_code=? and status='PENDING'",
                Integer.class, subject.objectType(), subject.id(), stepCode);
        if (open != null && open > 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_APPROVER_ALREADY_DESIGNATED");
        UUID id = UUID.randomUUID();
        jdbc.update("insert into training_approval_assignments(id, object_type, object_id, step_code, assignee_user_id, assigned_by) values (?,?,?,?,?,?)",
                id, subject.objectType(), subject.id(), stepCode, assigneeId, actor.getId());
        store.event(subject.objectType(), subject.id(), "TRAINING_ACTIVITY".equals(subject.objectType()) ? subject.id() : null, "APPROVER_DESIGNATED",
                Map.of("step", stepCode, "assignee", assigneeId.toString()), actor.getId());
        audit.logAs(actor, subject.objectType(), subject.label(), subject.id(), "TRAINING_APPROVER_DESIGNATED", null, null, stepCode + " -> " + assignee.getFullName());
        notifier.send("TRAINING_STEP_ASSIGNED", assignee, actor, "Training: your action is needed",
                actor.getFullName() + " asked you to " + TrainingNotifier.stepText(stepCode) + ": " + subject.label() + ".", subject.objectType(), subject.id(), null);
        return id;
    }

    /** Hands a step over to another person (the person is away, left, or lost the permission). The reason is required and both persons are on record. */
    @Transactional
    public void reassign(UserAccount actor, Subject subject, UUID assignmentId, UUID newAssigneeId, String reason, Set<UUID> keptApart) {
        access.require(actor, "training.approval.reassign");
        access.requireScope(actor, subject.departmentId());
        if (reason == null || reason.isBlank()) throw new IllegalArgumentException("TRAINING_REASON_REQUIRED");
        Map<String, Object> row = jdbc.queryForList("select * from training_approval_assignments where id=? and object_id=? and status='PENDING' for update",
                assignmentId, subject.id()).stream().findFirst().orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "TRAINING_ASSIGNMENT_NOT_FOUND"));
        Step step = step(String.valueOf(row.get("step_code")));
        if (newAssigneeId == null) throw new IllegalArgumentException(NOT_ELIGIBLE);
        UserAccount next = users.findById(newAssigneeId).orElseThrow(() -> new IllegalArgumentException(NOT_ELIGIBLE));
        if (!eligible(next, step, subject.departmentId(), keptApart)) throw new IllegalArgumentException(NOT_ELIGIBLE);
        jdbc.update("update training_approval_assignments set status='REASSIGNED', reason=?, completed_at=now() where id=?", reason.trim(), assignmentId);
        jdbc.update("insert into training_approval_assignments(id, object_type, object_id, step_code, assignee_user_id, assigned_by) values (?,?,?,?,?,?)",
                UUID.randomUUID(), subject.objectType(), subject.id(), step.code(), newAssigneeId, actor.getId());
        store.event(subject.objectType(), subject.id(), "TRAINING_ACTIVITY".equals(subject.objectType()) ? subject.id() : null, "APPROVER_REASSIGNED",
                Map.of("step", step.code(), "from", String.valueOf(row.get("assignee_user_id")), "to", newAssigneeId.toString(), "reason", reason.trim()), actor.getId());
        audit.logAs(actor, subject.objectType(), subject.label(), subject.id(), "TRAINING_APPROVER_REASSIGNED", String.valueOf(row.get("assignee_user_id")), newAssigneeId.toString(), reason.trim());
        notifier.send("TRAINING_STEP_ASSIGNED", next, actor, "Training: your action is needed",
                actor.getFullName() + " handed over to you the task to " + TrainingNotifier.stepText(step.code()) + ": " + subject.label() + ".", subject.objectType(), subject.id(), null);
        users.findById((UUID) row.get("assignee_user_id")).ifPresent(previous -> notifier.send("TRAINING_STEP_REASSIGNED", previous, actor, "Training: task handed over",
                "You no longer have to " + TrainingNotifier.stepText(step.code()) + " for " + subject.label() + ". Reason: " + reason.trim(), subject.objectType(), subject.id(), null));
    }

    /**
     * Checks that the person may sign the step now (still holds the permission, still Active, not kept apart, and is the designated person when the step
     * is {@code DESIGNATED_REQUIRED}). Returns the assignment to close, or null for an {@code ANY_ELIGIBLE} step nobody was designated for.
     */
    @Transactional
    public UUID requireCanSign(UserAccount signer, Subject subject, String stepCode, Set<UUID> keptApart) {
        Step step = step(stepCode);
        if (!eligible(signer, step, subject.departmentId(), keptApart)) {
            if (keptApart != null && keptApart.contains(signer.getId())) throw new IllegalArgumentException(SEGREGATION);
            throw new IllegalArgumentException(NOT_ELIGIBLE);
        }
        List<Map<String, Object>> mine = jdbc.queryForList("select id from training_approval_assignments where object_type=? and object_id=? and step_code=? and status='PENDING' and assignee_user_id=? for update",
                subject.objectType(), subject.id(), stepCode, signer.getId());
        if (!mine.isEmpty()) return (UUID) mine.getFirst().get("id");
        if ("DESIGNATED_REQUIRED".equals(mode(stepCode))) throw new SecurityException(TrainingAccess.DENIED);
        return null;
    }

    @Transactional
    public void complete(UUID assignmentId, UUID signatureId) {
        if (assignmentId != null) jdbc.update("update training_approval_assignments set status='DONE', completed_at=now(), signature_id=? where id=?", signatureId, assignmentId);
    }

    /** The open assignments of an object are closed (for example when a matrix version is sent back to draft). */
    @Transactional
    public void cancelOpen(String objectType, UUID objectId, String reason) {
        jdbc.update("update training_approval_assignments set status='CANCELLED', completed_at=now(), reason=? where object_type=? and object_id=? and status='PENDING'", reason, objectType, objectId);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> assignments(String objectType, UUID objectId) {
        return jdbc.queryForList("""
            select a.id, a.step_code as "stepCode", a.assignee_user_id as "assigneeId", u.full_name as "assigneeName", a.status, a.assigned_at as "assignedAt", a.completed_at as "completedAt"
              from training_approval_assignments a join app_users u on u.id = a.assignee_user_id
             where a.object_type=? and a.object_id=? order by a.assigned_at
            """, objectType, objectId);
    }

    /** The work waiting for the person who is logged in (never another person). */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> myApprovals(UserAccount actor) {
        return jdbc.queryForList("""
            select a.id, a.step_code as "stepCode", a.object_type as "objectType", a.object_id as "objectId",
                   case a.object_type when 'TRAINING_ACTIVITY' then t.training_number when 'TRAINING_JOB_ASSIGNMENT' then 'JA #' || ja.issue_no when 'TRAINING_SPECIMEN_SIGNATURE' then 'Specimen #' || sp.version_no when 'TRAINING_RECORD_EXPORT' then 'Export' when 'TRAINING_RECORD_EXPORT_BATCH' then 'Batch export' when 'TRAINING_REQUIREMENT' then rq.request_no when 'TRAINING_LEGACY_EVIDENCE' then 'Legacy evidence' when 'TRAINING_TRAINER_EXCEPTION' then 'Trainer exception' else m.code || ' v' || mv.version_no end as "trainingNumber",
                   case a.object_type when 'TRAINING_ACTIVITY' then t.training_title when 'TRAINING_JOB_ASSIGNMENT' then 'Job assignment of ' || jau.full_name when 'TRAINING_SPECIMEN_SIGNATURE' then 'Specimen signature of ' || spu.full_name when 'TRAINING_RECORD_EXPORT' then 'Training record export of ' || exu.full_name when 'TRAINING_RECORD_EXPORT_BATCH' then 'Batch export of training records, ' || bxd.name || ' ' || bx.year when 'TRAINING_REQUIREMENT' then 'Training requirement ' || rq.request_no when 'TRAINING_LEGACY_EVIDENCE' then 'Legacy training evidence of ' || lev.document_number when 'TRAINING_TRAINER_EXCEPTION' then 'Trainer exception for ' || tea.training_number else 'Training matrix' end as "trainingTitle",
                   case a.object_type when 'TRAINING_ACTIVITY' then t.status when 'TRAINING_JOB_ASSIGNMENT' then ja.status when 'TRAINING_SPECIMEN_SIGNATURE' then sp.status when 'TRAINING_RECORD_EXPORT' then ex.status when 'TRAINING_RECORD_EXPORT_BATCH' then bx.status when 'TRAINING_REQUIREMENT' then rq.status when 'TRAINING_LEGACY_EVIDENCE' then lev.status when 'TRAINING_TRAINER_EXCEPTION' then te.status else mv.status end as status,
                   a.assigned_at as "assignedAt", coalesce(t.id, te.activity_id) as "activityId"
              from training_approval_assignments a
              left join training_activities t on a.object_type = 'TRAINING_ACTIVITY' and t.id = a.object_id
              left join training_matrix_versions mv on a.object_type = 'TRAINING_MATRIX_VERSION' and mv.id = a.object_id
              left join training_matrices m on m.id = mv.matrix_id
              left join training_job_assignments ja on a.object_type = 'TRAINING_JOB_ASSIGNMENT' and ja.id = a.object_id
              left join app_users jau on jau.id = ja.person_user_id
              left join training_specimen_signatures sp on a.object_type = 'TRAINING_SPECIMEN_SIGNATURE' and sp.id = a.object_id
              left join app_users spu on spu.id = sp.person_user_id
              left join training_record_exports ex on a.object_type = 'TRAINING_RECORD_EXPORT' and ex.id = a.object_id
              left join app_users exu on exu.id = ex.person_user_id
              left join training_record_export_batches bx on a.object_type = 'TRAINING_RECORD_EXPORT_BATCH' and bx.id = a.object_id
              left join departments bxd on bxd.id = bx.department_id
              left join training_requirements rq on a.object_type = 'TRAINING_REQUIREMENT' and rq.id = a.object_id
              left join training_legacy_evidence lev on a.object_type = 'TRAINING_LEGACY_EVIDENCE' and lev.id = a.object_id
              left join training_trainer_exceptions te on a.object_type = 'TRAINING_TRAINER_EXCEPTION' and te.id = a.object_id
              left join training_activities tea on tea.id = te.activity_id
             where a.assignee_user_id=? and a.status='PENDING' order by a.assigned_at limit 100
            """, actor.getId());
    }
}
