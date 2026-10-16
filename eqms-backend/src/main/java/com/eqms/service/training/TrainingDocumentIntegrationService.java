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
            if (!settings.integrationEnabled()) return;
            if (pending.isEmpty()) {
                createForDocument(document, null, document.getTrainingPeriodDays(), actor);
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
        if (pending.isPresent()) {
            bind(pending.get(), revision, actor);
            return;
        }
        if (!settings.integrationEnabled()) {
            revision.setTrainingMode(MODE_MANUAL);
            return;
        }
        createForDocument(document, revision, days, actor);
    }

    private void syncedInner(DocumentRevisionRecord revision, UserAccount actor) {
        DocumentRecord document = revision == null ? null : revision.getDocument();
        if (document == null || document.isTemplate() || ORIGIN_LEGACY.equals(revision.getTrainingOrigin())) return;
        if (MODE_MANUAL.equals(revision.getTrainingMode())) return;
        Optional<Map<String, Object>> existing = store.byRevision(revision.getId());
        boolean required = revision.isRequiresTraining() && revision.getTrainingPeriodDays() != null && revision.getTrainingPeriodDays() >= 1;
        if (required) {
            if (existing.isPresent()) {
                updatePeriod(existing.get(), revision.getTrainingPeriodDays(), actor);
            } else if (settings.integrationEnabled()) {
                entityManager.flush();
                createForDocument(document, revision, revision.getTrainingPeriodDays(), actor);
            } else {
                revision.setTrainingMode(MODE_MANUAL);
            }
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
                // The revision was approved: the activity opens and its due date counts from the approval.
                if ("RESERVED".equals(status)) {
                    int days = activity.get("training_period_days") == null ? settings.documentTrainingDaysDefault() : ((Number) activity.get("training_period_days")).intValue();
                    LocalDate approvedOn = LocalDate.now(TrainingNumberService.ZONE);
                    store.open(activity, approvedOn, approvedOn.plusDays(days), actor);
                }
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
                    store.cancel(activity, "Revision " + toStatus.toLowerCase().replace('_', ' '), actor);
                }
            }
            default -> { /* nothing to do */ }
        }
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
        boolean completed = "COMPLETED".equals(String.valueOf(a.get("status")));
        return new CompletionGate(completed, toDate(a.get("approved_on")), toDate(a.get("due_date")), toDate(a.get("completed_on")), String.valueOf(a.get("training_number")));
    }

    // ------------------------------------------------------------------------------------------------------------------------------------------
    // internals
    // ------------------------------------------------------------------------------------------------------------------------------------------

    private void createForDocument(DocumentRecord document, DocumentRevisionRecord revision, int days, UserAccount actor) {
        if (document.getDepartment() == null || document.getDepartment().getId() == null) throw new IllegalArgumentException("TRAINING_DEPARTMENT_NOT_FOUND");
        UUID id = UUID.randomUUID();
        TrainingNumberService.Issued issued = numbers.issueRoot(document.getDepartment().getId());
        boolean first = revision == null
                ? Boolean.TRUE
                : jdbc.queryForObject("select count(*) from document_revisions where document_id=? and id<>?", Integer.class, document.getId(), revision.getId()) == 0;
        String title = (document.getDocumentNumber() == null ? "" : document.getDocumentNumber() + " ") + (document.getDocumentName() == null ? "" : document.getDocumentName());
        jdbc.update("""
            insert into training_activities(id, training_number, base_number, organizer_department_id, year, serial, kind, kind_reason, title, status,
                                            document_id, revision_id, revision_number, document_number, document_name, training_period_days, created_by)
            values (?,?,?,?,?,?, 'UNPLANNED', ?, ?, 'RESERVED', ?,?,?,?,?,?,?)
            """,
                id, issued.baseNumber(), issued.baseNumber(), document.getDepartment().getId(), issued.year(), issued.serial(),
                first ? "NEW_SOP" : "SOP_VERSION", trim(title, 255),
                document.getId(), revision == null ? null : revision.getId(), revision == null ? null : revision.getRevisionNumber(),
                document.getDocumentNumber(), trim(document.getDocumentName(), 255), days, actor == null ? null : actor.getId());
        Map<String, Object> created = store.activity(id).orElseThrow();
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
