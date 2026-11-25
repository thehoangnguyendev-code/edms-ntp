package com.eqms.service.training;

import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.entity.UserAccount;
import com.eqms.service.AuditTrailService;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * The related documents a training from a document was read with, frozen on the day (owner decision 2026-11-25, DEC-TRAINING-2026-11-25-6).
 * A related document is not part of the Training Number of the document that is trained; it is read with it (SOP.0003 5.3.5: only approved content is used). So that this can be shown to an
 * inspector later, the list and the revision of each document are written down when the training starts and completed when QA confirms it; the training records of the people, and the evidence
 * on the related revisions, are written from that list.
 */
final class TrainingDocumentSnapshot {
    private static final Set<String> APPROVED = Set.of("PENDING_TRAINING", "READY_FOR_PUBLISHING", "EFFECTIVE");
    /** Stable code: a related document of the training has a revision that is not approved yet. */
    static final String NOT_APPROVED = "TRAINING_RELATED_NOT_APPROVED";

    private final JdbcTemplate jdbc;
    private final AuditTrailService audit;

    TrainingDocumentSnapshot(JdbcTemplate jdbc, AuditTrailService audit) {
        this.jdbc = jdbc;
        this.audit = audit;
    }

    /** The related documents of the document of the activity, each with its latest revision that is not closed (the one in force, or the one that changes it). */
    List<Map<String, Object>> related(UUID activityId) {
        return jdbc.queryForList("""
            select d.id as document_id, d.document_number, d.document_name, v.id as revision_id, v.revision_number, v.status_code, coalesce(v.requires_training, false) as requires_training
              from training_activities a
              join document_relations rel on rel.source_document_id = a.document_id and rel.relation_type = 'RELATED'
              join documents d on d.id = rel.target_document_id
              left join lateral (select x.id, x.revision_number, x.status_code, x.requires_training from document_revisions x
                                  where x.document_id = d.id and x.status_code not in ('CLOSED_CANCELLED','OBSOLETED') order by x.created_at desc limit 1) v on true
             where a.id = ? and a.document_id is not null
               and not exists (select 1 from document_revisions g where g.training_activity_id = a.id and g.document_id = d.id and coalesce(g.training_mode, '') <> 'COVERED')
             order by d.document_number
            """, activityId);
    }

    private static boolean approved(Map<String, Object> row) {
        return row.get("revision_id") != null && APPROVED.contains(String.valueOf(row.get("status_code")));
    }

    /** Start Training is refused while a related document that has a revision has one that is not approved: only approved content is used to train. */
    List<String> startBlockers(UUID activityId) {
        for (Map<String, Object> r : related(activityId)) {
            if (r.get("revision_id") != null && !approved(r)) return List.of(NOT_APPROVED);
        }
        return List.of();
    }

    /** Writes the related documents that are not written yet and have an approved revision. Returns how many were written. */
    int freeze(UUID activityId, String phase) {
        int n = 0;
        for (Map<String, Object> r : related(activityId)) {
            if (!approved(r)) continue;
            n += jdbc.update("""
                insert into training_activity_documents(activity_id, document_id, revision_id, document_number, document_name, revision_number, frozen_phase)
                values (?,?,?,?,?,?,?) on conflict (activity_id, document_id) do nothing
                """, activityId, r.get("document_id"), r.get("revision_id"), r.get("document_number"), r.get("document_name"), r.get("revision_number"), phase);
        }
        return n;
    }

    List<Map<String, Object>> rows(UUID activityId) {
        return jdbc.queryForList("select * from training_activity_documents where activity_id = ? order by document_number", activityId);
    }

    /**
     * At the confirmation of the completion: a revision of a related document that needs no training of its own carries the Training Number and the days of this training as its evidence
     * (training mode COVERED), with an entry in its Audit Trail. A revision that needs training itself, or has a training of its own, is left as it is.
     */
    int cover(UserAccount actor, Map<String, Object> activity, LocalDate completedOn) {
        UUID activityId = (UUID) activity.get("id");
        int n = 0;
        for (Map<String, Object> row : rows(activityId)) {
            UUID revisionId = (UUID) row.get("revision_id");
            if (revisionId == null) continue;
            Map<String, Object> rev = jdbc.queryForList("select id, revision_name, status_code, requires_training, training_activity_id from document_revisions where id = ?", revisionId).stream().findFirst().orElse(null);
            if (rev == null || Boolean.TRUE.equals(rev.get("requires_training")) || rev.get("training_activity_id") != null) continue;
            java.sql.Date planned = (java.sql.Date) activity.get("approved_on");
            java.sql.Date periodEnd = (java.sql.Date) activity.get("due_date");
            jdbc.update("""
                update document_revisions set training_activity_id = ?, training_number = ?, training_mode = 'COVERED', training_planned_date = ?, training_period_end_date = ?, training_completion_date = ?
                 where id = ?
                """, activityId, activity.get("training_number"), planned, periodEnd, java.sql.Date.valueOf(completedOn), revisionId);
            String status = String.valueOf(rev.get("status_code"));
            audit.logAs(actor, "REVISION", String.valueOf(rev.get("revision_name")), revisionId, "TRAINING_COVERED", status, status,
                    "Read in the training " + activity.get("training_number") + " of " + activity.get("document_number") + " (completed on " + completedOn + "); no training of its own is required.",
                    List.of(new AuditTrailChangeResponse("Training Number", "-", String.valueOf(activity.get("training_number"))),
                            new AuditTrailChangeResponse("Covered By Document", "-", String.valueOf(activity.get("document_number"))),
                            new AuditTrailChangeResponse("Training Completion Date", "-", String.valueOf(completedOn))));
            n++;
        }
        return n;
    }
}
