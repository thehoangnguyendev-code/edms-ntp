package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * What a training that comes from Document Control starts with (owner decisions 2026-11-24, DEC-TRAINING-2026-11-24-2). Read only: nothing is written here.
 * The documents are the training material (SOP.0003 5.3.5: for a SOP, use the approved procedure): the document, the documents that go with its Training Number, and every
 * document it lists as related. The defaults are what the form of the first session starts with; the person who organizes may change every one of them.
 */
@Service
public class TrainingDocumentSourcesService {
    private static final Set<String> APPROVED = Set.of("PENDING_TRAINING", "READY_FOR_PUBLISHING", "EFFECTIVE");
    private static final Set<String> FROM_DOCUMENT = Set.of("NEW_SOP", "SOP_VERSION");
    private final JdbcTemplate jdbc;
    private final TrainingAccess access;
    private final TrainingStore store;

    public TrainingDocumentSourcesService(JdbcTemplate jdbc, TrainingAccess access, TrainingStore store) {
        this.jdbc = jdbc;
        this.access = access;
        this.store = store;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> get(UserAccount actor, UUID activityId) {
        access.require(actor, "training.activity.view", "training.activity.organize", "training.activity.conduct");
        Map<String, Object> activity = store.activity(activityId).orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        access.requireScope(actor, (UUID) activity.get("organizer_department_id"));
        UUID documentId = (UUID) activity.get("document_id");
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("documents", documentId == null ? List.of() : documents(activity, documentId));
        out.put("sessionDefaults", documentId == null ? null : defaults(activity, documentId));
        return out;
    }

    private List<Map<String, Object>> documents(Map<String, Object> activity, UUID documentId) {
        List<Map<String, Object>> out = new ArrayList<>();
        Set<UUID> seen = new java.util.HashSet<>();
        UUID mainRevision = (UUID) activity.get("revision_id");
        // the document of the activity, then the documents that share its Training Number
        for (Map<String, Object> r : jdbc.queryForList("""
            select r.id as revision_id, r.document_id, r.document_number, r.document_name, r.revision_number, r.status_code, (r.id = ?) as is_main
              from document_revisions r where r.training_activity_id = ? and r.status_code not in ('CLOSED_CANCELLED','OBSOLETED') and coalesce(r.training_mode, '') <> 'COVERED'
             order by (r.id = ?) desc, r.document_number
            """, mainRevision, activity.get("id"), mainRevision)) {
            seen.add((UUID) r.get("document_id"));
            out.add(row(Boolean.TRUE.equals(r.get("is_main")) ? "MAIN" : "GROUP", r));
        }
        if (out.isEmpty()) {
            // no revision yet: the document itself, without a revision
            for (Map<String, Object> d : jdbc.queryForList("select id as document_id, document_number, document_name from documents where id = ?", documentId)) {
                seen.add(documentId);
                out.add(row("MAIN", d));
            }
        }
        // every document it lists as related, with its latest revision that is not closed: the one that is released with this document (the one in force when nothing changes it). The same choice as the
        // publication of the related documents and as the list written down when the training starts, so the revision shown and opened is the one that is trained, never an older one in force.
        for (Map<String, Object> r : jdbc.queryForList("""
            select d.id as document_id, d.document_number, d.document_name, v.id as revision_id, v.revision_number, v.status_code,
                   not exists (select 1 from document_revisions y where y.document_id = d.id and y.status_code not in ('EFFECTIVE','CLOSED_CANCELLED','OBSOLETED')) as unchanged
              from document_relations rel join documents d on d.id = rel.target_document_id
              left join lateral (select x.id, x.revision_number, x.status_code from document_revisions x
                                  where x.document_id = d.id and x.status_code not in ('CLOSED_CANCELLED','OBSOLETED')
                                  order by x.created_at desc limit 1) v on true
             where rel.source_document_id = ? and rel.relation_type = 'RELATED' order by d.document_number
            """, documentId)) {
            if (seen.add((UUID) r.get("document_id"))) out.add(row("RELATED", r));
        }
        // once the training has started the revision of each related document is the one that was read (frozen), not the one that happens to be current today
        for (Map<String, Object> frozen : jdbc.queryForList("select document_id, revision_id, revision_number, frozen_phase, frozen_at from training_activity_documents where activity_id = ?", activity.get("id"))) {
            for (Map<String, Object> row : out) {
                if ("RELATED".equals(row.get("role")) && frozen.get("document_id").equals(row.get("documentId"))) {
                    row.put("revisionId", frozen.get("revision_id"));
                    row.put("revisionNumber", frozen.get("revision_number"));
                    row.put("approved", true);
                    row.put("frozen", true);
                }
            }
        }
        return out;
    }

    private static Map<String, Object> row(String role, Map<String, Object> r) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("role", role);
        m.put("documentId", r.get("document_id"));
        m.put("revisionId", r.get("revision_id"));
        m.put("documentNumber", r.get("document_number"));
        m.put("documentName", r.get("document_name"));
        m.put("revisionNumber", r.get("revision_number"));
        m.put("revisionStatus", r.get("status_code"));
        // SOP.0003 5.3.5: the training uses the approved procedure; a revision that is not approved yet is shown but cannot be opened from here.
        m.put("approved", r.get("status_code") != null && APPROVED.contains(String.valueOf(r.get("status_code"))));
        // A related document that has no revision in progress is the same as it was: it is read with the others, not part of what changed.
        m.put("unchanged", "RELATED".equals(role) && Boolean.TRUE.equals(r.get("unchanged")));
        return m;
    }

    /**
     * SOP.0003 5.1.2: a new SOP, or a version that changes the process flow, is a classroom training with the test of APD.0009. The software cannot tell a small change from a large one,
     * so a new version starts the same way and the organizer changes it to self-reading for a small change. SOP 5.3.6: a first issue is trained by the drafting unit, so the author of the document
     * is proposed as trainer; a later version is trained by the head of each unit, so nobody is proposed.
     */
    private Map<String, Object> defaults(Map<String, Object> activity, UUID documentId) {
        String reason = String.valueOf(activity.get("kind_reason"));
        if (!FROM_DOCUMENT.contains(reason)) return null;
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("method", "CLASSROOM");
        out.put("assessmentMethod", "TEST");
        out.put("trainerUserId", null);
        out.put("trainerName", null);
        if ("NEW_SOP".equals(reason)) {
            for (Map<String, Object> a : jdbc.queryForList("""
                select u.id, u.full_name, u.employee_code from documents d join app_users u on u.id = d.author_user_id where d.id = ? and u.status = 'Active'
                """, documentId)) {
                out.put("trainerUserId", a.get("id"));
                out.put("trainerName", a.get("full_name") + (a.get("employee_code") == null ? "" : " (" + a.get("employee_code") + ")"));
            }
        }
        return out;
    }
}
