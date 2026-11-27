package com.eqms.service.training;

import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.UserAccount;
import com.eqms.service.TrainingRevisionHooks;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Training's side of the door with Document Control (SDS-TR-001 section 6). When a document or revision that requires training is saved, an activity with a
 * Training Number is created for the revision (never for the document); when the revision is approved the activity opens with its due date; when the
 * training is complete Document Control may let "Complete Training" through. Everything runs inside the transaction of the document save, so a failure rolls
 * both back: there is no silent fall back to manual dates.
 */
@Service
public class TrainingDocumentIntegrationService implements TrainingRevisionHooks {
    public static final String MODE_INTEGRATED = "INTEGRATED";
    public static final String MODE_MANUAL = "MANUAL";
    /**
     * A revision of a related document that needs no training of its own and was published with the document whose training covered it (DEC-TRAINING-2026-11-24-8): it carries the Training
     * Number, the day and the link of that training as evidence, and nothing is asked of it (no Complete Training, no activity of its own).
     */
    public static final String MODE_COVERED = "COVERED";
    public static final String ORIGIN_LEGACY = "LEGACY_IMPORT";

    /** The statuses of a revision that is approved (Pending Training and after): the activity of a group opens when every revision of the group is there. */
    private static final Set<String> APPROVED = Set.of("PENDING_TRAINING", "READY_FOR_PUBLISHING", "EFFECTIVE");
    private static final Set<String> ENDED = Set.of("CLOSED_CANCELLED", "OBSOLETED");

    private final JdbcTemplate jdbc;
    private final TrainingStore store;
    private final TrainingNumberService numbers;
    private final TrainingSettingsService settings;
    @PersistenceContext
    private EntityManager entityManager;
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.eqms.service.PermissionEvaluationService permissions;
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.eqms.auth.CurrentUserService currentUsers;

    /** What the person typed during this document save (empty string = a screen that offers the field but nothing was typed); null outside such a save. */
    private static final ThreadLocal<String> TYPED_NUMBER = new ThreadLocal<>();

    private boolean manualNumbers() {
        return "MANUAL".equals(settings.trainingNumberEntryMode());
    }

    /** Lazy: the evidence service reaches Document Control's signature code, which reaches this door back. */
    private final TrainingLegacyEvidenceService legacyEvidence;

    public TrainingDocumentIntegrationService(JdbcTemplate jdbc, TrainingStore store, TrainingNumberService numbers, TrainingSettingsService settings,
                                              @org.springframework.context.annotation.Lazy TrainingLegacyEvidenceService legacyEvidence) {
        this.jdbc = jdbc;
        this.store = store;
        this.numbers = numbers;
        this.settings = settings;
        this.legacyEvidence = legacyEvidence;
    }

    // ------------------------------------------------------------------------------------------------------------------------------------------
    // A document that has no revision yet
    // ------------------------------------------------------------------------------------------------------------------------------------------

    @Override
    public void onDocumentSaved(DocumentRecord document, UserAccount actor, String typedTrainingNumber) {
        boolean typed = typedTrainingNumber != null && !typedTrainingNumber.isBlank();
        if (typed && !manualNumbers()) {
            throw new IllegalArgumentException("Training numbers are issued by the system; a Training Number cannot be typed.");
        }
        TYPED_NUMBER.set(typed ? typedTrainingNumber.trim() : "");
        try {
            onDocumentSaved(document, actor);
        } finally {
            TYPED_NUMBER.remove();
        }
    }

    @Override
    public void onDocumentSaved(DocumentRecord document, UserAccount actor) {
        if (document == null || document.getId() == null || document.isTemplate()) return;
        // The document row must exist before the activity row points at it.
        entityManager.flush();
        // A document that already has a revision is handled through the revision (created or synchronised); only a brand new draft is handled here.
        Integer revisions = jdbc.queryForObject("select count(*) from document_revisions where document_id=?", Integer.class, document.getId());
        if (revisions != null && revisions > 0) return;
        boolean required = document.isRequiresTraining() && document.getTrainingPeriodDays() != null && document.getTrainingPeriodDays() >= 1;
        Optional<Map<String, Object>> pending = store.pendingByDocument(document.getId());
        if (required) {
            if (pending.isEmpty()) {
                // A screen that lets the person type the number (manual mode) must have received one: the system does not pick it instead.
                if (manualNumbers() && TYPED_NUMBER.get() != null && TYPED_NUMBER.get().isEmpty()) {
                    throw new IllegalArgumentException("Enter the Training Number: training numbers are typed by hand.");
                }
                createForDocument(document, null, document.getTrainingPeriodDays(), actor);
                pending = store.pendingByDocument(document.getId());
            } else {
                updatePeriod(pending.get(), document.getTrainingPeriodDays(), actor);
            }
        } else if (pending.isPresent()) {
            cancelOrRefuse(pending.get(), "Requires Training was removed before the first revision was created", actor);
        }
    }

    // ------------------------------------------------------------------------------------------------------------------------------------------
    // A revision
    // ------------------------------------------------------------------------------------------------------------------------------------------

    @Override
    public void onRevisionCreated(DocumentRevisionRecord revision, UserAccount actor) {
        createdInner(revision, actor);
        persistColumns(revision);
    }

    @Override
    public void onRevisionSynced(DocumentRevisionRecord revision, UserAccount actor) {
        syncedInner(revision, actor);
        persistColumns(revision);
    }

    /**
     * The revision entity handed to the hooks is a copy that the caller may not save again, and a later save of an older copy could write the old values
     * back; so the four training columns are written to the row here as well as set on the entity.
     */
    private void persistColumns(DocumentRevisionRecord revision) {
        if (revision == null || revision.getId() == null) return;
        entityManager.flush();
        jdbc.update("update document_revisions set training_activity_id=?, training_number=?, training_mode=? where id=?",
                revision.getTrainingActivityId(), revision.getTrainingNumber(), revision.getTrainingMode(), revision.getId());
    }

    private void createdInner(DocumentRevisionRecord revision, UserAccount actor) {
        DocumentRecord document = revision == null ? null : revision.getDocument();
        if (document == null || document.isTemplate() || !revision.isRequiresTraining()) return;
        if (ORIGIN_LEGACY.equals(revision.getTrainingOrigin()) || revision.getTrainingActivityId() != null) return;
        Integer days = revision.getTrainingPeriodDays();
        if (days == null || days < 1) return;
        // The revision row must exist before the activity row points at it.
        entityManager.flush();
        Optional<Map<String, Object>> pending = store.pendingByDocument(document.getId());
        // A related document is not part of the Training Number of another document (owner decision 2026-11-24): the training counts on the document that requires it; a related
        // document that requires training itself has an activity of its own.
        if (pending.isPresent()) {
            bind(pending.get(), revision, actor);
            return;
        }
        createForDocument(document, revision, days, actor);
    }

    private void syncedInner(DocumentRevisionRecord revision, UserAccount actor) {
        DocumentRecord document = revision == null ? null : revision.getDocument();
        if (document == null || document.isTemplate() || ORIGIN_LEGACY.equals(revision.getTrainingOrigin())) return;
        if (MODE_MANUAL.equals(revision.getTrainingMode()) || MODE_COVERED.equals(revision.getTrainingMode())) return;
        Optional<Map<String, Object>> existing = store.byRevision(revision.getId());
        boolean required = revision.isRequiresTraining() && revision.getTrainingPeriodDays() != null && revision.getTrainingPeriodDays() >= 1;
        if (required) {
            if (existing.isPresent()) {
                if (revision.getId().equals(existing.get().get("revision_id"))) {
                    updatePeriod(existing.get(), revision.getTrainingPeriodDays(), actor);
                }
            } else {
                entityManager.flush();
                createForDocument(document, revision, revision.getTrainingPeriodDays(), actor);
            }
        } else if (existing.isPresent() && !revision.getId().equals(existing.get().get("revision_id"))) {
            // A revision of a related document that no longer needs training leaves the group; the Training Number goes on for the others.
            leaveGroup(existing.get(), revision, actor);
        } else if (existing.isPresent()) {
            cancelOrRefuse(existing.get(), "Requires Training was removed", actor);
            revision.setTrainingActivityId(null);
            revision.setTrainingNumber(null);
            revision.setTrainingMode(null);
        }
    }

    @Override
    public void onRevisionStatusChanged(DocumentRevisionRecord revision, String fromStatus, String toStatus, UserAccount actor) {
        if (revision == null || revision.getId() == null || toStatus == null || MODE_COVERED.equals(revision.getTrainingMode())) return;
        Optional<Map<String, Object>> existing = store.byRevision(revision.getId());
        if (existing.isEmpty()) return;
        Map<String, Object> activity = existing.get();
        String status = String.valueOf(activity.get("status"));
        switch (toStatus.toUpperCase()) {
            case "PENDING_TRAINING" -> {
                // The revision was approved. The activity of a group opens when every revision of the group is approved (the same release); its due date counts from the last approval.
                if ("RESERVED".equals(status)) openWhenGroupApproved(activity, revision.getId(), actor);
            }
            case "DRAFT" -> {
                // Returned to draft before the training started: the activity waits again and the clock stops.
                if ("PLANNED".equals(status)) {
                    jdbc.update("update training_activities set status='RESERVED', approved_on=null, due_date=null, version=version+1, updated_at=now() where id=?", activity.get("id"));
                    store.event(TrainingStore.OBJECT_ACTIVITY, (UUID) activity.get("id"), (UUID) activity.get("id"), "RETURNED_TO_DRAFT", Map.of(), actor == null ? null : actor.getId());
                    store.auditActivity(actor, activity, "TRAINING_ACTIVITY_RETURNED", "PLANNED", "RESERVED", "Revision returned to Draft");
                }
            }
            case "CLOSED_CANCELLED", "OBSOLETED" -> {
                if (!"COMPLETED".equals(status) && !"CANCELLED".equals(status) && ("RESERVED".equals(status) || "PLANNED".equals(status))) {
                    if (otherRevisionsOf(activity, revision.getId()) > 0) {
                        // Other revisions of the group go on with the Training Number: this one leaves the group.
                        leaveGroup(activity, revision, actor);
                        if ("RESERVED".equals(status)) openWhenGroupApproved(activity, revision.getId(), actor);
                    } else {
                        store.cancel(activity, "Revision " + toStatus.toLowerCase().replace('_', ' '), actor);
                    }
                }
            }
            default -> { /* nothing to do */ }
        }
    }

    /**
     * The people who signed the revision (prepared, reviewed, approved) are taken to have had the initial training on it (SOP.0003 5.1, D-45). One statement writes a record for each of
     * them; a person who already has one for this activity is skipped, so approving the same revision again changes nothing.
     */
    private void recordSignatories(UUID revisionId, UUID activityId, LocalDate approvedOn) {
        jdbc.update("""
            insert into training_records(id, person_user_id, activity_id, training_number, topic_text, document_number, document_revision, completed_on, method, result, source,
                                         employee_code, full_name, department, position, content_sha256)
            select gen_random_uuid(), u.id, a.id, a.training_number, training_activity_topics(a.id) as training_topics, a.document_number, a.revision_number, ?, 'SIGNATORY', 'READ', 'SIGNATORY_INITIAL',
                   u.employee_code, u.full_name, u.department, u.position,
                   encode(sha256(convert_to(a.training_number || '|' || u.id || '|' || coalesce(a.document_number, '') || '|' || coalesce(a.revision_number, '') || '|' || ? || '|SIGNATORY_INITIAL', 'UTF8')), 'hex')
              from (select distinct user_id from electronic_signatures where revision_id = ? and status = 'SIGNED' and meaning in ('PREPARED','SUBMITTED_FOR_REVIEW','REVIEWED','APPROVED')) s
              join app_users u on u.id = s.user_id join training_activities a on a.id = ?
            on conflict do nothing
            """, java.sql.Date.valueOf(approvedOn), approvedOn.toString(), revisionId, activityId);
    }

    @Override
    public boolean trainingNumberExists(String trainingNumber) {
        Boolean used = jdbc.queryForObject(
                "select exists(select 1 from training_activities where upper(training_number)=upper(?)) or exists(select 1 from document_revisions where upper(training_number)=upper(?))",
                Boolean.class, trainingNumber, trainingNumber);
        return Boolean.TRUE.equals(used);
    }

    @Override
    public String legacyTrainingProblem(UserAccount actor, DocumentRecord document, String revisionNumber, LegacyTraining entry) {
        return legacyEvidence.problem(actor, document, revisionNumber, entry);
    }

    @Override
    public void onLegacyImported(UserAccount actor, DocumentRecord document, List<DocumentRevisionRecord> revisions, List<LegacyTraining> entries) {
        legacyEvidence.imported(actor, document, revisions, entries);
    }

    @Override
    public String activityStatus(DocumentRevisionRecord revision) {
        if (revision == null || revision.getTrainingActivityId() == null) return null;
        List<String> rows = jdbc.queryForList("select status from training_activities where id=?", String.class, revision.getTrainingActivityId());
        return rows.isEmpty() ? null : rows.getFirst();
    }

    @Override
    public CompletionGate completionGate(DocumentRevisionRecord revision) {
        if (revision == null || revision.getId() == null || !MODE_INTEGRATED.equals(revision.getTrainingMode())) return null;
        Optional<Map<String, Object>> existing = store.byRevision(revision.getId());
        if (existing.isEmpty()) return null;
        Map<String, Object> a = existing.get();
        // The revision is completed in Document Control only after QA has confirmed the training (owner decision 2026-11-26): a trainer who finished and sent the results is not enough.
        boolean completed = "COMPLETED".equals(String.valueOf(a.get("status")));
        LocalDate completedOn = toDate(a.get("completed_on"));
        if (completedOn == null && completed) {
            java.sql.Date held = jdbc.queryForObject("select max(held_on) from training_sessions where activity_id = ? and status = 'PLANNED'", java.sql.Date.class, a.get("id"));
            completedOn = held == null ? LocalDate.now(TrainingNumberService.ZONE) : held.toLocalDate();
        }
        return new CompletionGate(completed, toDate(a.get("approved_on")), toDate(a.get("due_date")), completedOn, String.valueOf(a.get("training_number")));
    }

    // ------------------------------------------------------------------------------------------------------------------------------------------
    // internals
    // ------------------------------------------------------------------------------------------------------------------------------------------

    // ------------------------------------------------------------------------------------------------------------------------------------------
    // documents that go together: one Training Number (SOP.0003 5.1.4: one number for one topic)
    // ------------------------------------------------------------------------------------------------------------------------------------------

    private int otherRevisionsOf(Map<String, Object> activity, UUID revisionId) {
        Integer n = jdbc.queryForObject("select count(*) from document_revisions where training_activity_id = ? and id <> ? and status_code not in ('CLOSED_CANCELLED','OBSOLETED')", Integer.class, activity.get("id"), revisionId);
        return n == null ? 0 : n;
    }

    /** A revision that is cancelled leaves the group; when it carried the activity (the first document), another revision of the group takes its place. */
    private void leaveGroup(Map<String, Object> activity, DocumentRevisionRecord revision, UserAccount actor) {
        UUID id = (UUID) activity.get("id");
        jdbc.update("update document_revisions set training_activity_id = null, training_number = null, training_mode = null where id = ?", revision.getId());
        revision.setTrainingActivityId(null);
        revision.setTrainingNumber(null);
        revision.setTrainingMode(null);
        if (revision.getId().equals(activity.get("revision_id"))) {
            Map<String, Object> next = jdbc.queryForList("""
                select r.id, r.document_id, r.revision_number, r.document_number, r.revision_name from document_revisions r
                 where r.training_activity_id = ? and r.status_code not in ('CLOSED_CANCELLED','OBSOLETED') order by r.created_at limit 1
                """, id).getFirst();
            jdbc.update("update training_activities set document_id = ?, revision_id = ?, revision_number = ?, document_number = ?, document_name = ?, version = version + 1, updated_at = now() where id = ?",
                    next.get("document_id"), next.get("id"), next.get("revision_number"), next.get("document_number"), trim(String.valueOf(next.get("revision_name")), 255), id);
        }
        store.event(TrainingStore.OBJECT_ACTIVITY, id, id, "RELATED_REVISION_LEFT", Map.of("document", String.valueOf(revision.getDocumentNumber())), actor == null ? null : actor.getId());
        store.auditActivity(actor, activity, "TRAINING_RELATED_DOCUMENT_LEFT", String.valueOf(activity.get("status")), String.valueOf(activity.get("status")),
                "Revision " + revision.getRevisionNumber() + " of " + revision.getDocumentNumber() + " was cancelled and leaves this Training Number",
                java.util.List.of(com.eqms.util.AuditChanges.of("Related Document Left",revision.getDocumentNumber() + " Rev " + revision.getRevisionNumber(),null)));
    }

    /** The activity opens when every revision of the group has been approved (the group is one release); the day of the last approval starts the period. */
    private void openWhenGroupApproved(Map<String, Object> activity, UUID justApproved, UserAccount actor) {
        UUID id = (UUID) activity.get("id");
        // The first document of the activity has no revision yet: its approval is still to come.
        if (activity.get("revision_id") == null) return;
        Integer waiting = jdbc.queryForObject("""
            select count(*) from document_revisions where training_activity_id = ? and id <> ? and status_code not in ('PENDING_TRAINING','READY_FOR_PUBLISHING','EFFECTIVE','CLOSED_CANCELLED','OBSOLETED')
            """, Integer.class, id, justApproved);
        if (waiting != null && waiting > 0) return;
        int days = activity.get("training_period_days") == null ? settings.documentTrainingDaysDefault() : ((Number) activity.get("training_period_days")).intValue();
        LocalDate approvedOn = LocalDate.now(TrainingNumberService.ZONE);
        store.open(activity, approvedOn, approvedOn.plusDays(days), actor);
        if ("SOP_VERSION".equals(activity.get("kind_reason"))) prepareDepartmentSessions(activity, actor);
        for (UUID revisionId : jdbc.queryForList("select id from document_revisions where training_activity_id = ? and status_code not in ('CLOSED_CANCELLED','OBSOLETED')", UUID.class, id)) {
            recordSignatories(revisionId, id, approvedOn);
        }
        recordSignatories(justApproved, id, approvedOn);
    }

    /**
     * A new version of an SOP: the head of each unit trains their own unit (SOP.0003 5.3.6). One session is prepared for each department whose Work Positions the matrix
     * says must learn the document, and for each related department of the impact assessment, with the Department Head proposed as trainer; the organizer changes them
     * as needed before the list is confirmed. Nothing is prepared when the document is in the factory-wide list (everybody learns it together) or sessions exist.
     */
    private void prepareDepartmentSessions(Map<String, Object> activity, UserAccount actor) {
        UUID id = (UUID) activity.get("id");
        Integer sessions = jdbc.queryForObject("select count(*) from training_sessions where activity_id = ?", Integer.class, id);
        if (sessions == null || sessions > 0) return;
        List<Map<String, Object>> departments = jdbc.queryForList("""
            select d.id, d.name, (select u.id from app_users u where u.id = d.department_head_id and u.status = 'Active') as head_id
              from departments d
             where not exists (select 1 from training_effective_requirements f where f.factory and f.document_id = ?)
               and (exists (select 1 from training_effective_requirements r where r.department_id = d.id and r.document_id = ? and (r.all_employees or exists (select 1 from training_matrix_cells c where c.row_id = r.id)))
                    or exists (select 1 from training_impact_departments t where t.activity_id = ? and t.department_id = d.id))
             order by (d.id = ?) desc, d.name
            """, activity.get("document_id"), activity.get("document_id"), id, activity.get("organizer_department_id"));
        if (departments.isEmpty()) return;
        UUID createdBy = actor != null ? actor.getId() : (UUID) activity.get("created_by");
        String title = String.valueOf(activity.get("document_name"));
        int number = 0;
        for (Map<String, Object> department : departments) {
            UUID session = UUID.randomUUID();
            jdbc.update("insert into training_sessions(id, activity_id, session_no, method, assessment_method, trainer_user_id, created_by) values (?,?,?,'CLASSROOM','TEST',?,?)",
                    session, id, ++number, department.get("head_id"), createdBy);
            jdbc.update("insert into training_session_topics(id, session_id, topic_text, document_id, document_revision_id, document_number, revision_number) values (?,?,?,?,?,?,?)",
                    UUID.randomUUID(), session, title, activity.get("document_id"), activity.get("revision_id"), activity.get("document_number"), activity.get("revision_number"));
            // the people proposed while the document was prepared go to the session of their department
            jdbc.update("""
                insert into training_participants(id, activity_id, session_id, person_user_id, employee_code, full_name, department, position, added_reason, created_by)
                select gen_random_uuid(), ?, ?, u.id, u.employee_code, u.full_name, u.department, u.position, 'Proposed when the document was prepared', ?
                  from training_proposed_participants p join app_users u on u.id = p.person_user_id
                 where p.activity_id = ? and u.status = 'Active' and lower(trim(u.department)) = lower(trim(?))
                   and u.id is distinct from ?
                """, id, session, createdBy, id, department.get("name"), department.get("head_id"));
        }
        store.event(TrainingStore.OBJECT_ACTIVITY, id, id, "SESSION_ADDED", Map.of("sessionNo", number), actor == null ? null : actor.getId());
        store.auditActivity(actor, activity, "TRAINING_SESSION_ADDED", null, null,
                number + " session(s) prepared, one for each department that learns the new version: " + departments.stream().map(d -> String.valueOf(d.get("name"))).collect(java.util.stream.Collectors.joining(", ")),
                List.of(TrainingStore.change("Sessions Prepared", null, number)));
        // proposed people of a department without a session stay proposed: the first session added by hand takes them as before
        jdbc.update("update training_proposed_participants p set applied_at = now() where p.activity_id = ? and p.applied_at is null and exists (select 1 from training_participants x where x.activity_id = p.activity_id and x.person_user_id = p.person_user_id)", id);
    }

    /** The statuses of an activity whose Training Number may still be changed by hand: it has not opened, so nothing outside has used the number. */
    private static final Set<String> NUMBER_CHANGEABLE = Set.of("RESERVED", "PLANNED");

    public String entryMode() {
        return manualNumbers() ? "MANUAL" : "AUTO";
    }

    public record NumberState(boolean manual, boolean editable, String reasonCode, String message, UUID departmentId) {}

    private NumberState numberState(UUID activityId, UserAccount actor) {
        Optional<Map<String, Object>> found = store.activity(activityId);
        if (found.isEmpty()) throw new IllegalArgumentException("Training activity not found");
        Map<String, Object> activity = found.get();
        UUID department = (UUID) activity.get("organizer_department_id");
        if (!manualNumbers()) return new NumberState(false, false, "TRAINING_NUMBER_MANUAL_OFF", "Training numbers are issued by the system.", department);
        if (activity.get("parent_activity_id") != null || !NUMBER_CHANGEABLE.contains(String.valueOf(activity.get("status")))) {
            return new NumberState(true, false, "TRAINING_NUMBER_LOCKED", "The Training Number can no longer be changed: the training has opened.", department);
        }
        UUID documentId = (UUID) activity.get("document_id");
        boolean allowed = documentId == null;
        if (documentId != null) {
            List<Map<String, Object>> rows = jdbc.queryForList("select author_user_id, owner_user_id from documents where id=?", documentId);
            if (!rows.isEmpty()) {
                allowed = actor.getId().equals(rows.getFirst().get("author_user_id")) || actor.getId().equals(rows.getFirst().get("owner_user_id"))
                        || (permissions != null && permissions.hasPermission(actor, "documents.workspace.manage"));
            }
        }
        if (!allowed) return new NumberState(true, false, "TRAINING_NUMBER_NOT_ALLOWED", "You are not allowed to change this Training Number.", department);
        return new NumberState(true, true, null, null, department);
    }

    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public NumberState numberState(UUID activityId) {
        return numberState(activityId, currentUsers.requireCurrentUser());
    }

    /** Changes the Training Number of an activity that has not opened (and of its revision), for a reason that goes to the Audit Trail. */
    @org.springframework.transaction.annotation.Transactional
    public void changeNumber(UUID activityId, String typed, String reason) {
        UserAccount actor = currentUsers.requireCurrentUser();
        NumberState state = numberState(activityId, actor);
        if (!state.editable()) {
            if ("TRAINING_NUMBER_NOT_ALLOWED".equals(state.reasonCode())) throw new org.springframework.security.access.AccessDeniedException(state.message());
            throw new IllegalStateException(state.reasonCode() + ": " + state.message());
        }
        if (reason == null || reason.isBlank()) throw new IllegalArgumentException("A reason is required to change the Training Number.");
        TrainingNumberService.Check check = numbers.check(state.departmentId(), typed, activityId);
        if (!check.valid()) throw new IllegalArgumentException(check.message());
        Map<String, Object> activity = store.activity(activityId).orElseThrow();
        String old = String.valueOf(activity.get("training_number"));
        if (old.equalsIgnoreCase(check.number())) return;
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("^TRN/[A-Z0-9]+/([0-9]{2})-([0-9]+)$").matcher(check.number());
        m.matches();
        jdbc.update("update training_activities set training_number=?, base_number=?, year=?, serial=?, version=version+1, updated_at=now() where id=?",
                check.number(), check.number(), 2000 + Integer.parseInt(m.group(1)), Integer.parseInt(m.group(2)), activityId);
        jdbc.update("update document_revisions set training_number=? where training_activity_id=?", check.number(), activityId);
        numbers.reserveFromPaper(check.number());
        store.event(TrainingStore.OBJECT_ACTIVITY, activityId, activityId, "NUMBER_CHANGED", Map.of("from", old, "to", check.number()), actor.getId());
        store.auditActivity(actor, store.activity(activityId).orElseThrow(), "TRAINING_NUMBER_CHANGED", String.valueOf(activity.get("status")), String.valueOf(activity.get("status")),
                "Training Number changed by hand. Reason: " + reason.trim(),
                java.util.List.of(new com.eqms.dto.audittrail.AuditTrailChangeResponse("Training Number", old, check.number())));
    }

    private void createForDocument(DocumentRecord document, DocumentRevisionRecord revision, int days, UserAccount actor) {
        if (document.getDepartment() == null || document.getDepartment().getId() == null) throw new IllegalArgumentException("TRAINING_DEPARTMENT_NOT_FOUND");
        UUID id = UUID.randomUUID();
        String typedNumber = TYPED_NUMBER.get();
        TrainingNumberService.Issued issued = typedNumber != null && !typedNumber.isEmpty()
                ? numbers.useTyped(document.getDepartment().getId(), typedNumber, null)
                : numbers.issueRoot(document.getDepartment().getId());
        boolean first = revision == null
                ? Boolean.TRUE
                : jdbc.queryForObject("select count(*) from document_revisions where document_id=? and id<>?", Integer.class, document.getId(), revision.getId()) == 0;
        jdbc.update("""
            insert into training_activities(id, training_number, base_number, organizer_department_id, year, serial, kind, kind_reason, status,
                                            document_id, revision_id, revision_number, document_number, document_name, training_period_days, created_by)
            values (?,?,?,?,?,?, 'UNPLANNED', ?, 'RESERVED', ?,?,?,?,?,?,?)
            """,
                id, issued.baseNumber(), issued.baseNumber(), document.getDepartment().getId(), issued.year(), issued.serial(),
                first ? "NEW_SOP" : "SOP_VERSION",
                document.getId(), revision == null ? null : revision.getId(), revision == null ? null : revision.getRevisionNumber(),
                document.getDocumentNumber(), trim(document.getDocumentName(), 255), days, actor == null ? null : actor.getId());
        Map<String, Object> created = store.activity(id).orElseThrow();
        // The people proposed for the previous revision are proposed again, to be adjusted rather than chosen from the start.
        jdbc.update("""
            insert into training_proposed_participants(id, activity_id, person_user_id, proposed_by)
            select gen_random_uuid(), ?, p.person_user_id, p.proposed_by from training_proposed_participants p join app_users u on u.id = p.person_user_id and u.status = 'Active'
             where p.activity_id = (select a.id from training_activities a where a.document_id = ? and a.id <> ? and a.parent_activity_id is null
                                       and exists (select 1 from training_proposed_participants q where q.activity_id = a.id) order by a.created_at desc limit 1)
            """, id, document.getId(), id);
        store.event(TrainingStore.OBJECT_ACTIVITY, id, id, "NUMBER_ISSUED", Map.of("trainingNumber", issued.baseNumber(), "document", String.valueOf(document.getDocumentNumber())), actor == null ? null : actor.getId());
        store.auditActivity(actor, created, "TRAINING_NUMBER_ASSIGNED", null, "RESERVED", "Training Number assigned to " + (revision == null ? "the first revision of " : "revision of ") + document.getDocumentNumber(),
                List.of(TrainingStore.change("Training Number", null, issued.baseNumber()), TrainingStore.change("Document", null, document.getDocumentNumber())));
        if (revision != null) {
            revision.setTrainingActivityId(id);
            revision.setTrainingNumber(issued.baseNumber());
            revision.setTrainingMode(MODE_INTEGRATED);
        }
    }

    private void bind(Map<String, Object> activity, DocumentRevisionRecord revision, UserAccount actor) {
        UUID id = (UUID) activity.get("id");
        jdbc.update("update training_activities set revision_id=?, revision_number=?, training_period_days=?, version=version+1, updated_at=now() where id=?",
                revision.getId(), revision.getRevisionNumber(), revision.getTrainingPeriodDays(), id);
        revision.setTrainingActivityId(id);
        revision.setTrainingNumber(String.valueOf(activity.get("training_number")));
        revision.setTrainingMode(MODE_INTEGRATED);
        store.event(TrainingStore.OBJECT_ACTIVITY, id, id, "BOUND_TO_REVISION", Map.of("revision", String.valueOf(revision.getRevisionNumber())), actor == null ? null : actor.getId());
        store.auditActivity(actor, activity, "TRAINING_ACTIVITY_LINKED", String.valueOf(activity.get("status")), String.valueOf(activity.get("status")),
                "Linked to revision " + revision.getRevisionNumber(),
                List.of(TrainingStore.change("Revision", null, revision.getRevisionNumber())));
    }

    private void updatePeriod(Map<String, Object> activity, int days, UserAccount actor) {
        Integer current = activity.get("training_period_days") == null ? null : ((Number) activity.get("training_period_days")).intValue();
        if (current != null && current == days) return;
        String status = String.valueOf(activity.get("status"));
        if (!"RESERVED".equals(status) && !"PLANNED".equals(status)) throw new IllegalStateException("TRAINING_ACTIVITY_IN_PROGRESS");
        UUID id = (UUID) activity.get("id");
        LocalDate approvedOn = toDate(activity.get("approved_on"));
        jdbc.update("update training_activities set training_period_days=?, due_date=?, version=version+1, updated_at=now() where id=?",
                days, approvedOn == null ? null : approvedOn.plusDays(days), id);
        store.event(TrainingStore.OBJECT_ACTIVITY, id, id, "PERIOD_CHANGED", Map.of("from", String.valueOf(current), "to", days), actor == null ? null : actor.getId());
        store.auditActivity(actor, activity, "TRAINING_PERIOD_CHANGED", status, status, "Training period " + current + " -> " + days + " days",
                java.util.List.of(com.eqms.util.AuditChanges.of("Training Period (Days)",current,days)));
    }

    private void cancelOrRefuse(Map<String, Object> activity, String reason, UserAccount actor) {
        String status = String.valueOf(activity.get("status"));
        // After the training has started the number cannot simply be cancelled by unticking a box.
        if (!"RESERVED".equals(status) && !"PLANNED".equals(status)) throw new IllegalStateException("TRAINING_ACTIVITY_IN_PROGRESS");
        store.cancel(activity, reason, actor);
    }

    private static LocalDate toDate(Object value) {
        if (value == null) return null;
        if (value instanceof java.sql.Date d) return d.toLocalDate();
        if (value instanceof LocalDate d) return d;
        return LocalDate.parse(String.valueOf(value));
    }

    private static String trim(String value, int max) {
        if (value == null) return null;
        String v = value.trim();
        return v.length() <= max ? v : v.substring(0, max);
    }
}
