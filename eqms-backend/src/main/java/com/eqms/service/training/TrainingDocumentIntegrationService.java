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

    public TrainingDocumentIntegrationService(JdbcTemplate jdbc, TrainingStore store, TrainingNumberService numbers, TrainingSettingsService settings) {
        this.jdbc = jdbc;
        this.store = store;
        this.numbers = numbers;
        this.settings = settings;
    }

    // ------------------------------------------------------------------------------------------------------------------------------------------
    // A document that has no revision yet
    // ------------------------------------------------------------------------------------------------------------------------------------------

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
                // A document that another one lists as related goes with it: it takes the Training Number of that one when its revision is created, not a number of its own.
                if (leadFor(document.getId()).isPresent()) return;
                createForDocument(document, null, document.getTrainingPeriodDays(), actor);
                pending = store.pendingByDocument(document.getId());
            } else {
                updatePeriod(pending.get(), document.getTrainingPeriodDays(), actor);
            }
            pending.ifPresent(activity -> reconcileGroup(activity, document.getId(), actor));
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
        Optional<Map<String, Object>> lead = leadFor(document.getId());
        if (lead.isPresent()) {
            // The document goes with another one (it is listed as related): one Training Number for the group. A number of its own that nobody used is given up.
            pending.ifPresent(own -> mergeInto(lead.get(), own, actor));
            join(lead.get(), revision, actor);
            return;
        }
        if (pending.isPresent()) {
            bind(pending.get(), revision, actor);
            store.activity((UUID) pending.get().get("id")).ifPresent(activity -> reconcileGroup(activity, document.getId(), actor));
            return;
        }
        createForDocument(document, revision, days, actor);
        store.byRevision(revision.getId()).ifPresent(activity -> reconcileGroup(activity, document.getId(), actor));
    }

    private void syncedInner(DocumentRevisionRecord revision, UserAccount actor) {
        DocumentRecord document = revision == null ? null : revision.getDocument();
        if (document == null || document.isTemplate() || ORIGIN_LEGACY.equals(revision.getTrainingOrigin())) return;
        if (MODE_MANUAL.equals(revision.getTrainingMode())) return;
        Optional<Map<String, Object>> existing = store.byRevision(revision.getId());
        boolean required = revision.isRequiresTraining() && revision.getTrainingPeriodDays() != null && revision.getTrainingPeriodDays() >= 1;
        if (required) {
            if (existing.isPresent()) {
                if (revision.getId().equals(existing.get().get("revision_id"))) {
                    updatePeriod(existing.get(), revision.getTrainingPeriodDays(), actor);
                    reconcileGroup(existing.get(), document.getId(), actor);
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
        if (revision == null || revision.getId() == null || toStatus == null) return;
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
        // The revision can be completed once the trainer has finished the training (Finish Training, every result in); the day is the day of the training.
        boolean completed = "COMPLETED".equals(String.valueOf(a.get("status"))) || a.get("results_finished_at") != null;
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

    /** The documents that the document lists as related (the "Related Document" field of the document). */
    private List<UUID> relatedOf(UUID documentId) {
        return jdbc.queryForList("select target_document_id from document_relations where source_document_id = ? and relation_type = 'RELATED'", UUID.class, documentId);
    }

    /** The activity that opened first for a document that lists this one as related, while it is still planned (not yet notified): the activity this document joins. */
    private Optional<Map<String, Object>> leadFor(UUID documentId) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
            select a.*, training_activity_topics(a.id) as training_topics from training_activities a
             where a.parent_activity_id is null and a.status in ('RESERVED','PLANNED') and a.document_id in
                   (select r.source_document_id from document_relations r where r.target_document_id = ? and r.relation_type = 'RELATED')
             order by a.created_at limit 1
            """, documentId);
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.getFirst());
    }

    /** The revision joins the activity of the document it goes with. Nothing changes for the activity but the people to wait for: it waits again if it was open. */
    private void join(Map<String, Object> lead, DocumentRevisionRecord revision, UserAccount actor) {
        UUID id = (UUID) lead.get("id");
        revision.setTrainingActivityId(id);
        revision.setTrainingNumber(String.valueOf(lead.get("training_number")));
        revision.setTrainingMode(MODE_INTEGRATED);
        if (revision.getTrainingPeriodDays() != null && lead.get("training_period_days") != null && revision.getTrainingPeriodDays() < ((Number) lead.get("training_period_days")).intValue()) {
            // The shortest period of the group rules it.
            jdbc.update("update training_activities set training_period_days = ?, version = version + 1, updated_at = now() where id = ?", revision.getTrainingPeriodDays(), id);
        }
        store.event(TrainingStore.OBJECT_ACTIVITY, id, id, "RELATED_REVISION_JOINED", Map.of("document", String.valueOf(revision.getDocumentNumber()), "revision", String.valueOf(revision.getRevisionNumber())), actor == null ? null : actor.getId());
        store.auditActivity(actor, lead, "TRAINING_RELATED_DOCUMENT_JOINED", String.valueOf(lead.get("status")), String.valueOf(lead.get("status")),
                "Revision " + revision.getRevisionNumber() + " of the related document " + revision.getDocumentNumber() + " goes with this Training Number");
        waitAgainIfOpen(id, actor);
    }

    /** A planned activity (already open) waits again when a revision that is not approved yet joins it, and the clock stops. */
    private void waitAgainIfOpen(UUID activityId, UserAccount actor) {
        Map<String, Object> activity = store.activity(activityId).orElse(null);
        if (activity == null || !"PLANNED".equals(String.valueOf(activity.get("status")))) return;
        Integer notApproved = jdbc.queryForObject("select count(*) from document_revisions where training_activity_id = ? and status_code not in ('PENDING_TRAINING','READY_FOR_PUBLISHING','EFFECTIVE','CLOSED_CANCELLED','OBSOLETED')", Integer.class, activityId);
        if (notApproved == null || notApproved == 0) return;
        jdbc.update("update training_activities set status='RESERVED', approved_on=null, due_date=null, version=version+1, updated_at=now() where id=?", activityId);
        store.event(TrainingStore.OBJECT_ACTIVITY, activityId, activityId, "RETURNED_TO_DRAFT", Map.of("reason", "a related revision is not approved yet"), actor == null ? null : actor.getId());
        store.auditActivity(actor, activity, "TRAINING_ACTIVITY_RETURNED", "PLANNED", "RESERVED", "A related revision joined and is not approved yet");
    }

    /**
     * The activity of a document that is listed as related is given up for the activity of the document it goes with, while nothing was planned on it. The revisions it had go to the lead.
     * After the people were notified or the training has started the Training Numbers cannot be merged: the document is refused with a clear code.
     */
    private void mergeInto(Map<String, Object> lead, Map<String, Object> own, UserAccount actor) {
        if (lead.get("id").equals(own.get("id"))) return;
        String status = String.valueOf(own.get("status"));
        Integer sessions = jdbc.queryForObject("select count(*) from training_sessions where activity_id = ?", Integer.class, own.get("id"));
        if (!("RESERVED".equals(status) || "PLANNED".equals(status)) || (sessions != null && sessions > 0)) throw new IllegalStateException("TRAINING_RELATED_DOCUMENT_TRAINING_STARTED");
        jdbc.update("update document_revisions set training_activity_id = ?, training_number = ?, training_mode = 'INTEGRATED' where training_activity_id = ?",
                lead.get("id"), lead.get("training_number"), own.get("id"));
        store.cancel(own, "Merged into " + lead.get("training_number") + ": the document goes with the document of that Training Number", actor);
        store.event(TrainingStore.OBJECT_ACTIVITY, (UUID) lead.get("id"), (UUID) lead.get("id"), "RELATED_NUMBER_MERGED", Map.of("merged", String.valueOf(own.get("training_number"))), actor == null ? null : actor.getId());
        store.auditActivity(actor, lead, "TRAINING_RELATED_NUMBER_MERGED", String.valueOf(lead.get("status")), String.valueOf(lead.get("status")),
                "The Training Number " + own.get("training_number") + " of the related document " + own.get("document_number") + " was given up for this one");
        waitAgainIfOpen((UUID) lead.get("id"), actor);
    }

    /**
     * Makes the activity of a document the activity of the documents it lists as related: their activities that nobody used are merged into it, and a related document that was already
     * in the group stays only while the document lists it (one that was removed from the list is refused while its revision is in the group).
     */
    private void reconcileGroup(Map<String, Object> activity, UUID documentId, UserAccount actor) {
        if (!activity.get("document_id").equals(documentId)) return;
        String status = String.valueOf(activity.get("status"));
        if (!"RESERVED".equals(status) && !"PLANNED".equals(status)) return;
        List<UUID> related = relatedOf(documentId);
        for (UUID other : related) {
            for (Map<String, Object> own : jdbc.queryForList("""
                select a.*, training_activity_topics(a.id) as training_topics from training_activities a where document_id = ? and parent_activity_id is null and id <> ? and status not in ('CANCELLED','COMPLETED')
                 order by created_at
                """, other, activity.get("id"))) {
                mergeInto(activity, own, actor);
            }
        }
        for (Map<String, Object> member : jdbc.queryForList("select id, document_id, document_number from document_revisions where training_activity_id = ? and document_id <> ?", activity.get("id"), documentId)) {
            if (!related.contains((UUID) member.get("document_id"))) throw new IllegalStateException("TRAINING_RELATED_DOCUMENT_IN_GROUP");
        }
    }

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
                "Revision " + revision.getRevisionNumber() + " of " + revision.getDocumentNumber() + " was cancelled and leaves this Training Number");
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
        for (UUID revisionId : jdbc.queryForList("select id from document_revisions where training_activity_id = ? and status_code not in ('CLOSED_CANCELLED','OBSOLETED')", UUID.class, id)) {
            recordSignatories(revisionId, id, approvedOn);
        }
        recordSignatories(justApproved, id, approvedOn);
    }

    private void createForDocument(DocumentRecord document, DocumentRevisionRecord revision, int days, UserAccount actor) {
        if (document.getDepartment() == null || document.getDepartment().getId() == null) throw new IllegalArgumentException("TRAINING_DEPARTMENT_NOT_FOUND");
        UUID id = UUID.randomUUID();
        TrainingNumberService.Issued issued = numbers.issueRoot(document.getDepartment().getId());
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
        store.auditActivity(actor, created, "TRAINING_NUMBER_ASSIGNED", null, "RESERVED", "Training Number assigned to " + (revision == null ? "the first revision of " : "revision of ") + document.getDocumentNumber());
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
                "Linked to revision " + revision.getRevisionNumber());
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
        store.auditActivity(actor, activity, "TRAINING_PERIOD_CHANGED", status, status, "Training period " + current + " -> " + days + " days");
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
