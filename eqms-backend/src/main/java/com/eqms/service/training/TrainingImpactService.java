package com.eqms.service.training;

import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.entity.UserAccount;
import com.eqms.service.ElectronicSignatureService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * The effect of a new or revised document on the training matrix (SOP.0003 5.3.1): when a document is issued, the department assesses the training impact, names the positions that
 * must be trained on it and updates the matrix. Every training activity made for a new SOP or a new version of an SOP is one line of the queue. An assessment is signed and never changed;
 * "matrix update needed" stays open until an effective matrix of the department contains the document, which the server checks.
 */
@Service
public class TrainingImpactService {
    static final String TYPE = "TRAINING_IMPACT_ASSESSMENT";
    static final Set<String> OUTCOMES = Set.of("MATRIX_UPDATE_NEEDED", "MATRIX_ALREADY_COVERS", "NO_TRAINING_IMPACT");
    public record AssessRequest(String outcome, String reason, List<UUID> positionIds, String signatureToken) {}

    private final JdbcTemplate jdbc;
    private final TrainingAccess access;
    private final TrainingStore store;
    private final ElectronicSignatureService signatures;
    private final ObjectMapper json = new ObjectMapper();

    public TrainingImpactService(JdbcTemplate jdbc, TrainingAccess access, TrainingStore store, ElectronicSignatureService signatures) {
        this.jdbc = jdbc;
        this.access = access;
        this.store = store;
        this.signatures = signatures;
    }

    private static final String COVERED = """
        exists (select 1 from training_matrix_versions v join training_matrices m on m.id = v.matrix_id join training_matrix_rows r on r.version_id = v.id
                 where m.department_id = a.organizer_department_id and v.status = 'EFFECTIVE' and r.document_id = a.document_id)
        """;

    private static final String BASE = """
        select a.id, a.training_number, training_activity_topics(a.id) as training_topics, a.status as activity_status, a.document_id, a.document_number, a.document_name, a.revision_number, a.kind_reason, a.organizer_department_id,
               d.name as department_name, a.created_at, x.outcome, x.assessed_at, ux.full_name as assessed_by_name, x.reason as assessment_reason,
               case when x.id is null then 'PENDING'
                    when x.outcome = 'MATRIX_UPDATE_NEEDED' and not %s then 'MATRIX_UPDATE_PENDING'
                    else 'DONE' end as impact_status
          from training_activities a join departments d on d.id = a.organizer_department_id
          left join lateral (select * from training_impact_assessments i where i.activity_id = a.id order by i.assessed_at desc limit 1) x on true
          left join app_users ux on ux.id = x.assessed_by
         where a.document_id is not null and a.parent_activity_id is null and a.status <> 'CANCELLED' and a.kind_reason in ('NEW_SOP','SOP_VERSION') and a.organizer_department_id = ?
        """.formatted(COVERED);

    private UUID department(UserAccount actor, UUID departmentId) {
        access.require(actor, "training.matrix.view", "training.matrix.manage");
        UUID department = departmentId != null ? departmentId : access.departmentOf(actor);
        if (department == null) throw new IllegalArgumentException("TRAINING_DEPARTMENT_REQUIRED");
        access.requireScope(actor, department);
        return department;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> list(UserAccount actor, UUID departmentId, String status, String search, String sortBy, String sortDirection, int page, int limit) {
        return list(actor, departmentId, status, null, search, sortBy, sortDirection, page, limit);
    }

    /** {@code activityStatus} is the Training Status: the status of the training activity of the line (a machine value of the activity lifecycle). An unknown value is refused. */
    @Transactional(readOnly = true)
    public Map<String, Object> list(UserAccount actor, UUID departmentId, String status, String activityStatus, String search, String sortBy, String sortDirection, int page, int limit) {
        UUID department = department(actor, departmentId);
        List<Object> args = new ArrayList<>();
        args.add(department);
        StringBuilder where = new StringBuilder(" where 1=1");
        if (status != null && !status.isBlank()) {
            if (!List.of("PENDING", "MATRIX_UPDATE_PENDING", "DONE", "OPEN").contains(status)) throw new IllegalArgumentException("TRAINING_STATUS_INVALID");
            if ("OPEN".equals(status)) where.append(" and x.impact_status <> 'DONE'");
            else { where.append(" and x.impact_status = ?"); args.add(status); }
        }
        if (activityStatus != null && !activityStatus.isBlank()) {
            if (!List.of("RESERVED", "PLANNED", "NOTIFIED", "IN_PROGRESS", "PENDING_QA_CONFIRMATION", "COMPLETED", "CANCELLED").contains(activityStatus)) throw new IllegalArgumentException("TRAINING_STATUS_INVALID");
            where.append(" and x.activity_status = ?");
            args.add(activityStatus);
        }
        if (search != null && !search.isBlank()) {
            String like = "%" + search.trim().toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
            where.append(" and (lower(x.training_number) like ? escape '\\' or lower(coalesce(x.document_number,'')) like ? escape '\\' or lower(coalesce(x.document_name,'')) like ? escape '\\' or lower(training_activity_topics(x.id)) like ? escape '\\')");
            for (int i = 0; i < 4; i++) args.add(like);
        }
        int safeLimit = Math.min(Math.max(limit, 1), 100), safePage = Math.max(page, 1);
        Long total = jdbc.queryForObject("select count(*) from (" + BASE + ") x" + where, Long.class, args.toArray());
        args.add(safeLimit);
        args.add((safePage - 1) * safeLimit);
        List<Map<String, Object>> rows = jdbc.queryForList("select x.* from (" + BASE + ") x" + where
                + TrainingRows.orderBy(sortBy, sortDirection, Map.of("trainingNumber", "x.training_number", "documentNumber", "x.document_number", "revisionNumber", "x.revision_number", "activityStatus", "x.activity_status",
                        "impactStatus", "x.impact_status", "assessedAt", "x.assessed_at", "createdAt", "x.created_at"), "case x.impact_status when 'PENDING' then 0 when 'MATRIX_UPDATE_PENDING' then 1 else 2 end, x.created_at desc")
                + " limit ? offset ?", args.toArray());
        boolean manage = access.has(actor, "training.matrix.manage");
        for (Map<String, Object> row : rows) row.put("can_assess", manage);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("data", TrainingRows.camel(rows));
        long count = total == null ? 0 : total;
        result.put("pagination", Map.of("page", safePage, "limit", safeLimit, "total", count, "totalPages", Math.max(1, (count + safeLimit - 1) / safeLimit)));
        return result;
    }

    /** How many documents of the department still wait for an impact assessment or for the matrix to be updated. */
    @Transactional(readOnly = true)
    public Map<String, Object> summary(UserAccount actor, UUID departmentId) {
        UUID department = department(actor, departmentId);
        Long pending = jdbc.queryForObject("select count(*) from (" + BASE + ") x where x.impact_status = 'PENDING'", Long.class, department);
        Long update = jdbc.queryForObject("select count(*) from (" + BASE + ") x where x.impact_status = 'MATRIX_UPDATE_PENDING'", Long.class, department);
        return Map.of("pending", pending == null ? 0 : pending, "matrixUpdatePending", update == null ? 0 : update);
    }

    /** For the reminder: the departments that have documents waiting, with how many. Not tied to a person; the reminder tells only those who hold the permission. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> waitingByDepartment() {
        return jdbc.queryForList("""
            select x.organizer_department_id as department_id, x.department_name as name, count(*) filter (where x.impact_status = 'PENDING') as pending,
                   count(*) filter (where x.impact_status = 'MATRIX_UPDATE_PENDING') as update_pending
              from (select a.organizer_department_id, d.name as department_name,
                           case when i.id is null then 'PENDING' when i.outcome = 'MATRIX_UPDATE_NEEDED' and not %s then 'MATRIX_UPDATE_PENDING' else 'DONE' end as impact_status
                      from training_activities a join departments d on d.id = a.organizer_department_id
                      left join lateral (select * from training_impact_assessments q where q.activity_id = a.id order by q.assessed_at desc limit 1) i on true
                     where a.document_id is not null and a.parent_activity_id is null and a.status <> 'CANCELLED' and a.kind_reason in ('NEW_SOP','SOP_VERSION')) x
             where x.impact_status <> 'DONE' group by x.organizer_department_id, x.department_name
            """.formatted(COVERED));
    }

    private Map<String, Object> row(UUID activityId) {
        List<Map<String, Object>> rows = jdbc.queryForList("select a.*, training_activity_topics(a.id) as training_topics from training_activities a where id = ?", activityId);
        if (rows.isEmpty()) throw new SecurityException(TrainingAccess.DENIED);
        return rows.getFirst();
    }

    /** What the person needs to assess: the document, whether an effective matrix of the department already has it and for which positions, and the positions of the department. */
    @Transactional(readOnly = true)
    public Map<String, Object> context(UserAccount actor, UUID activityId) {
        Map<String, Object> activity = row(activityId);
        UUID department = (UUID) activity.get("organizer_department_id");
        access.require(actor, "training.matrix.view", "training.matrix.manage");
        access.requireScope(actor, department);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("activityId", activityId);
        out.put("trainingNumber", activity.get("training_number"));
        out.put("documentNumber", activity.get("document_number"));
        out.put("documentName", activity.get("document_name"));
        out.put("revisionNumber", activity.get("revision_number"));
        List<Map<String, Object>> matrix = jdbc.queryForList("select v.id, v.version_no from training_matrix_versions v join training_matrices m on m.id = v.matrix_id where m.department_id = ? and v.status = 'EFFECTIVE'", department);
        out.put("effectiveMatrix", matrix.isEmpty() ? null : TrainingRows.camel(matrix.getFirst()));
        List<String> inMatrix = matrix.isEmpty() || activity.get("document_id") == null ? List.of() : jdbc.queryForList("""
            select p.name from training_matrix_rows r join training_matrix_cells c on c.row_id = r.id join training_job_roles p on p.id = c.position_id
             where r.version_id = ? and r.document_id = ? order by p.name
            """, String.class, matrix.getFirst().get("id"), activity.get("document_id"));
        boolean rowExists = !matrix.isEmpty() && activity.get("document_id") != null && Boolean.TRUE.equals(jdbc.queryForObject("select exists (select 1 from training_matrix_rows r where r.version_id = ? and r.document_id = ?)", Boolean.class, matrix.getFirst().get("id"), activity.get("document_id")));
        out.put("inEffectiveMatrix", rowExists);
        out.put("positionsInMatrix", inMatrix);
        out.put("positions", TrainingRows.camel(jdbc.queryForList("select id, name from training_job_roles where is_active and department_id = ? order by name", department)));
        out.put("latest", TrainingRows.camel(jdbc.queryForList("select i.outcome, i.reason, i.positions, i.assessed_at, u.full_name as assessed_by_name from training_impact_assessments i join app_users u on u.id = i.assessed_by where i.activity_id = ? order by i.assessed_at desc limit 5", activityId)));
        return out;
    }

    @Transactional
    public Map<String, Object> assess(UserAccount actor, UUID activityId, AssessRequest request) {
        Map<String, Object> activity = store.activityForUpdate(activityId).orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        UUID department = (UUID) activity.get("organizer_department_id");
        access.require(actor, "training.matrix.manage");
        access.requireScope(actor, department);
        if (activity.get("document_id") == null || activity.get("parent_activity_id") != null || "CANCELLED".equals(activity.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_IMPACT_NOT_APPLICABLE");
        if (request == null || request.outcome() == null || !OUTCOMES.contains(request.outcome())) throw new IllegalArgumentException("TRAINING_IMPACT_OUTCOME_INVALID");
        if (request.reason() == null || request.reason().isBlank()) throw new IllegalArgumentException("TRAINING_REASON_REQUIRED");
        if (request.signatureToken() == null || request.signatureToken().isBlank()) throw new IllegalArgumentException("TRAINING_SIGNATURE_REQUIRED");
        Set<UUID> wanted = new LinkedHashSet<>(request.positionIds() == null ? List.<UUID>of() : request.positionIds());
        List<Map<String, Object>> chosen = new ArrayList<>();
        for (UUID positionId : wanted) {
            List<Map<String, Object>> found = jdbc.queryForList("select id, name from training_job_roles where id = ? and is_active and department_id = ?", positionId, department);
            if (found.isEmpty()) throw new IllegalArgumentException("TRAINING_IMPACT_POSITION_INVALID");
            chosen.add(Map.of("id", String.valueOf(positionId), "name", String.valueOf(found.getFirst().get("name"))));
        }
        if ("MATRIX_UPDATE_NEEDED".equals(request.outcome()) && chosen.isEmpty()) throw new IllegalArgumentException("TRAINING_IMPACT_POSITION_REQUIRED");
        if ("MATRIX_ALREADY_COVERS".equals(request.outcome()) && !Boolean.TRUE.equals(jdbc.queryForObject("select " + COVERED.replace("a.", "x.") + " from training_activities x where x.id = ?", Boolean.class, activityId))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_IMPACT_NOT_IN_MATRIX");
        }
        UUID id = UUID.randomUUID();
        UUID signature = signatures.createEntitySignature(TYPE, id, activity.get("training_number") + " impact on the matrix", actor, request.signatureToken(), "TRAINING_IMPACT_ASSESSED",
                "Training Management: impact of the document on the training matrix", null, null, null).getId();
        String positions;
        try { positions = json.writeValueAsString(chosen); } catch (JsonProcessingException e) { throw new IllegalStateException(e); }
        jdbc.update("insert into training_impact_assessments(id, activity_id, outcome, reason, positions, assessed_by, signature_id) values (?,?,?,?,cast(? as jsonb),?,?)", id, activityId, request.outcome(), request.reason().trim(), positions, actor.getId(), signature);
        store.event(TrainingStore.OBJECT_ACTIVITY, activityId, activityId, "IMPACT_ASSESSED", Map.of("outcome", request.outcome()), actor.getId());
        List<AuditTrailChangeResponse> changes = List.of(
                new AuditTrailChangeResponse("Impact on the training matrix", null, request.outcome().replace('_', ' ').toLowerCase(Locale.ROOT)),
                new AuditTrailChangeResponse("Positions to be trained", null, chosen.isEmpty() ? "none" : String.join(", ", chosen.stream().map(c -> String.valueOf(c.get("name"))).toList())),
                new AuditTrailChangeResponse("Reason", null, request.reason().trim()));
        store.auditActivity(actor, activity, "TRAINING_IMPACT_ASSESSED", null, null, "Impact of " + activity.get("document_number") + " on the training matrix assessed by " + actor.getFullName(), changes);
        return context(actor, activityId);
    }
}
