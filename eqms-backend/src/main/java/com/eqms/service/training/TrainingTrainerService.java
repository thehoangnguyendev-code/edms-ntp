package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import com.eqms.service.AuditTrailService;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.ElectronicSignatureService;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Who may train others (SOP.0003 TR-19). A trainer of the organisation is qualified for a session when the person has been trained on GMP and, for every topic
 * of the session, has been trained on it or takes part in its document (author, co-author, reviewer, approver), or holds the permission training.trainer.qualified that QA
 * grants (D-10; it replaced the rule about heading the organising department). A trainer who is not qualified can still be used when a person designated for the step approves an exception with a signature. A trainer from outside
 * the organisation is not judged here: the qualification of outside trainers is kept in the documents of the supplier.
 */
@Service
public class TrainingTrainerService {
    private static final String TYPE = "TRAINING_TRAINER_EXCEPTION";
    static final String QUALIFIED = "training.trainer.qualified";

    private final JdbcTemplate jdbc;
    private final TrainingAccess access;
    private final TrainingApprovalService approvals;
    private final ElectronicSignatureService signatures;
    private final AuditTrailService audit;
    private final TrainingStore store;
    private final UserAccountRepository users;

    public TrainingTrainerService(JdbcTemplate jdbc, TrainingAccess access, TrainingApprovalService approvals, ElectronicSignatureService signatures, AuditTrailService audit, TrainingStore store, UserAccountRepository users) {
        this.jdbc = jdbc;
        this.access = access;
        this.approvals = approvals;
        this.signatures = signatures;
        this.audit = audit;
        this.store = store;
        this.users = users;
    }

    public record ExceptionRequest(String reason, UUID approverUserId) {}
    public record SignRequest(String signatureToken) {}
    public record RejectRequest(String reason) {}

    /** What the trainer is missing for the session, computed from the training records, the documents and the department. */
    @Transactional(readOnly = true)
    public Map<String, Object> qualification(UUID sessionId) {
        Map<String, Object> session = jdbc.queryForList("select s.*, a.organizer_department_id from training_sessions s join training_activities a on a.id = s.activity_id where s.id=?", sessionId).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        Map<String, Object> out = new LinkedHashMap<>();
        UUID trainer = (UUID) session.get("trainer_user_id");
        if (trainer == null) {
            out.put("applies", false);
            out.put("qualified", true);
            out.put("reasons", List.of());
            return out;
        }
        boolean gmp = jdbc.queryForObject("""
            select count(*) from training_records r left join training_record_voids v on v.record_id = r.id
             where r.person_user_id=? and v.id is null and lower(r.topic_text) like '%gmp%'
            """, Integer.class, trainer) > 0;
        boolean grantedByQa = users.findById(trainer).map(u -> access.has(u, QUALIFIED)).orElse(false);
        List<Map<String, Object>> topics = new ArrayList<>();
        List<String> reasons = new ArrayList<>();
        if (!gmp) reasons.add("The trainer has no training record on GMP.");
        for (Map<String, Object> topic : jdbc.queryForList("select topic_text, document_id, document_number from training_session_topics where session_id=?", sessionId)) {
            boolean trained = jdbc.queryForObject("""
                select count(*) from training_records r left join training_record_voids v on v.record_id = r.id
                 where r.person_user_id=? and v.id is null and ((cast(? as varchar) is not null and r.document_number = cast(? as varchar)) or lower(r.topic_text) = lower(?))
                """, Integer.class, trainer, topic.get("document_number"), topic.get("document_number"), topic.get("topic_text")) > 0;
            boolean involved = topic.get("document_id") != null && jdbc.queryForObject("""
                select (select count(*) from documents d where d.id=? and d.author_user_id=?) + (select count(*) from document_workflow_participants p where p.document_id=? and p.user_id=?)
                """, Integer.class, topic.get("document_id"), trainer, topic.get("document_id"), trainer) > 0;
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("topic", topic.get("topic_text"));
            row.put("trained", trained);
            row.put("involved", involved);
            topics.add(row);
            if (!(trained || involved || grantedByQa)) reasons.add("The trainer was not trained on \"" + topic.get("topic_text") + "\" and does not take part in its document.");
        }
        out.put("applies", true);
        out.put("gmpTrained", gmp);
        out.put("qualifiedByPermission", grantedByQa);
        out.put("topics", topics);
        out.put("qualified", reasons.isEmpty());
        out.put("reasons", reasons);
        List<Map<String, Object>> ex = jdbc.queryForList("select id, status, reason, reject_reason from training_trainer_exceptions where session_id=? order by created_at desc limit 1", sessionId);
        out.put("exception", ex.isEmpty() ? null : TrainingRows.camel(ex.getFirst()));
        return out;
    }

    /** True when the session may go ahead with its trainer: qualified, or an exception approved, or not judged (outside trainer). */
    @Transactional(readOnly = true)
    public boolean cleared(UUID sessionId) {
        Map<String, Object> q = qualification(sessionId);
        if (Boolean.TRUE.equals(q.get("qualified"))) return true;
        @SuppressWarnings("unchecked")
        Map<String, Object> ex = (Map<String, Object>) q.get("exception");
        return ex != null && "APPROVED".equals(ex.get("status"));
    }

    @Transactional
    public Map<String, Object> requestException(UserAccount actor, UUID sessionId, ExceptionRequest request) {
        Map<String, Object> session = lockSession(sessionId);
        Map<String, Object> activity = activityOf(session);
        access.require(actor, "training.activity.organize");
        access.requireScope(actor, (UUID) activity.get("organizer_department_id"));
        if (!"PLANNED".equals(session.get("status")) || !java.util.Set.of("PLANNED", "NOTIFIED").contains(String.valueOf(activity.get("status")))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_ACTIVITY_INVALID_TRANSITION");
        if (request == null || request.reason() == null || request.reason().isBlank()) throw new IllegalArgumentException("TRAINING_REASON_REQUIRED");
        Map<String, Object> q = qualification(sessionId);
        if (Boolean.TRUE.equals(q.get("qualified"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_TRAINER_ALREADY_QUALIFIED");
        List<Map<String, Object>> existing = jdbc.queryForList("select id, status from training_trainer_exceptions where session_id=? and status in ('PENDING','APPROVED') for update", sessionId);
        if (!existing.isEmpty()) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_TRAINER_EXCEPTION_EXISTS");
        UUID id = UUID.randomUUID();
        UUID trainer = (UUID) session.get("trainer_user_id");
        jdbc.update("insert into training_trainer_exceptions(id, activity_id, session_id, trainer_user_id, reason, requested_by) values (?,?,?,?,?,?)", id, activity.get("id"), sessionId, trainer, request.reason().trim(), actor.getId());
        approvals.designate(actor, subject(activity, id), "TRAINER_EXCEPTION", request.approverUserId(), TrainingApprovalService.apart(actor.getId(), trainer));
        store.event(TrainingStore.OBJECT_ACTIVITY, id, (UUID) activity.get("id"), "TRAINER_EXCEPTION_REQUESTED", Map.of("session", sessionId.toString(), "reason", request.reason().trim()), actor.getId());
        store.auditActivity(actor, activity, "TRAINING_TRAINER_EXCEPTION_REQUESTED", null, null, "Session " + session.get("session_no") + ": " + request.reason().trim());
        return qualification(sessionId);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> eligibleApprovers(UserAccount actor, UUID sessionId, String search, int page, int limit) {
        Map<String, Object> session = jdbc.queryForList("select * from training_sessions where id=?", sessionId).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        Map<String, Object> activity = activityOf(session);
        return approvals.eligibleApprovers(actor, subject(activity, null), "TRAINER_EXCEPTION", search, page, limit, TrainingApprovalService.apart(actor.getId(), (UUID) session.get("trainer_user_id")));
    }

    @Transactional
    public Map<String, Object> approve(UserAccount actor, UUID exceptionId, SignRequest request) {
        Map<String, Object> e = lock(exceptionId);
        if (!"PENDING".equals(e.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_TRAINER_EXCEPTION_DECIDED");
        Map<String, Object> activity = store.activity((UUID) e.get("activity_id")).orElseThrow();
        UUID assignment = approvals.requireCanSign(actor, subject(activity, exceptionId), "TRAINER_EXCEPTION", TrainingApprovalService.apart((UUID) e.get("requested_by"), (UUID) e.get("trainer_user_id")));
        if (request == null || request.signatureToken() == null || request.signatureToken().isBlank()) throw new IllegalArgumentException("TRAINING_SIGNATURE_REQUIRED");
        UUID signature = signatures.createEntitySignature(TYPE, exceptionId, activity.get("training_number") + " trainer exception", actor, request.signatureToken(), "TRAINING_TRAINER_EXCEPTION_APPROVED",
                "Training Management: trainer exception approved", null, null, null).getId();
        approvals.complete(assignment, signature);
        jdbc.update("update training_trainer_exceptions set status='APPROVED', approved_by=?, signature_id=?, decided_at=now() where id=?", actor.getId(), signature, exceptionId);
        store.auditActivity(actor, activity, "TRAINING_TRAINER_EXCEPTION_APPROVED", "PENDING", "APPROVED", String.valueOf(e.get("reason")));
        return qualification((UUID) e.get("session_id"));
    }

    @Transactional
    public Map<String, Object> reject(UserAccount actor, UUID exceptionId, RejectRequest request) {
        Map<String, Object> e = lock(exceptionId);
        if (!"PENDING".equals(e.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_TRAINER_EXCEPTION_DECIDED");
        if (request == null || request.reason() == null || request.reason().isBlank()) throw new IllegalArgumentException("TRAINING_REASON_REQUIRED");
        Map<String, Object> activity = store.activity((UUID) e.get("activity_id")).orElseThrow();
        UUID assignment = approvals.requireCanSign(actor, subject(activity, exceptionId), "TRAINER_EXCEPTION", TrainingApprovalService.apart((UUID) e.get("requested_by"), (UUID) e.get("trainer_user_id")));
        approvals.complete(assignment, null);
        jdbc.update("update training_trainer_exceptions set status='REJECTED', approved_by=?, reject_reason=?, decided_at=now() where id=?", actor.getId(), request.reason().trim(), exceptionId);
        store.auditActivity(actor, activity, "TRAINING_TRAINER_EXCEPTION_REJECTED", "PENDING", "REJECTED", request.reason().trim());
        return qualification((UUID) e.get("session_id"));
    }

    private Map<String, Object> lock(UUID id) {
        return jdbc.queryForList("select * from training_trainer_exceptions where id=? for update", id).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
    }

    private Map<String, Object> lockSession(UUID id) {
        return jdbc.queryForList("select * from training_sessions where id=? for update", id).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
    }

    private Map<String, Object> activityOf(Map<String, Object> session) {
        return store.activity((UUID) session.get("activity_id")).orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
    }

    private TrainingApprovalService.Subject subject(Map<String, Object> activity, UUID id) {
        return new TrainingApprovalService.Subject(TYPE, id, (UUID) activity.get("organizer_department_id"), activity.get("training_number") + " trainer exception", "training.activity.organize");
    }
}
