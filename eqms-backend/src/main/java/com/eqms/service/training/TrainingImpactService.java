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
    public record AssessRequest(String outcome, String reason, List<UUID> positionIds, String signatureToken, List<UUID> relatedDepartmentIds) {
        public AssessRequest(String outcome, String reason, List<UUID> positionIds, String signatureToken) { this(outcome, reason, positionIds, signatureToken, null); }
    }

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
        exists (select 1 from training_effective_requirements r where r.department_id = d.id and r.document_id = a.document_id)
        """;

    /** The departments that assess an activity: the one that owns the document and the ones it named as related (SOP.0003 5.3.1). */
    private static final String INVOLVED = "(a.organizer_department_id = d.id or exists (select 1 from training_impact_departments t where t.activity_id = a.id and t.department_id = d.id))";

    /** One line per activity and assessing department; the one parameter is the department. */
    private static final String BASE = """
        select a.id, a.training_number, training_activity_topics(a.id) as training_topics, a.status as activity_status, a.document_id, a.revision_id, a.document_number, a.document_name, a.revision_number, a.kind_reason, a.organizer_department_id,
               d.id as assessing_department_id, d.name as department_name, (a.organizer_department_id = d.id) as owner_department, a.created_at, x.outcome, x.assessed_at, ux.full_name as assessed_by_name, x.reason as assessment_reason,
               case when x.id is null then 'PENDING'
                    when x.outcome = 'MATRIX_UPDATE_NEEDED' and not %s then 'MATRIX_UPDATE_PENDING'
                    else 'DONE' end as impact_status
          from training_activities a join departments d on d.id = ?
          left join lateral (select * from training_impact_assessments i where i.activity_id = a.id and coalesce(i.department_id, a.organizer_department_id) = d.id order by i.assessed_at desc limit 1) x on true
          left join app_users ux on ux.id = x.assessed_by
         where a.document_id is not null and a.parent_activity_id is null and a.status <> 'CANCELLED' and a.kind_reason in ('NEW_SOP','SOP_VERSION') and %s
        """.formatted(COVERED, INVOLVED);

    /** The statuses of the activity in which the impact can still be assessed: before the participants are notified (SOP.0003 5.3.1: before the training is developed and implemented). */
    static final java.util.Set<String> ASSESSABLE = java.util.Set.of("RESERVED", "PLANNED", "PENDING_APPROVAL");

    /**
     * What stops the participants of a training from being notified: the document of the training is new or revised and its impact on the matrix is not assessed (TRAINING_IMPACT_NOT_ASSESSED),
     * or the assessment says the matrix must be updated and no effective matrix of the department has the document yet (TRAINING_MATRIX_NOT_UPDATED). SOP.0003 5.3.1: the department assesses
     * the impact, names the positions and updates the matrix before the training is developed and implemented. Null when nothing stops it, and for a training that is not subject to the assessment.
     */
    @Transactional(readOnly = true)
    public String notifyBlocker(UUID activityId) {
        List<UUID> owner = jdbc.queryForList("select organizer_department_id from training_activities where id = ?", UUID.class, activityId);
        if (owner.isEmpty() || owner.getFirst() == null) return null;
        List<UUID> departments = new ArrayList<>(owner);
        departments.addAll(related(activityId));
        // every department that assesses must be done; the one that has not assessed is named before the one whose matrix still has to be updated
        String blocker = null;
        for (UUID department : departments) {
            List<String> rows = jdbc.queryForList("select x.impact_status from (" + BASE + ") x where x.id = ?", String.class, department, activityId);
            if (rows.isEmpty()) continue;
            if ("PENDING".equals(rows.getFirst())) return "TRAINING_IMPACT_NOT_ASSESSED";
            if ("MATRIX_UPDATE_PENDING".equals(rows.getFirst())) blocker = "TRAINING_MATRIX_NOT_UPDATED";
        }
        return blocker;
    }

    private List<UUID> related(UUID activityId) {
        return jdbc.queryForList("select department_id from training_impact_departments where activity_id = ?", UUID.class, activityId);
    }

    /** The department the person works on this activity for: their own when it assesses it, otherwise the one that owns the document. */
    private UUID assessingDepartment(UserAccount actor, Map<String, Object> activity) {
        UUID owner = (UUID) activity.get("organizer_department_id");
        UUID own = access.departmentOf(actor);
        return own != null && !own.equals(owner) && related((UUID) activity.get("id")).contains(own) ? own : owner;
    }

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
        return list(actor, departmentId, status, activityStatus, search, false, sortBy, sortDirection, page, limit);
    }

    /** {@code waitingForMe}: the lines of the person's own department that are not done and can still be assessed; nothing for a person who may not assess. */
    @Transactional(readOnly = true)
    public Map<String, Object> list(UserAccount actor, UUID departmentId, String status, String activityStatus, String search, boolean waitingForMe, String sortBy, String sortDirection, int page, int limit) {
        UUID department = department(actor, departmentId);
        List<Object> args = new ArrayList<>();
        args.add(department);
        StringBuilder where = new StringBuilder(" where 1=1");
        if (waitingForMe) {
            if (access.has(actor, "training.matrix.manage") && department.equals(access.departmentOf(actor))) {
                where.append(" and x.impact_status <> 'DONE' and x.activity_status in ('RESERVED','PLANNED','PENDING_APPROVAL')");
            } else {
                where.append(" and false");
            }
        }
        if (status != null && !status.isBlank()) {
            if (!List.of("PENDING", "MATRIX_UPDATE_PENDING", "DONE", "OPEN").contains(status)) throw new IllegalArgumentException("TRAINING_STATUS_INVALID");
            if ("OPEN".equals(status)) where.append(" and x.impact_status <> 'DONE'");
            else { where.append(" and x.impact_status = ?"); args.add(status); }
        }
        if (activityStatus != null && !activityStatus.isBlank()) {
            if (!List.of("RESERVED", "PLANNED", "PENDING_APPROVAL", "NOTIFIED", "IN_PROGRESS", "PENDING_QA_CONFIRMATION", "COMPLETED", "CANCELLED").contains(activityStatus)) throw new IllegalArgumentException("TRAINING_STATUS_INVALID");
            where.append(" and x.activity_status = ?");
            args.add(activityStatus);
        }
        if (search != null && !search.isBlank()) {
            String like = "%" + search.trim().toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
            where.append(" and (eqms_fold(x.training_number) like eqms_fold(?) escape '\\' or eqms_fold(coalesce(x.document_number,'')) like eqms_fold(?) escape '\\' or eqms_fold(coalesce(x.document_name,'')) like eqms_fold(?) escape '\\' or eqms_fold(training_activity_topics(x.id)) like eqms_fold(?) escape '\\')");
            for (int i = 0; i < 4; i++) args.add(like);
        }
        int safeLimit = Math.min(Math.max(limit, 1), 100), safePage = Math.max(page, 1);
        Long total = jdbc.queryForObject("select count(*) from (" + BASE + ") x" + where, Long.class, args.toArray());
        args.add(safeLimit);
        args.add((safePage - 1) * safeLimit);
        List<Map<String, Object>> rows = jdbc.queryForList("select x.* from (" + BASE + ") x" + where
                + TrainingRows.orderBy(sortBy, sortDirection, Map.of("trainingNumber", "x.training_number", "documentNumber", "x.document_number", "documentName", "x.document_name", "revisionNumber", "x.revision_number", "activityStatus", "x.activity_status", "departmentName", "x.department_name",
                        "impactStatus", "x.impact_status", "assessedAt", "x.assessed_at", "createdAt", "x.created_at"), "case x.impact_status when 'PENDING' then 0 when 'MATRIX_UPDATE_PENDING' then 1 else 2 end, x.created_at desc")
                + " limit ? offset ?", args.toArray());
        // SOP.0003 5.3.1: the department itself assesses the impact on its matrix; another department can be looked at (all-department scope) but not assessed
        boolean manage = access.has(actor, "training.matrix.manage");
        UUID own = access.departmentOf(actor);
        // and only until the participants are notified
        for (Map<String, Object> row : rows) {
            boolean assessable = ASSESSABLE.contains(String.valueOf(row.get("activity_status")));
            row.put("can_assess", manage && own != null && own.equals(row.get("assessing_department_id")) && assessable);
            // the training was implemented before the impact was assessed or the matrix updated: a deviation from SOP.0003 5.3.1, handled outside this screen (the Deviation module comes later)
            row.put("deviation", !assessable && !"DONE".equals(row.get("impact_status")));
        }
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
            select x.department_id, x.department_name as name, count(*) filter (where x.impact_status = 'PENDING') as pending,
                   count(*) filter (where x.impact_status = 'MATRIX_UPDATE_PENDING') as update_pending
              from (select d.id as department_id, d.name as department_name,
                           case when i.id is null then 'PENDING' when i.outcome = 'MATRIX_UPDATE_NEEDED' and not %s then 'MATRIX_UPDATE_PENDING' else 'DONE' end as impact_status
                      from training_activities a join departments d on %s
                      left join lateral (select * from training_impact_assessments q where q.activity_id = a.id and coalesce(q.department_id, a.organizer_department_id) = d.id order by q.assessed_at desc limit 1) i on true
                     where a.document_id is not null and a.parent_activity_id is null and a.status <> 'CANCELLED' and a.kind_reason in ('NEW_SOP','SOP_VERSION')) x
             where x.impact_status <> 'DONE' group by x.department_id, x.department_name
            """.formatted(COVERED, INVOLVED));
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
        UUID department = assessingDepartment(actor, activity);
        access.require(actor, "training.matrix.view", "training.matrix.manage");
        access.requireScope(actor, department);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("activityId", activityId);
        out.put("departmentId", department);
        out.put("ownerDepartment", department.equals(activity.get("organizer_department_id")));
        out.put("relatedDepartments", TrainingRows.camel(jdbc.queryForList("""
            select d.id, d.name, exists (select 1 from training_impact_assessments i where i.activity_id = t.activity_id and i.department_id = d.id) as assessed
              from training_impact_departments t join departments d on d.id = t.department_id where t.activity_id = ? order by d.name
            """, activityId)));
        out.put("trainingNumber", activity.get("training_number"));
        out.put("documentNumber", activity.get("document_number"));
        out.put("documentName", activity.get("document_name"));
        out.put("revisionNumber", activity.get("revision_number"));
        List<Map<String, Object>> matrix = jdbc.queryForList("select v.id, v.version_no from training_matrix_versions v join training_matrices m on m.id = v.matrix_id where m.department_id = ? and m.scope = 'DEPARTMENT' and v.status = 'EFFECTIVE'", department);
        out.put("effectiveMatrix", matrix.isEmpty() ? null : TrainingRows.camel(matrix.getFirst()));
        List<String> inMatrix = matrix.isEmpty() || activity.get("document_id") == null ? List.of() : jdbc.queryForList("""
            select p.name from training_matrix_rows r join training_matrix_cells c on c.row_id = r.id join training_job_roles p on p.id = c.position_id
             where r.version_id = ? and r.document_id = ? order by p.name
            """, String.class, matrix.getFirst().get("id"), activity.get("document_id"));
        boolean rowExists = !matrix.isEmpty() && activity.get("document_id") != null && Boolean.TRUE.equals(jdbc.queryForObject("select exists (select 1 from training_matrix_rows r where r.version_id = ? and r.document_id = ?)", Boolean.class, matrix.getFirst().get("id"), activity.get("document_id")));
        out.put("inEffectiveMatrix", rowExists);
        out.put("positionsInMatrix", inMatrix);
        out.put("positions", TrainingRows.camel(jdbc.queryForList("select id, name from training_job_roles where is_active and department_id = ? order by name", department)));
        out.put("latest", TrainingRows.camel(jdbc.queryForList("select i.outcome, i.reason, i.positions, i.assessed_at, u.full_name as assessed_by_name from training_impact_assessments i join app_users u on u.id = i.assessed_by join training_activities a on a.id = i.activity_id where i.activity_id = ? and coalesce(i.department_id, a.organizer_department_id) = ? order by i.assessed_at desc limit 5", activityId, department)));
        return out;
    }

    /**
     * The Work Positions of the department that can be named in the assessment, one page at a time: the search (name or code), the sort and the paging are done here, so a department with many
     * positions is not sent whole. {@code inMatrix} tells whether the effective matrix of the department already has the document for that position.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> positions(UserAccount actor, UUID activityId, String search, String sortBy, String sortDirection, int page, int limit) {
        Map<String, Object> activity = row(activityId);
        UUID department = assessingDepartment(actor, activity);
        access.require(actor, "training.matrix.view", "training.matrix.manage");
        access.requireScope(actor, department);
        List<Object> args = new ArrayList<>();
        String inMatrix = """
            exists (select 1 from training_matrix_cells c join training_matrix_rows r on r.id = c.row_id join training_matrix_versions v on v.id = r.version_id
                     where v.status = 'EFFECTIVE' and v.matrix_id in (select m.id from training_matrices m where m.department_id = p.department_id and m.scope = 'DEPARTMENT') and r.document_id = ? and c.position_id = p.id)
            """;
        args.add(activity.get("document_id"));
        List<Object> filterArgs = new ArrayList<>();
        filterArgs.add(department);
        StringBuilder where = new StringBuilder(" where p.is_active and p.department_id = ?");
        if (search != null && !search.isBlank()) {
            String like = "%" + search.trim().toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
            where.append(" and (eqms_fold(p.name) like eqms_fold(?) escape '\\' or eqms_fold(coalesce(p.code,'')) like eqms_fold(?) escape '\\')");
            filterArgs.add(like);
            filterArgs.add(like);
        }
        int safeLimit = Math.min(Math.max(limit, 1), 100), safePage = Math.max(page, 1);
        Long total = jdbc.queryForObject("select count(*) from training_job_roles p" + where, Long.class, filterArgs.toArray());
        args.addAll(filterArgs);
        args.add(safeLimit);
        args.add((safePage - 1) * safeLimit);
        List<Map<String, Object>> rows = jdbc.queryForList("select p.id, p.code, p.name, " + inMatrix + " as in_matrix from training_job_roles p" + where
                + TrainingRows.orderBy(sortBy, sortDirection, Map.of("name", "p.name", "code", "p.code", "inMatrix", "in_matrix"), "p.name")
                + " limit ? offset ?", args.toArray());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("data", TrainingRows.camel(rows));
        long count = total == null ? 0 : total;
        result.put("pagination", Map.of("page", safePage, "limit", safeLimit, "total", count, "totalPages", Math.max(1, (count + safeLimit - 1) / safeLimit)));
        return result;
    }

    @Transactional
    public Map<String, Object> assess(UserAccount actor, UUID activityId, AssessRequest request) {
        Map<String, Object> activity = store.activityForUpdate(activityId).orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        UUID owner = (UUID) activity.get("organizer_department_id");
        UUID department = assessingDepartment(actor, activity);
        access.require(actor, "training.matrix.manage");
        // only a person of the department assesses (SOP.0003 5.3.1); the permission to see every department lets a person look, not assess
        if (!access.inOwnDepartment(actor, department)) throw new SecurityException(TrainingAccess.DENIED);
        if (!ASSESSABLE.contains(String.valueOf(activity.get("status"))) && !"CANCELLED".equals(activity.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_IMPACT_AFTER_NOTICE");
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
        if ("MATRIX_ALREADY_COVERS".equals(request.outcome()) && !Boolean.TRUE.equals(jdbc.queryForObject(
                "select exists (select 1 from training_effective_requirements r where r.department_id = ? and r.document_id = x.document_id) from training_activities x where x.id = ?", Boolean.class, department, activityId))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_IMPACT_NOT_IN_MATRIX");
        }
        UUID id = UUID.randomUUID();
        UUID signature = signatures.createEntitySignature(TYPE, id, activity.get("training_number") + " impact on the matrix", actor, request.signatureToken(), "TRAINING_IMPACT_ASSESSED",
                "Training Management: impact of the document on the training matrix", null, null, null).getId();
        String positions;
        try { positions = json.writeValueAsString(chosen); } catch (JsonProcessingException e) { throw new IllegalStateException(e); }
        jdbc.update("insert into training_impact_assessments(id, activity_id, outcome, reason, positions, assessed_by, signature_id, department_id) values (?,?,?,?,cast(? as jsonb),?,?,?)", id, activityId, request.outcome(), request.reason().trim(), positions, actor.getId(), signature, department);
        List<String> added = department.equals(owner) ? setRelated(actor, activityId, owner, request.relatedDepartmentIds()) : List.of();
        store.event(TrainingStore.OBJECT_ACTIVITY, activityId, activityId, "IMPACT_ASSESSED", Map.of("outcome", request.outcome()), actor.getId());
        List<AuditTrailChangeResponse> changes = List.of(
                new AuditTrailChangeResponse("Impact on the training matrix", null, request.outcome().replace('_', ' ').toLowerCase(Locale.ROOT)),
                new AuditTrailChangeResponse("Positions to be trained", null, chosen.isEmpty() ? "none" : String.join(", ", chosen.stream().map(c -> String.valueOf(c.get("name"))).toList())),
                new AuditTrailChangeResponse("Reason", null, request.reason().trim()));
        if (!added.isEmpty()) changes = java.util.stream.Stream.concat(changes.stream(), java.util.stream.Stream.of(new AuditTrailChangeResponse("Related departments that also assess", null, String.join(", ", added)))).toList();
        store.auditActivity(actor, activity, "TRAINING_IMPACT_ASSESSED", null, null, "Impact of " + activity.get("document_number") + " on the training matrix assessed by " + actor.getFullName(), changes);
        return context(actor, activityId);
    }

    /**
     * The related departments the owner of the document names. A department that has already assessed stays. {@code null} leaves the list as it is.
     * Returns the names of the departments now related, when the list was given.
     */
    private List<String> setRelated(UserAccount actor, UUID activityId, UUID owner, List<UUID> wanted) {
        if (wanted == null) return List.of();
        Set<UUID> keep = new LinkedHashSet<>(wanted);
        keep.remove(owner);
        for (UUID current : related(activityId)) {
            if (keep.contains(current)) continue;
            jdbc.update("delete from training_impact_departments t where t.activity_id = ? and t.department_id = ? and not exists (select 1 from training_impact_assessments i where i.activity_id = t.activity_id and i.department_id = t.department_id)", activityId, current);
        }
        for (UUID department : keep) {
            Integer found = jdbc.queryForObject("select count(*) from departments where id = ?", Integer.class, department);
            if (found == null || found == 0) throw new IllegalArgumentException("TRAINING_DEPARTMENT_REQUIRED");
            jdbc.update("insert into training_impact_departments(activity_id, department_id, added_by) values (?,?,?) on conflict do nothing", activityId, department, actor.getId());
        }
        return jdbc.queryForList("select d.name from training_impact_departments t join departments d on d.id = t.department_id where t.activity_id = ? order by d.name", String.class, activityId);
    }
}
