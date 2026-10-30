package com.eqms.service.training;

import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.UserAccount;
import com.eqms.repository.DocumentRecordRepository;
import com.eqms.repository.DocumentRevisionRepository;
import com.eqms.service.DocumentAuthorizationService;
import com.eqms.util.DateTimeFormatUtils;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * What Document Control shows about the training of a document or revision: the Training Number, the state and the dates, read from Training. The person
 * must be allowed to see the document or revision; being allowed to open Training is a separate question, answered by {@code canOpen}.
 */
@Service
public class TrainingLinkService {
    private final JdbcTemplate jdbc;
    private final TrainingAccess access;
    private final DocumentRecordRepository documents;
    private final DocumentRevisionRepository revisions;
    private final DocumentAuthorizationService documentAuthorization;

    public TrainingLinkService(JdbcTemplate jdbc, TrainingAccess access, DocumentRecordRepository documents, DocumentRevisionRepository revisions,
                               DocumentAuthorizationService documentAuthorization) {
        this.jdbc = jdbc;
        this.access = access;
        this.documents = documents;
        this.revisions = revisions;
        this.documentAuthorization = documentAuthorization;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> forRevision(UserAccount actor, UUID revisionId) {
        DocumentRevisionRecord revision = revisions.findById(revisionId).orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        if (!documentAuthorization.canViewRevision(actor, revision)) throw new SecurityException(TrainingAccess.DENIED);
        List<Map<String, Object>> rows = jdbc.queryForList("""
            select a.* from training_activities a where a.parent_activity_id is null and a.status <> 'CANCELLED'
               and (a.revision_id = ? or a.id = (select r.training_activity_id from document_revisions r where r.id = ?))
             order by (a.revision_id = ?) desc limit 1
            """, revisionId, revisionId, revisionId);
        Map<String, Object> result = describe(actor, rows.isEmpty() ? null : rows.getFirst(), revision.getTrainingMode(), revision.getTrainingOrigin());
        // A historical revision has no activity: the number typed from its paper record is all there is to show.
        if (rows.isEmpty() && "LEGACY_IMPORT".equals(revision.getTrainingOrigin()) && revision.getTrainingNumber() != null) {
            result.put("trainingNumber", revision.getTrainingNumber());
        }
        return result;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> forDocument(UserAccount actor, UUID documentId) {
        DocumentRecord document = documents.findById(documentId).orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        if (!documentAuthorization.canViewDocument(actor, document)) throw new SecurityException(TrainingAccess.DENIED);
        // The activity waiting for the first revision, else the one of the newest revision that still has live training.
        List<Map<String, Object>> rows = jdbc.queryForList("""
            select * from training_activities where document_id=? and parent_activity_id is null and status<>'CANCELLED'
            order by (revision_id is null) desc, created_at desc limit 1
            """, documentId);
        return describe(actor, rows.isEmpty() ? null : rows.getFirst(), null, null);
    }

    private Map<String, Object> describe(UserAccount actor, Map<String, Object> activity, String mode, String origin) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("mode", mode);
        result.put("origin", origin == null ? "NATIVE" : origin);
        result.put("canOpen", access.has(actor, "training.module.view", "training.activity.view"));
        if (activity == null) {
            result.put("trainingNumber", null);
            return result;
        }
        result.put("activityId", activity.get("id"));
        result.put("trainingNumber", activity.get("training_number"));
        result.put("status", activity.get("status"));
        result.put("statusLabel", jdbc.queryForList("select label from training_activity_statuses where code = ?", String.class, activity.get("status")).stream().findFirst().orElse(null));
        result.put("kind", activity.get("kind"));
        result.put("trainingPeriodDays", activity.get("training_period_days"));
        result.put("approvedOn", activity.get("approved_on"));
        result.put("dueDate", activity.get("due_date"));
        // Once the trainer has finished the training the revision may be completed; the day of the training is then the completion day.
        Object completedOn = activity.get("completed_on");
        if (completedOn == null && activity.get("results_finished_at") != null) {
            completedOn = jdbc.queryForObject("select max(held_on) from training_sessions where activity_id = ? and status = 'PLANNED'", java.sql.Date.class, activity.get("id"));
        }
        result.put("completedOn", completedOn);
        java.sql.Timestamp attendanceSentAt = (java.sql.Timestamp) activity.get("attendance_sent_at");
        result.put("attendanceSentOn", attendanceSentAt == null ? null : attendanceSentAt.toInstant().atZone(DateTimeFormatUtils.ZONE).toLocalDate());
        java.sql.Timestamp finishedAt = (java.sql.Timestamp) activity.get("results_finished_at");
        result.put("finishedOn", finishedAt == null ? null : finishedAt.toInstant().atZone(DateTimeFormatUtils.ZONE).toLocalDate());
        return result;
    }
}
