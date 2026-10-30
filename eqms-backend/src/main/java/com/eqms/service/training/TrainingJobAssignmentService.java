package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.AuditTrailService;
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
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Job assignments (APD.0024, SOP.0003 section 5.3.8). A person is given a position only after the training the matrix requires for it, or by an exception
 * that a designated person approves with a signature. The person who assigns signs, then the employee accepts with a signature; accepting makes the
 * assignment effective and replaces the earlier one. A signed assignment is never changed.
 */
@Service
public class TrainingJobAssignmentService {
    private static final String TYPE = "TRAINING_JOB_ASSIGNMENT";
    private final ObjectMapper json = new ObjectMapper();

    private final JdbcTemplate jdbc;
    private final TrainingAccess access;
    private final TrainingApprovalService approvals;
    private final ElectronicSignatureService signatures;
    private final AuditTrailService audit;
    private final UserAccountRepository users;
    private final TrainingNotifier notifier;

    public TrainingJobAssignmentService(JdbcTemplate jdbc, TrainingAccess access, TrainingApprovalService approvals, ElectronicSignatureService signatures,
                                        AuditTrailService audit, UserAccountRepository users, TrainingNotifier notifier) {
        this.jdbc = jdbc;
        this.access = access;
        this.approvals = approvals;
        this.signatures = signatures;
        this.audit = audit;
        this.users = users;
        this.notifier = notifier;
    }

    public record DutyRequest(String responsibility, String description, String responsibilityEn, String descriptionEn) {
        public DutyRequest(String responsibility, String description) { this(responsibility, description, null, null); }
    }
    public record SaveRequest(UUID personUserId, UUID positionId, List<UUID> positionIds, String directSuperiorTitle, String subordinateTitles, String substituteTitle, String changeReason,
                              String jurisdiction, List<DutyRequest> duties, Integer version, String mode, UUID replacesPositionId, List<String> requiredTopics, List<UUID> requiredDocumentIds) {}
    public record ExceptionRequest(String reason, UUID approverUserId) {}
    public record SignRequest(Integer version, String signatureToken, String assignorTitle) {}
    public record CancelRequest(Integer version, String reason) {}

    // ----------------------------------------------------------------------------------------------------------------------------- reading

    @Transactional(readOnly = true)
    public Map<String, Object> list(UserAccount actor, String search, String status, String sortBy, String sortDirection, int page, int limit) {
        return list(actor, search, status, sortBy, sortDirection, page, limit, Map.of());
    }

    @Transactional(readOnly = true)
    public Map<String, Object> list(UserAccount actor, String search, String status, String sortBy, String sortDirection, int page, int limit, Map<String, String> more) {
        access.require(actor, "training.job_assignment.view", "training.job_assignment.manage", "training.self.view");
        List<Object> args = new ArrayList<>();
        StringBuilder where = new StringBuilder(" where 1=1");
        boolean wide = access.has(actor, "training.job_assignment.view", "training.job_assignment.manage");
        if (!wide) {
            where.append(" and j.person_user_id = ?");
            args.add(actor.getId());
        } else if (!access.allDepartments(actor)) {
            UUID own = access.departmentOf(actor);
            where.append(" and (j.department_id = ? or j.person_user_id = ?)");
            args.add(own == null ? new UUID(0, 0) : own);
            args.add(actor.getId());
        }
        if (status != null && !status.isBlank()) { where.append(" and j.status = ?"); args.add(status); }
        if (search != null && !search.isBlank()) {
            String like = "%" + search.trim().toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
            where.append(" and (lower(u.full_name) like ? escape '\\' or lower(coalesce(u.employee_code,'')) like ? escape '\\' or exists (select 1 from training_job_assignment_roles sr join training_job_roles sj on sj.id = sr.job_role_id where sr.assignment_id = j.id and lower(sj.name) like ? escape '\\') or lower(coalesce(d.name,'')) like ? escape '\\')");
            args.add(like); args.add(like); args.add(like); args.add(like);
        }
        TrainingListFilter extra = new TrainingListFilter().equal("j.person_user_id", uuid(more.get("personId"))).equal("j.case_type", more.get("caseType")).equal("j.department_id", uuid(more.get("departmentId"))).raw(uuid(more.get("positionId")) == null ? "true" : "exists (select 1 from training_job_assignment_roles fr where fr.assignment_id = j.id and fr.job_role_id = ?)", uuid(more.get("positionId")) == null ? new Object[0] : new Object[]{uuid(more.get("positionId"))})
                .timeRange("j.effective_at", more.get("effectiveFrom"), more.get("effectiveTo")).timeRange("j.created_at", more.get("createdFrom"), more.get("createdTo"));
        where.append(extra.and());
        args.addAll(extra.args());
        String from = " from training_job_assignments j join app_users u on u.id = j.person_user_id join training_job_roles p on p.id = j.position_id join departments d on d.id = j.department_id ";
        Long total = jdbc.queryForObject("select count(*)" + from + where, Long.class, args.toArray());
        int safeLimit = Math.min(Math.max(limit, 1), 100), safePage = Math.max(page, 1);
        args.add(safeLimit); args.add((safePage - 1) * safeLimit);
        List<Map<String, Object>> rows = jdbc.queryForList("select j.id, j.issue_no, j.case_type, j.status, j.created_at, j.effective_at, j.department_id, j.person_user_id, u.full_name, u.employee_code, u.avatar, (select string_agg(r.name, ', ' order by ar.sort_order) from training_job_assignment_roles ar join training_job_roles r on r.id = ar.job_role_id where ar.assignment_id = j.id) as position_name, (select coalesce(json_agg(json_build_object('id', p.id, 'name', p.name, 'carried', p.carried) order by p.sort_order, p.id), '[]'::json)::text from (select r.id, r.name, ar.carried, ar.sort_order from training_job_assignment_roles ar join training_job_roles r on r.id = ar.job_role_id where ar.assignment_id = j.id order by ar.sort_order, r.id limit 2) p) as positions_json, (select count(*) from training_job_assignment_roles ar where ar.assignment_id = j.id) as positions_count, d.name as department_name"
                + from + where + TrainingRows.orderBy(sortBy, sortDirection, Map.of("employee", "u.full_name", "employeeCode", "u.employee_code", "position", "p.name", "department", "d.name", "type", "j.case_type", "issue", "j.issue_no", "status", "j.status", "effective", "j.effective_at", "createdAt", "j.created_at"),
                "j.created_at desc") + " limit ? offset ?", args.toArray());
        // what the menu of a row may offer, decided here: the permission and the department for the draft, the person herself or himself for the acceptance
        boolean manage = access.has(actor, "training.job_assignment.manage");
        for (Map<String, Object> row : rows) {
            try {
                row.put("positions", json.readValue((String) row.remove("positions_json"), List.class));
            } catch (JsonProcessingException e) {
                throw new IllegalStateException("Invalid job assignment positions", e);
            }
            UUID rowDepartment = (UUID) row.remove("department_id");
            UUID rowPerson = (UUID) row.remove("person_user_id");
            Map<String, Object> actions = new LinkedHashMap<>();
            actions.put("view", true);
            actions.put("continueDraft", "DRAFT".equals(row.get("status")) && manage && access.inScope(actor, rowDepartment));
            actions.put("review", "PENDING_RECEIVER".equals(row.get("status")) && actor.getId().equals(rowPerson));
            row.put("actions", actions);
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("data", TrainingRows.camel(rows));
        long count = total == null ? 0 : total;
        result.put("pagination", Map.of("page", safePage, "limit", safeLimit, "total", count, "totalPages", Math.max(1, (count + safeLimit - 1) / safeLimit)));
        return result;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> positions(UserAccount actor, UUID id, String search, int page, int limit) {
        visible(actor, id);
        String like = "%" + (search == null ? "" : search.trim().toLowerCase(Locale.ROOT)).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
        int safePage = Math.max(1, page);
        int safeLimit = Math.min(100, Math.max(1, limit));
        Long count = jdbc.queryForObject("""
            select count(*) from training_job_assignment_roles ar join training_job_roles r on r.id = ar.job_role_id
             where ar.assignment_id = ? and lower(r.name) like ? escape '\\'
            """, Long.class, id, like);
        long total = count == null ? 0 : count;
        List<Map<String, Object>> rows = TrainingRows.camel(jdbc.queryForList("""
            select r.id::text as id, r.name, coalesce(d.name, '') as department, ar.carried
              from training_job_assignment_roles ar join training_job_roles r on r.id = ar.job_role_id
              left join departments d on d.id = r.department_id
             where ar.assignment_id = ? and lower(r.name) like ? escape '\\' order by ar.sort_order, r.id
             limit ? offset ?
            """, id, like, safeLimit, (long) (safePage - 1) * safeLimit));
        return Map.of("data", rows, "pagination", Map.of("page", safePage, "limit", safeLimit, "total", total,
                "totalPages", Math.max(1, (total + safeLimit - 1) / safeLimit)));
    }

    private static UUID uuid(String value) {
        try {
            return value == null || value.isBlank() ? null : UUID.fromString(value.trim());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("TRAINING_FILTER_INVALID");
        }
    }

    /**
     * The work position that the person holds for Training now (the one of the effective job assignment, or the one Training Administration gave), for the profile of the person: read only, it does not
     * change the Position of the user record, which is the title of the person. The person, or someone who may see the Training positions of the department; an empty answer when there is none.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> workPositionOf(UserAccount actor, UUID personId) {
        if (!actor.getId().equals(personId)) {
            access.require(actor, "training.job_assignment.view", "training.matrix.view", "training.job_assignment.manage");
            UserAccount person = users.findById(personId).orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
            UUID department = access.departmentOf(person);
            if (!(access.allDepartments(actor) || (department != null && access.inScope(actor, department)))) throw new SecurityException(TrainingAccess.DENIED);
        }
        List<Map<String, Object>> roles = TrainingRows.camel(jdbc.queryForList("""
            select p.id as job_role_id, p.name as position_name, d.name as department_name, tp.valid_from, tp.source
              from training_person_positions tp join training_job_roles p on p.id = tp.position_id left join departments d on d.id = tp.department_id
             where tp.person_user_id = ? and tp.valid_to is null order by p.name
            """, personId));
        if (roles.isEmpty()) return null;
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("roles", roles);
        out.put("positionName", roles.stream().map(r -> String.valueOf(r.get("positionName"))).collect(java.util.stream.Collectors.joining(", ")));
        out.put("source", roles.getFirst().get("source"));
        return out;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> get(UserAccount actor, UUID id) {
        Map<String, Object> j = visible(actor, id);
        Map<String, Object> out = TrainingRows.camel(j);
        out.put("personName", jdbc.queryForObject("select full_name from app_users where id=?", String.class, j.get("person_user_id")));
        List<Map<String, Object>> roleRows = jdbc.queryForList("""
            select r.id::text as id, r.name as name, coalesce(d.name, '') as department, ar.carried as carried
              from training_job_assignment_roles ar join training_job_roles r on r.id = ar.job_role_id left join departments d on d.id = r.department_id
             where ar.assignment_id = ? order by ar.sort_order
            """, id);
        out.put("roles", roleRows);
        out.put("positionName", roleRows.stream().map(r -> String.valueOf(r.get("name"))).collect(java.util.stream.Collectors.joining(", ")));
        out.put("departmentName", jdbc.queryForObject("select name from departments where id=?", String.class, j.get("department_id")));
        out.put("departmentNames", roleRows.stream().map(r -> String.valueOf(r.get("department"))).filter(x -> !x.isBlank()).distinct().collect(java.util.stream.Collectors.joining(", ")));
        out.put("previousPositionName", j.get("previous_position_id") == null ? null : jdbc.queryForObject("select name from training_job_roles where id=?", String.class, j.get("previous_position_id")));
        putRoleLists(out, j);
        out.remove("heldBefore");
        out.put("duties", TrainingRows.camel(jdbc.queryForList("select sort_order, responsibility, description, responsibility_en, description_en from training_job_assignment_duties where assignment_id=? order by sort_order", id)));
        out.put("approvers", TrainingRows.camel(approvals.assignments(TYPE, id)));
        // Who signed and when, as the Signatures tab shows it (the signature itself is kept by the signature service; this only reads it).
        out.put("signatures", TrainingRows.camel(jdbc.queryForList("select meaning, full_name, signed_at from electronic_signatures where entity_type=? and entity_id=? and status='SIGNED' order by signed_at", TYPE, id)));
        out.put("requiredItems", TrainingRows.camel(jdbc.queryForList("""
            select i.topic_text, i.document_id, coalesce(i.topic_text, d.document_name) as title, d.document_number as code
              from training_job_required_items i left join documents d on d.id = i.document_id where i.assignment_id = ? order by i.sort_order
            """, id)));
        if ("DRAFT".equals(j.get("status"))) out.put("eligibility", eligibilityForRoles((UUID) j.get("person_user_id"), newRolesOf(id), requiredOf(id)));
        out.put("capabilities", capabilities(actor, j));
        return out;
    }

    /** The Work Positions the person holds now, as the form of a change or an additional assignment lists them (id, name, department). */
    private String heldRolesJson(UUID personId) {
        List<Map<String, Object>> held = jdbc.queryForList("""
            select r.id::text as id, r.name as name, coalesce(d.name, '') as department
              from training_person_positions tp join training_job_roles r on r.id = tp.position_id left join departments d on d.id = r.department_id
             where tp.person_user_id = ? and tp.valid_to is null order by r.name
            """, personId);
        try { return json.writeValueAsString(held); } catch (JsonProcessingException e) { throw new IllegalStateException(e); }
    }

    /** The roles listed on the form: held before, and held after (before, without the one that is replaced, with the one that is given). */
    @SuppressWarnings("unchecked")
    private void putRoleLists(Map<String, Object> out, Map<String, Object> j) {
        out.put("rolesAfter", out.get("roles"));
        if (j.get("held_before") == null) return;
        try {
            List<Map<String, Object>> before = json.readValue(String.valueOf(j.get("held_before")), List.class);
            out.put("rolesBefore", before);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    private Map<String, Object> capabilities(UserAccount actor, Map<String, Object> j) {
        String status = String.valueOf(j.get("status"));
        UUID department = (UUID) j.get("department_id");
        boolean manage = access.has(actor, "training.job_assignment.manage") && access.inScope(actor, department);
        boolean assignedException = jdbc.queryForObject("select count(*) from training_approval_assignments where object_type=? and object_id=? and step_code='JOB_ASSIGN_EXCEPTION' and status='PENDING' and assignee_user_id=?",
                Integer.class, TYPE, j.get("id"), actor.getId()) > 0;
        Map<String, Object> caps = new LinkedHashMap<>();
        caps.put("edit", manage && "DRAFT".equals(status));
        caps.put("requestException", manage && "DRAFT".equals(status) && j.get("exception_approved_by") == null);
        caps.put("approveException", "DRAFT".equals(status) && assignedException);
        caps.put("submit", manage && "DRAFT".equals(status) && !actor.getId().equals(j.get("person_user_id")));
        caps.put("accept", "PENDING_RECEIVER".equals(status) && actor.getId().equals(j.get("person_user_id")));
        caps.put("cancel", manage && ("DRAFT".equals(status) || "PENDING_RECEIVER".equals(status)));
        return caps;
    }

    /** What the person still has to be trained on before taking the position, from the effective matrix of the department. */
    @Transactional(readOnly = true)
    public Map<String, Object> eligibility(UserAccount actor, UUID personId, List<UUID> positionIds, List<String> topics, List<UUID> documentIds) {
        access.require(actor, "training.job_assignment.manage", "training.job_assignment.view");
        if (positionIds == null || positionIds.isEmpty()) throw new IllegalArgumentException("TRAINING_JOB_INVALID");
        for (UUID role : positionIds) access.requireScope(actor, positionDepartment(role));
        List<Object[]> extra = new ArrayList<>();
        for (String t : topics == null ? List.<String>of() : topics) if (t != null && !t.isBlank()) extra.add(new Object[]{t.trim(), null});
        for (UUID d : documentIds == null ? List.<UUID>of() : documentIds) extra.add(new Object[]{null, d});
        return eligibilityForRoles(personId, positionIds, extra);
    }

    /** The Work Positions that an assignment gives now (not the ones carried over from the earlier issuance, which were checked when they were given). */
    private List<UUID> newRolesOf(UUID assignmentId) {
        return jdbc.queryForList("select job_role_id from training_job_assignment_roles where assignment_id = ? and not carried order by sort_order", UUID.class, assignmentId);
    }

    /** The check for every Work Position that is given: the matrix of the department of each one, and the trainings that were ticked, once. */
    private Map<String, Object> eligibilityForRoles(UUID personId, List<UUID> roleIds, List<Object[]> chosen) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("openSuspensions", jdbc.queryForObject("select count(*) from training_work_suspensions where person_user_id = ? and status = 'OPEN'", Integer.class, personId));
        List<Map<String, Object>> items = new ArrayList<>();
        boolean matrixMissing = false;
        Object matrixVersionId = null;
        for (UUID role : roleIds) {
            Map<String, Object> one = eligibilityFor(personId, role, positionDepartment(role), List.of());
            if (Boolean.TRUE.equals(one.get("matrixMissing"))) { matrixMissing = true; continue; }
            if (matrixVersionId == null) matrixVersionId = one.get("matrixVersionId");
            String roleName = jdbc.queryForObject("select name from training_job_roles where id = ?", String.class, role);
            for (Map<String, Object> item : (List<Map<String, Object>>) one.get("items")) {
                // a topic that two roles require is listed once
                Map<String, Object> same = items.stream().filter(i -> java.util.Objects.equals(i.get("code"), item.get("code")) && java.util.Objects.equals(i.get("title"), item.get("title"))).findFirst().orElse(null);
                if (same != null) { same.put("jobRoleName", same.get("jobRoleName") + ", " + roleName); continue; }
                Map<String, Object> copy = new LinkedHashMap<>(item);
                copy.put("jobRoleName", roleName);
                items.add(copy);
            }
        }
        // the rows "All employees" of the effective matrix of the department of the person (the factory-wide ones locked by Quality Assurance, the department-wide ones ticked by the head of
        // department): they apply whatever Work Position the person holds
        for (Map<String, Object> r : jdbc.queryForList("""
            select coalesce(r.topic_text, d.document_name) as title, d.document_number as code, r.annual_required, r.topic_text as match_name, d.document_number as match_number
              from app_users u join departments dp on lower(trim(dp.name)) = lower(trim(u.department))
              join training_matrices m on m.department_id = dp.id join training_matrix_versions v on v.matrix_id = m.id and v.status = 'EFFECTIVE'
              join training_matrix_rows r on r.version_id = v.id and r.all_employees left join documents d on d.id = r.document_id
             where u.id = ? order by r.row_no
            """, personId)) {
            if (items.stream().anyMatch(i -> java.util.Objects.equals(i.get("title"), r.get("title")) && java.util.Objects.equals(i.get("code"), r.get("code")))) continue;
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("title", r.get("title"));
            item.put("code", r.get("code"));
            item.put("annualRequired", Boolean.TRUE.equals(r.get("annual_required")));
            java.sql.Date done = lastDone(personId, (String) r.get("match_name"), (String) r.get("match_number"));
            item.put("lastDone", done == null ? null : done.toLocalDate().toString());
            item.put("source", "ALL_EMPLOYEES");
            item.put("jobRoleName", "All employees");
            items.add(item);
        }
        addChosen(personId, items, chosen);
        List<Map<String, Object>> missing = items.stream().filter(i -> i.get("lastDone") == null).toList();
        out.put("matrixMissing", matrixMissing);
        out.put("matrixVersionId", matrixVersionId);
        out.put("items", items);
        out.put("complete", !matrixMissing && missing.isEmpty());
        out.put("missingCount", missing.size());
        return out;
    }

    /** The trainings that were ticked for an assignment: {topic, document}, one of them is null. */
    private List<Object[]> requiredOf(UUID assignmentId) {
        List<Object[]> out = new ArrayList<>();
        for (Map<String, Object> r : jdbc.queryForList("select topic_text, document_id from training_job_required_items where assignment_id = ? order by sort_order", assignmentId)) out.add(new Object[]{r.get("topic_text"), r.get("document_id")});
        return out;
    }

    private void writeRequired(UUID id, List<String> topics, List<UUID> documents) {
        int order = 0;
        java.util.Set<String> seen = new java.util.LinkedHashSet<>();
        for (String raw : topics == null ? List.<String>of() : topics) {
            String t = raw == null ? "" : raw.trim().replaceAll("\\s+", " ");
            if (t.isEmpty()) continue;
            if (t.length() > 500) throw new IllegalArgumentException("TRAINING_JOB_REQUIRED_INVALID");
            if (!seen.add(t.toLowerCase(java.util.Locale.ROOT))) continue;
            jdbc.update("insert into training_job_required_items(assignment_id, sort_order, topic_text) values (?,?,?)", id, ++order, t);
        }
        for (UUID d : documents == null ? List.<UUID>of() : new java.util.LinkedHashSet<>(documents)) {
            if (jdbc.queryForObject("select count(*) from documents where id = ?", Integer.class, d) == 0) throw new IllegalArgumentException("TRAINING_JOB_REQUIRED_INVALID");
            jdbc.update("insert into training_job_required_items(assignment_id, sort_order, document_id) values (?,?,?)", id, ++order, d);
        }
    }

    /** The last day the person completed a training on a topic (by its name) or a document (by its number), voided records left out. */
    private java.sql.Date lastDone(UUID personId, String topicName, String documentNumber) {
        return jdbc.queryForObject("""
            select max(rec.completed_on) from training_records rec left join training_record_voids v2 on v2.record_id = rec.id
             where rec.person_user_id = ? and v2.id is null and ((?::text is not null and rec.document_number = ?) or (?::text is not null and training_topic_key(rec.topic_text) = training_topic_key(?)))
            """, java.sql.Date.class, personId, documentNumber, documentNumber, topicName, topicName);
    }

    private Map<String, Object> eligibilityFor(UUID personId, UUID positionId, UUID department, List<Object[]> chosen) {
        List<UUID> effective = jdbc.queryForList("select v.id from training_matrix_versions v join training_matrices m on m.id = v.matrix_id where m.department_id = ? and v.status = 'EFFECTIVE'", UUID.class, department);
        Map<String, Object> out = new LinkedHashMap<>();
        // D-12: work suspended after a failed assessment is only shown here; it does not block the assignment.
        out.put("openSuspensions", jdbc.queryForObject("select count(*) from training_work_suspensions where person_user_id = ? and status = 'OPEN'", Integer.class, personId));
        out.put("matrixMissing", effective.isEmpty());
        if (effective.isEmpty()) {
            out.put("matrixVersionId", null);
            out.put("items", List.of());
            out.put("complete", false);
            return out;
        }
        List<Map<String, Object>> items = TrainingRows.camel(jdbc.queryForList("""
            select * from (
              select coalesce(r.topic_text, d.document_name) as title, d.document_number as code, r.annual_required,
                     (select max(rec.completed_on) from training_records rec left join training_record_voids v2 on v2.record_id = rec.id
                       where rec.person_user_id = ? and v2.id is null
                         and ((d.document_number is not null and rec.document_number = d.document_number) or (r.topic_text is not null and training_topic_key(rec.topic_text) = training_topic_key(r.topic_text)))) as last_done
                from training_matrix_rows r join training_matrix_cells c on c.row_id = r.id and c.position_id = ?
                left join documents d on d.id = r.document_id
               where r.version_id = ?) x
            """, personId, positionId, effective.getFirst()));
        for (Map<String, Object> i : items) i.put("source", "MATRIX");
        addChosen(personId, items, chosen);
        List<Map<String, Object>> missing = items.stream().filter(i -> i.get("lastDone") == null).toList();
        out.put("matrixVersionId", effective.getFirst());
        out.put("items", items);
        out.put("complete", missing.isEmpty());
        out.put("missingCount", missing.size());
        return out;
    }

    /** The trainings ticked for this assignment: the same check, whatever the matrix says (one that the matrix has already is not listed twice). */
    private void addChosen(UUID personId, List<Map<String, Object>> items, List<Object[]> chosen) {
        for (Object[] pick : chosen) {
            Map<String, Object> row = pick[0] != null
                    ? Map.of("title", pick[0], "match_name", pick[0])
                    : jdbc.queryForList("select document_name as title, document_number as code, null::text as match_name, document_number as match_number from documents where id = ?", pick[1]).stream().findFirst().orElse(null);
            if (row == null || items.stream().anyMatch(i -> java.util.Objects.equals(i.get("title"), row.get("title")) && java.util.Objects.equals(i.get("code"), row.get("code")))) continue;
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("title", row.get("title"));
            item.put("code", row.get("code"));
            item.put("annualRequired", false);
            java.sql.Date done = lastDone(personId, (String) row.get("match_name"), (String) row.get("match_number"));
            item.put("lastDone", done == null ? null : done.toLocalDate().toString());
            item.put("source", "CHOSEN");
            items.add(item);
        }
    }

    // ----------------------------------------------------------------------------------------------------------------------------- writing

    @Transactional
    public Map<String, Object> create(UserAccount actor, SaveRequest request) {
        access.require(actor, "training.job_assignment.manage");
        // the Work Positions that this assignment gives: one or several, each in a department the person who assigns may act in
        List<UUID> given = new ArrayList<>(new java.util.LinkedHashSet<>(request == null ? List.<UUID>of() : request.positionIds() != null && !request.positionIds().isEmpty() ? request.positionIds() : request.positionId() == null ? List.<UUID>of() : List.of(request.positionId())));
        if (request == null || request.personUserId() == null || given.isEmpty() || given.size() > 10) throw new IllegalArgumentException("TRAINING_JOB_INVALID");
        UUID department = positionDepartment(given.getFirst());
        for (UUID role : given) access.requireScope(actor, positionDepartment(role));
        UserAccount person = users.findById(request.personUserId()).orElseThrow(() -> new IllegalArgumentException("TRAINING_PARTICIPANT_NOT_ELIGIBLE"));
        if (person.getStatus() != UserStatus.Active) throw new IllegalArgumentException("TRAINING_PARTICIPANT_NOT_ELIGIBLE");
        Integer open = jdbc.queryForObject("select count(*) from training_job_assignments where person_user_id=? and status in ('DRAFT','PENDING_RECEIVER')", Integer.class, person.getId());
        if (open != null && open > 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_JOB_OPEN_EXISTS");
        // A person can hold several Work Positions. The first one is an initial assignment; a later one either replaces a role the person holds (change) or is added to them (additional).
        // the person has one effective assignment: the latest issuance, with the whole set of roles; its roles are the ones held
        List<Map<String, Object>> current = jdbc.queryForList("""
            select ar.job_role_id as position_id, r.department_id as department_id from training_job_assignments j join training_job_assignment_roles ar on ar.assignment_id = j.id
              join training_job_roles r on r.id = ar.job_role_id where j.person_user_id = ? and j.status = 'EFFECTIVE' order by ar.sort_order
            """, person.getId());
        if (current.stream().anyMatch(c -> given.contains((UUID) c.get("position_id")))) throw new IllegalArgumentException("TRAINING_JOB_SAME_POSITION");
        String caseType = "INITIAL";
        Map<String, Object> replaced = null;
        if (!current.isEmpty()) {
            String mode = request.mode() == null || request.mode().isBlank() ? (current.size() == 1 ? "CHANGE" : "") : request.mode();
            if ("ADDITIONAL".equals(mode)) caseType = "ADDITIONAL";
            else if ("CHANGE".equals(mode)) {
                UUID wanted = request.replacesPositionId() != null ? request.replacesPositionId() : current.size() == 1 ? (UUID) current.getFirst().get("position_id") : null;
                replaced = current.stream().filter(c -> c.get("position_id").equals(wanted)).findFirst().orElseThrow(() -> new IllegalArgumentException("TRAINING_JOB_REPLACES_REQUIRED"));
                caseType = "CHANGE";
            } else throw new IllegalArgumentException("TRAINING_JOB_MODE_REQUIRED");
        }
        // APD.0024: the table of a change or an additional assignment has the reason for it
        if (!"INITIAL".equals(caseType) && (request.changeReason() == null || request.changeReason().isBlank())) throw new IllegalArgumentException("TRAINING_REASON_REQUIRED");
        String heldBefore = "INITIAL".equals(caseType) ? null : heldRolesJson(person.getId());
        validateDuties(request.duties());
        // the jurisdiction starts as the one written for the Work Position (Training Administration), and can be changed in the draft
        String jurisdiction = blank(request.jurisdiction());
        if (jurisdiction == null) jurisdiction = String.join("\n", jdbc.queryForList("select jurisdiction from training_job_roles where id in (" + String.join(",", java.util.Collections.nCopies(given.size(), "?")) + ")", String.class, given.toArray()).stream().filter(x -> x != null && !x.isBlank()).toList());
        if (jurisdiction != null && jurisdiction.isBlank()) jurisdiction = null;
        int issue = ((Number) jdbc.queryForObject("select coalesce(max(issue_no),0)+1 from training_job_assignments where person_user_id=?", Number.class, person.getId())).intValue();
        UUID id = UUID.randomUUID();
        jdbc.update("""
            insert into training_job_assignments(id, person_user_id, issue_no, case_type, department_id, position_id, direct_superior_title, subordinate_titles, substitute_title,
              previous_department_id, previous_position_id, change_reason, jurisdiction, created_by, held_before) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?::jsonb)
            """, id, person.getId(), issue, caseType, department, given.getFirst(), blank(request.directSuperiorTitle()), blank(request.subordinateTitles()), blank(request.substituteTitle()),
                replaced != null ? replaced.get("department_id") : null, replaced != null ? replaced.get("position_id") : null, blank(request.changeReason()), jurisdiction, actor.getId(), heldBefore);
        // this issuance lists the whole set the person holds after it: the roles held (carried over, not replaced) and the roles given
        int order = 0;
        for (Map<String, Object> held : current) {
            if (replaced != null && held.get("position_id").equals(replaced.get("position_id"))) continue;
            jdbc.update("insert into training_job_assignment_roles(assignment_id, job_role_id, sort_order, carried) values (?,?,?,true)", id, held.get("position_id"), ++order);
        }
        for (UUID role : given) jdbc.update("insert into training_job_assignment_roles(assignment_id, job_role_id, sort_order, carried) values (?,?,?,false)", id, role, ++order);
        writeDuties(id, request.duties());
        writeRequired(id, request.requiredTopics(), request.requiredDocumentIds());
        audit.logAs(actor, TYPE, label(id), id, "TRAINING_JOB_ASSIGNMENT_CREATED", null, "DRAFT", "Draft for " + person.getFullName());
        return get(actor, id);
    }

    @Transactional
    public Map<String, Object> update(UserAccount actor, UUID id, SaveRequest request) {
        Map<String, Object> j = lock(id);
        requireManage(actor, j);
        requireStatus(j, "DRAFT");
        requireVersion(j, request == null ? null : request.version());
        validateDuties(request.duties());
        jdbc.update("update training_job_assignments set direct_superior_title=?, subordinate_titles=?, substitute_title=?, change_reason=?, jurisdiction=?, version=version+1, updated_at=now() where id=?",
                blank(request.directSuperiorTitle()), blank(request.subordinateTitles()), blank(request.substituteTitle()), blank(request.changeReason()), blank(request.jurisdiction()), id);
        jdbc.update("delete from training_job_assignment_duties where assignment_id=?", id);
        writeDuties(id, request.duties());
        if (request.requiredTopics() != null || request.requiredDocumentIds() != null) {
            jdbc.update("delete from training_job_required_items where assignment_id=?", id);
            writeRequired(id, request.requiredTopics(), request.requiredDocumentIds());
        }
        audit.logAs(actor, TYPE, label(id), id, "TRAINING_JOB_ASSIGNMENT_UPDATED", null, null, "Draft changed");
        return get(actor, id);
    }

    /** The assignment may go ahead before the training is complete only if someone designated approves an exception with a reason. */
    @Transactional
    public Map<String, Object> requestException(UserAccount actor, UUID id, ExceptionRequest request) {
        Map<String, Object> j = lock(id);
        requireManage(actor, j);
        requireStatus(j, "DRAFT");
        if (request == null || request.reason() == null || request.reason().isBlank()) throw new IllegalArgumentException("TRAINING_REASON_REQUIRED");
        approvals.cancelOpen(TYPE, id, "Replaced");
        approvals.designate(actor, subject(j), "JOB_ASSIGN_EXCEPTION", request.approverUserId(), TrainingApprovalService.apart(actor.getId(), (UUID) j.get("person_user_id")));
        jdbc.update("update training_job_assignments set exception_reason=?, exception_approved_by=null, exception_signature_id=null, version=version+1, updated_at=now() where id=?", request.reason().trim(), id);
        audit.logAs(actor, TYPE, label(id), id, "TRAINING_JOB_EXCEPTION_REQUESTED", null, null, request.reason().trim());
        return get(actor, id);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> eligibleExceptionApprovers(UserAccount actor, UUID id, String search, int page, int limit) {
        Map<String, Object> j = visible(actor, id);
        return approvals.eligibleApprovers(actor, subject(j), "JOB_ASSIGN_EXCEPTION", search, page, limit, TrainingApprovalService.apart(actor.getId(), (UUID) j.get("person_user_id")));
    }

    @Transactional
    public Map<String, Object> approveException(UserAccount actor, UUID id, SignRequest request) {
        Map<String, Object> j = lock(id);
        requireStatus(j, "DRAFT");
        if (j.get("exception_reason") == null) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_JOB_NO_EXCEPTION");
        UUID assignment = approvals.requireCanSign(actor, subject(j), "JOB_ASSIGN_EXCEPTION", keptApartFor(j));
        UUID signature = sign(actor, j, "TRAINING_JOB_EXCEPTION_APPROVED", request == null ? null : request.signatureToken());
        approvals.complete(assignment, signature);
        jdbc.update("update training_job_assignments set exception_approved_by=?, exception_signature_id=?, version=version+1, updated_at=now() where id=?", actor.getId(), signature, id);
        audit.logAs(actor, TYPE, label(id), id, "TRAINING_JOB_EXCEPTION_APPROVED", null, null, String.valueOf(j.get("exception_reason")));
        return get(actor, id);
    }

    /** The person who assigns signs. The training the matrix requires must be complete, or an exception must be approved. */
    @Transactional
    public Map<String, Object> submit(UserAccount actor, UUID id, SignRequest request) {
        Map<String, Object> j = lock(id);
        requireManage(actor, j);
        requireStatus(j, "DRAFT");
        requireVersion(j, request == null ? null : request.version());
        if (actor.getId().equals(j.get("person_user_id"))) throw new IllegalArgumentException(TrainingApprovalService.SEGREGATION);
        Integer duties = jdbc.queryForObject("select count(*) from training_job_assignment_duties where assignment_id=?", Integer.class, id);
        if (duties == null || duties == 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_JOB_DUTIES_REQUIRED");
        Map<String, Object> eligibility = eligibilityForRoles((UUID) j.get("person_user_id"), newRolesOf(id), requiredOf(id));
        boolean complete = Boolean.TRUE.equals(eligibility.get("complete"));
        if (!complete && j.get("exception_approved_by") == null) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_MATRIX_INCOMPLETE");
        UUID signature = sign(actor, j, "TRAINING_JOB_ASSIGNED", request == null ? null : request.signatureToken());
        String snapshot;
        try { snapshot = json.writeValueAsString(eligibility); } catch (JsonProcessingException e) { snapshot = "{}"; }
        jdbc.update("update training_job_assignments set status='PENDING_RECEIVER', assignor_user_id=?, assignor_title=?, assignor_signature_id=?, matrix_version_id=?, matrix_completion_snapshot=cast(? as jsonb), version=version+1, updated_at=now() where id=?",
                actor.getId(), request.assignorTitle() == null || request.assignorTitle().isBlank() ? actor.getPosition() : request.assignorTitle().trim(), signature, eligibility.get("matrixVersionId"), snapshot, id);
        audit.logAs(actor, TYPE, label(id), id, "TRAINING_JOB_ASSIGNED", "DRAFT", "PENDING_RECEIVER", complete ? "Matrix training complete" : "Exception approved: " + j.get("exception_reason"));
        users.findById((UUID) j.get("person_user_id")).ifPresent(person -> notifier.send("TRAINING_JOB_WAITING", person, actor, "Training: a job assignment waits for you",
                actor.getFullName() + " assigned you a position. Please read and accept it.", TYPE, id, null));
        return get(actor, id);
    }

    /** The employee accepts with a signature: the assignment is effective (a change replaces the role it names), and the Work Position of the person is recorded for the matrix. */
    @Transactional
    public Map<String, Object> accept(UserAccount actor, UUID id, SignRequest request) {
        Map<String, Object> j = lock(id);
        requireStatus(j, "PENDING_RECEIVER");
        requireVersion(j, request == null ? null : request.version());
        if (!actor.getId().equals(j.get("person_user_id"))) throw new SecurityException(TrainingAccess.DENIED);
        access.require(actor, "training.self.view");
        UUID signature = sign(actor, j, "TRAINING_JOB_ACCEPTED", request == null ? null : request.signatureToken());
        // the earlier issuance is replaced by this one, which lists the whole set; a role that is replaced stops being held, the roles given start, the roles carried over stay as they are
        jdbc.update("update training_job_assignments set status='OBSOLETED', version=version+1, updated_at=now() where person_user_id=? and status='EFFECTIVE' and id <> ?", actor.getId(), id);
        jdbc.update("update training_job_assignments set status='EFFECTIVE', receiver_signature_id=?, effective_at=now(), version=version+1, updated_at=now() where id=?", signature, id);
        if ("CHANGE".equals(j.get("case_type")) && j.get("previous_position_id") != null) {
            jdbc.update("update training_person_positions set valid_to=current_date where person_user_id=? and position_id=? and valid_to is null", actor.getId(), j.get("previous_position_id"));
        }
        for (Map<String, Object> role : jdbc.queryForList("select ar.job_role_id, r.department_id from training_job_assignment_roles ar join training_job_roles r on r.id = ar.job_role_id where ar.assignment_id = ? and not ar.carried", id)) {
            jdbc.update("update training_person_positions set valid_to=current_date where person_user_id=? and position_id=? and valid_to is null", actor.getId(), role.get("job_role_id"));
            jdbc.update("insert into training_person_positions(id, person_user_id, position_id, department_id, source, created_by) values (?,?,?,?, 'JOB_ASSIGNMENT', ?)", UUID.randomUUID(), actor.getId(), role.get("job_role_id"), role.get("department_id"), actor.getId());
        }
        audit.logAs(actor, TYPE, label(id), id, "TRAINING_JOB_ACCEPTED", "PENDING_RECEIVER", "EFFECTIVE", "Assignment accepted");
        if (j.get("assignor_user_id") != null) {
            users.findById((UUID) j.get("assignor_user_id")).ifPresent(assignor -> notifier.send("TRAINING_JOB_ACCEPTED", assignor, actor, "Training: job assignment accepted",
                    actor.getFullName() + " accepted the job assignment.", TYPE, id, null));
        }
        return get(actor, id);
    }

    @Transactional
    public Map<String, Object> cancel(UserAccount actor, UUID id, CancelRequest request) {
        Map<String, Object> j = lock(id);
        requireManage(actor, j);
        requireStatus(j, "DRAFT", "PENDING_RECEIVER");
        requireVersion(j, request == null ? null : request.version());
        if (request.reason() == null || request.reason().isBlank()) throw new IllegalArgumentException("TRAINING_REASON_REQUIRED");
        approvals.cancelOpen(TYPE, id, "Cancelled");
        jdbc.update("update training_job_assignments set status='CANCELLED', cancel_reason=?, version=version+1, updated_at=now() where id=?", request.reason().trim(), id);
        audit.logAs(actor, TYPE, label(id), id, "TRAINING_JOB_ASSIGNMENT_CANCELLED", String.valueOf(j.get("status")), "CANCELLED", request.reason().trim());
        return get(actor, id);
    }

    // ----------------------------------------------------------------------------------------------------------------------------- helpers

    private Map<String, Object> lock(UUID id) {
        return jdbc.queryForList("select * from training_job_assignments where id=? for update", id).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
    }

    private Map<String, Object> visible(UserAccount actor, UUID id) {
        Map<String, Object> j = jdbc.queryForList("select * from training_job_assignments where id=?", id).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        if (actor.getId().equals(j.get("person_user_id"))) return j;
        access.require(actor, "training.job_assignment.view", "training.job_assignment.manage");
        access.requireScope(actor, (UUID) j.get("department_id"));
        return j;
    }

    private void requireManage(UserAccount actor, Map<String, Object> j) {
        access.require(actor, "training.job_assignment.manage");
        access.requireScope(actor, (UUID) j.get("department_id"));
    }

    private static void requireStatus(Map<String, Object> j, String... allowed) {
        for (String s : allowed) if (s.equals(j.get("status"))) return;
        throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_JOB_INVALID_TRANSITION");
    }

    private static void requireVersion(Map<String, Object> j, Integer version) {
        if (version == null || version.intValue() != ((Number) j.get("version")).intValue()) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_JOB_VERSION_CHANGED");
    }

    private UUID positionDepartment(UUID positionId) {
        List<UUID> rows = jdbc.queryForList("select department_id from training_job_roles where id=? and is_active", UUID.class, positionId);
        if (rows.isEmpty() || rows.getFirst() == null) throw new IllegalArgumentException("TRAINING_POSITION_INVALID");
        return rows.getFirst();
    }

    private String label(UUID id) {
        Map<String, Object> row = jdbc.queryForMap("select u.full_name, j.issue_no from training_job_assignments j join app_users u on u.id = j.person_user_id where j.id=?", id);
        return "Job assignment " + row.get("full_name") + " #" + row.get("issue_no");
    }

    private TrainingApprovalService.Subject subject(Map<String, Object> j) {
        return new TrainingApprovalService.Subject(TYPE, (UUID) j.get("id"), (UUID) j.get("department_id"), label((UUID) j.get("id")), "training.job_assignment.manage");
    }

    private UUID sign(UserAccount actor, Map<String, Object> j, String meaning, String token) {
        if (token == null || token.isBlank()) throw new IllegalArgumentException("TRAINING_SIGNATURE_REQUIRED");
        String reason = "Training Management: " + meaning.replace("TRAINING_", "").replace('_', ' ').toLowerCase(Locale.ROOT);
        return signatures.createEntitySignature(TYPE, (UUID) j.get("id"), label((UUID) j.get("id")), actor, token, meaning, reason, null, null, null).getId();
    }

    private static void validateDuties(List<DutyRequest> duties) {
        if (duties == null) return;
        for (DutyRequest d : duties) {
            if (d.responsibility() == null || d.responsibility().isBlank() || d.responsibility().length() > 2000) throw new IllegalArgumentException("TRAINING_JOB_DUTY_INVALID");
            for (String text : new String[]{d.description(), d.responsibilityEn(), d.descriptionEn()}) if (text != null && text.length() > 4000) throw new IllegalArgumentException("TRAINING_JOB_DUTY_INVALID");
        }
    }

    private void writeDuties(UUID id, List<DutyRequest> duties) {
        int order = 0;
        for (DutyRequest d : duties == null ? List.<DutyRequest>of() : duties) {
            jdbc.update("insert into training_job_assignment_duties(assignment_id, sort_order, responsibility, description, responsibility_en, description_en) values (?,?,?,?,?,?)",
                    id, ++order, d.responsibility().trim(), blank(d.description()), blank(d.responsibilityEn()), blank(d.descriptionEn()));
        }
    }

    /** The person the assignment is about and the person who prepared it cannot approve the exception. */
    private static Set<UUID> keptApartFor(Map<String, Object> j) {
        Set<UUID> apart = new java.util.HashSet<>();
        apart.add((UUID) j.get("person_user_id"));
        if (j.get("created_by") != null) apart.add((UUID) j.get("created_by"));
        return apart;
    }

    private static String blank(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
