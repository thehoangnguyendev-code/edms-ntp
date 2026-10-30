package com.eqms.service.training;

import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.AuditTrailService;
import com.eqms.service.ElectronicSignatureService;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * The training matrix of a department (SOP.0003 section 5.3.1): which topics and documents each position must be trained on. A version is prepared by a
 * person, approved by a person designated for the step who is not the preparer, and from then on never changed; a change is a new version. The versions
 * stay for comparison and for the history of what was required at a given time.
 */
@Service
public class TrainingMatrixService {
    private static final String TYPE = "TRAINING_MATRIX_VERSION";
    private static final Set<String> GROUPS = Set.of("FACTORY_GENERAL", "DEPARTMENT_GENERAL", "SOP");

    private final JdbcTemplate jdbc;
    private final TrainingAccess access;
    private final TrainingStore store;
    private final TrainingApprovalService approvals;
    private final ElectronicSignatureService signatures;
    private final AuditTrailService audit;
    private final UserAccountRepository users;
    private final TrainingNotifier notifier;

    /** The code of a record is made by the rule of Training Administration (Code Rules). */
    @org.springframework.beans.factory.annotation.Autowired
    private TrainingCodeService codes;

    public TrainingMatrixService(JdbcTemplate jdbc, TrainingAccess access, TrainingStore store, TrainingApprovalService approvals, ElectronicSignatureService signatures,
                                 AuditTrailService audit, UserAccountRepository users, TrainingNotifier notifier) {
        this.jdbc = jdbc;
        this.access = access;
        this.store = store;
        this.approvals = approvals;
        this.signatures = signatures;
        this.audit = audit;
        this.users = users;
        this.notifier = notifier;
    }

    public record RowRequest(String group, String topicText, UUID documentId, Boolean annualRequired, String note, List<UUID> positionIds, Boolean allEmployees, Boolean locked) {}
    public record SaveRequest(Integer version, String changeReason, List<RowRequest> rows) {}
    public record SubmitRequest(Integer version, String signatureToken, UUID approverUserId) {}
    public record SignRequest(Integer version, String signatureToken) {}
    public record RejectRequest(Integer version, String reason) {}

    // ----------------------------------------------------------------------------------------------------------------------------- reading

    @Transactional(readOnly = true)
    public Map<String, Object> matrices(UserAccount actor, String search, String state, String sortBy, String sortDirection, int page, int limit) {
        access.require(actor, "training.matrix.view", "training.matrix.manage");
        List<Object> args = new ArrayList<>();
        StringBuilder where = new StringBuilder(" where 1=1");
        if (!access.allDepartments(actor)) {
            where.append(" and m.department_id = ?");
            UUID own = access.departmentOf(actor);
            args.add(own == null ? new UUID(0, 0) : own);
        }
        if (search != null && !search.isBlank()) {
        String like = "%" + search.trim().toLowerCase(java.util.Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
            where.append(" and (lower(m.code) like ? escape '\\' or lower(d.name) like ? escape '\\')");
            args.add(like); args.add(like);
        }
        if ("EFFECTIVE".equals(state)) where.append(" and ev.id is not null");
        else if ("NO_EFFECTIVE".equals(state)) where.append(" and ev.id is null");
        else if ("IN_PREPARATION".equals(state)) where.append(" and ov.id is not null");
        String from = """
              from training_matrices m join departments d on d.id = m.department_id
              left join training_matrix_versions ev on ev.matrix_id = m.id and ev.status = 'EFFECTIVE'
              left join training_matrix_versions ov on ov.matrix_id = m.id and ov.status in ('DRAFT','PENDING_APPROVAL')
            """;
        int safeLimit = Math.min(Math.max(limit, 1), 100), safePage = Math.max(page, 1);
        Long total = jdbc.queryForObject("select count(*)" + from + where, Long.class, args.toArray());
        List<Object> pageArgs = new ArrayList<>(args);
        pageArgs.add(safeLimit);
        pageArgs.add((safePage - 1) * safeLimit);
        List<Map<String, Object>> rows = jdbc.queryForList("""
            select m.id, m.code, m.department_id, d.name as department_name,
                   ev.id as effective_version_id, ev.version_no as effective_version_no, ev.effective_at,
                   ov.id as open_version_id, ov.version_no as open_version_no, ov.status as open_status
            """ + from + where + TrainingRows.orderBy(sortBy, sortDirection, Map.of("code", "m.code", "department", "d.name", "effective", "ev.version_no", "prepared", "ov.version_no"), "d.name") + " limit ? offset ?", pageArgs.toArray());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("data", TrainingRows.camel(rows));
        long count = total == null ? 0 : total;
        result.put("pagination", Map.of("page", safePage, "limit", safeLimit, "total", count, "totalPages", Math.max(1, (count + safeLimit - 1) / safeLimit)));
        return result;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> matrix(UserAccount actor, UUID matrixId) {
        Map<String, Object> m = matrixRow(matrixId);
        access.require(actor, "training.matrix.view", "training.matrix.manage");
        access.requireScope(actor, (UUID) m.get("department_id"));
        Map<String, Object> out = TrainingRows.camel(m);
        out.put("departmentName", jdbc.queryForObject("select name from departments where id=?", String.class, m.get("department_id")));
        out.put("versionCount", jdbc.queryForObject("select count(*) from training_matrix_versions where matrix_id=?", Integer.class, matrixId));
        out.put("effective", TrainingRows.camel(jdbc.queryForList("select id, version_no, effective_at from training_matrix_versions where matrix_id=? and status='EFFECTIVE'", matrixId)).stream().findFirst().orElse(null));
        out.put("canManage", access.has(actor, "training.matrix.manage") && access.inScope(actor, (UUID) m.get("department_id")));
        return out;
    }

    /** The versions of one matrix, searched, filtered by status, sorted and paged here. */
    @Transactional(readOnly = true)
    public Map<String, Object> versionsPage(UserAccount actor, UUID matrixId, String search, String status, String sortBy, String sortDirection, int page, int limit) {
        Map<String, Object> m = matrixRow(matrixId);
        access.require(actor, "training.matrix.view", "training.matrix.manage");
        access.requireScope(actor, (UUID) m.get("department_id"));
        List<Object> args = new ArrayList<>();
        args.add(matrixId);
        StringBuilder where = new StringBuilder(" where v.matrix_id = ?");
        if (search != null && !search.isBlank()) {
            String like = "%" + escape(search.trim().toLowerCase(Locale.ROOT)) + "%";
            where.append(" and (('version ' || v.version_no) like ? escape '\\' or lower(coalesce(v.change_reason,'')) like ? escape '\\' or lower(coalesce(pu.full_name,'')) like ? escape '\\' or lower(coalesce(au.full_name,'')) like ? escape '\\')");
            args.add(like); args.add(like); args.add(like); args.add(like);
        }
        if (status != null && Set.of("DRAFT", "PENDING_APPROVAL", "EFFECTIVE", "OBSOLETED").contains(status)) {
            where.append(" and v.status = ?");
            args.add(status);
        }
        String from = " from training_matrix_versions v left join app_users pu on pu.id = v.prepared_by left join app_users au on au.id = v.approved_by";
        String column = switch (sortBy == null ? "" : sortBy) {
            case "status" -> "v.status";
            case "changeReason" -> "v.change_reason";
            case "preparedBy" -> "pu.full_name";
            case "approvedBy" -> "au.full_name";
            case "effectiveAt" -> "v.effective_at";
            default -> "v.version_no";
        };
        String direction = "asc".equalsIgnoreCase(sortDirection) ? "asc" : "desc";
        int safeLimit = Math.min(Math.max(limit, 1), 100), safePage = Math.max(page, 1);
        Long total = jdbc.queryForObject("select count(*)" + from + where, Long.class, args.toArray());
        List<Object> pageArgs = new ArrayList<>(args);
        pageArgs.add(safeLimit);
        pageArgs.add((safePage - 1) * safeLimit);
        List<Map<String, Object>> rows = jdbc.queryForList("""
            select v.id, v.version_no, v.status, v.change_reason, v.reject_reason, v.effective_at, v.approved_at, pu.full_name as prepared_by_name, au.full_name as approved_by_name,
                   (select p.id from training_matrix_versions p where p.matrix_id = v.matrix_id and p.version_no = v.version_no - 1) as previous_id
            """ + from + where + " order by " + column + " " + direction + " nulls last, v.version_no desc limit ? offset ?", pageArgs.toArray());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("data", TrainingRows.camel(rows));
        long count = total == null ? 0 : total;
        result.put("pagination", Map.of("page", safePage, "limit", safeLimit, "total", count, "totalPages", Math.max(1, (count + safeLimit - 1) / safeLimit)));
        return result;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> version(UserAccount actor, UUID versionId) {
        Map<String, Object> v = versionRow(versionId);
        Map<String, Object> m = matrixRow((UUID) v.get("matrix_id"));
        UUID department = (UUID) m.get("department_id");
        access.require(actor, "training.matrix.view", "training.matrix.manage");
        access.requireScope(actor, department);
        Map<String, Object> out = TrainingRows.camel(v);
        out.put("matrixId", m.get("id"));
        out.put("matrixCode", m.get("code"));
        out.put("departmentId", department);
        out.put("departmentName", jdbc.queryForObject("select name from departments where id=?", String.class, department));
        List<Map<String, Object>> rows = TrainingRows.camel(jdbc.queryForList("""
            select r.id, r.row_no, r.row_group, r.topic_text, r.document_id, r.annual_required, r.all_employees, (r.all_employees and r.locked) as locked, r.note,
                   d.document_number, d.document_name
              from training_matrix_rows r left join documents d on d.id = r.document_id
             where r.version_id=? order by r.row_no
            """, versionId));
        for (Map<String, Object> row : rows) {
            row.put("positionIds", jdbc.queryForList("select position_id from training_matrix_cells where row_id=?", UUID.class, row.get("id")));
        }
        out.put("rows", rows);
        out.put("positions", positions(department));
        out.put("approvers", TrainingRows.camel(approvals.assignments(TYPE, versionId)));
        out.put("capabilities", capabilities(actor, v, department));
        return out;
    }

    private Map<String, Object> capabilities(UserAccount actor, Map<String, Object> v, UUID department) {
        String status = String.valueOf(v.get("status"));
        boolean manage = access.has(actor, "training.matrix.manage") && access.inScope(actor, department);
        boolean assignedToMe = jdbc.queryForObject("select count(*) from training_approval_assignments where object_type=? and object_id=? and status='PENDING' and assignee_user_id=?",
                Integer.class, TYPE, v.get("id"), actor.getId()) > 0;
        Map<String, Object> caps = new LinkedHashMap<>();
        caps.put("edit", manage && "DRAFT".equals(status));
        caps.put("submit", manage && "DRAFT".equals(status));
        caps.put("approve", "PENDING_APPROVAL".equals(status) && (assignedToMe || "ANY_ELIGIBLE".equals(approvals.mode("MATRIX_APPROVE"))) && access.has(actor, "training.matrix.approve"));
        caps.put("reject", caps.get("approve"));
        caps.put("upgrade", manage && "EFFECTIVE".equals(status));
        return caps;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> positions(UUID departmentId) {
        return TrainingRows.camel(jdbc.queryForList("select id, code, name, senior_management from training_job_roles where is_active and department_id=? order by name", departmentId));
    }

    @Transactional(readOnly = true)
    @SuppressWarnings("unchecked")
    public Map<String, Object> compare(UserAccount actor, UUID a, UUID b) {
        Map<String, Object> va = version(actor, a);
        Map<String, Object> vb = version(actor, b);
        if (!va.get("matrixId").equals(vb.get("matrixId"))) throw new IllegalArgumentException("TRAINING_COMPARE_SAME_MATRIX");
        Map<String, Map<String, Object>> left = byKey(va), right = byKey(vb);
        List<Map<String, Object>> added = new ArrayList<>(), removed = new ArrayList<>(), changed = new ArrayList<>();
        right.forEach((key, row) -> {
            Map<String, Object> old = left.get(key);
            if (old == null) added.add(row);
            else if (!new LinkedHashSet<>((List<?>) old.get("positionIds")).equals(new LinkedHashSet<>((List<?>) row.get("positionIds")))
                    || !String.valueOf(old.get("annualRequired")).equals(String.valueOf(row.get("annualRequired")))) {
                Map<String, Object> diff = new LinkedHashMap<>(row);
                diff.put("previousPositionIds", old.get("positionIds"));
                diff.put("previousAnnualRequired", old.get("annualRequired"));
                changed.add(diff);
            }
        });
        left.forEach((key, row) -> { if (!right.containsKey(key)) removed.add(row); });
        Map<Object, Object> names = new LinkedHashMap<>();
        for (Map<String, Object> v : List.of(va, vb)) for (Map<String, Object> p : (List<Map<String, Object>>) v.get("positions")) names.put(p.get("id"), p.get("name"));
        List<Map<String, Object>> positions = new ArrayList<>();
        names.forEach((id, name) -> positions.add(Map.of("id", id, "name", name)));
        return Map.of("from", va.get("versionNo"), "to", vb.get("versionNo"), "added", added, "removed", removed, "changed", changed, "positions", positions);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Map<String, Object>> byKey(Map<String, Object> version) {
        Map<String, Map<String, Object>> map = new LinkedHashMap<>();
        for (Map<String, Object> row : (List<Map<String, Object>>) version.get("rows")) {
            map.put(row.get("topicText") != null ? "T" + topicKey(String.valueOf(row.get("topicText"))) : "D" + row.get("documentId"), row);
        }
        return map;
    }

    /** The topics a position must be trained on, from the effective version of the matrix. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> coverage(UserAccount actor, UUID matrixId, UUID positionId) {
        Map<String, Object> m = matrixRow(matrixId);
        access.require(actor, "training.matrix.view", "training.matrix.manage");
        access.requireScope(actor, (UUID) m.get("department_id"));
        return TrainingRows.camel(jdbc.queryForList("""
            select r.row_no, r.row_group, r.annual_required, coalesce(r.topic_text, d.document_name) as title, d.document_number as code
              from training_matrix_versions v join training_matrix_rows r on r.version_id = v.id join training_matrix_cells c on c.row_id = r.id and c.position_id = ?
              left join documents d on d.id = r.document_id
             where v.matrix_id=? and v.status='EFFECTIVE' order by r.row_no
            """, positionId, matrixId));
    }

    // ----------------------------------------------------------------------------------------------------------------------------- writing

    @Transactional
    public Map<String, Object> createMatrix(UserAccount actor, UUID departmentId) {
        access.require(actor, "training.matrix.manage");
        if (departmentId == null) throw new IllegalArgumentException("TRAINING_DEPARTMENT_REQUIRED");
        access.requireScope(actor, departmentId);
        String departmentCode = jdbc.queryForList("select code from departments where id=?", String.class, departmentId).stream().findFirst().orElseThrow(() -> new IllegalArgumentException("TRAINING_DEPARTMENT_REQUIRED"));
        Integer exists = jdbc.queryForObject("select count(*) from training_matrices where department_id=?", Integer.class, departmentId);
        if (exists != null && exists > 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_MATRIX_EXISTS");
        UUID matrixId = UUID.randomUUID(), versionId = UUID.randomUUID();
        String code = codes.next(TrainingCodeService.MATRIX, departmentCode, java.time.LocalDate.now().getYear(),
                candidate -> Boolean.TRUE.equals(jdbc.queryForObject("select exists(select 1 from training_matrices where code = ?)", Boolean.class, candidate)));
        jdbc.update("insert into training_matrices(id, department_id, code, created_by) values (?,?,?,?)", matrixId, departmentId, code, actor.getId());
        jdbc.update("insert into training_matrix_versions(id, matrix_id, version_no, prepared_by) values (?,?,1,?)", versionId, matrixId, actor.getId());
        // the trainings Quality Assurance locked in the matrices of the other departments are required of every employee: a new matrix starts with them
        jdbc.update("""
            insert into training_matrix_rows(id, version_id, row_no, row_group, topic_text, document_id, annual_required, all_employees, locked)
            select gen_random_uuid(), ?, row_number() over (order by src.row_group, src.topic_text, src.document_id), src.row_group, src.topic_text, src.document_id, src.annual_required, true, true
              from (select distinct on (coalesce(training_topic_key(r.topic_text), r.document_id::text)) r.row_group, r.topic_text, r.document_id, r.annual_required
                      from training_matrix_rows r join training_matrix_versions v on v.id = r.version_id
                     where v.status = 'EFFECTIVE' and r.locked
                     order by coalesce(training_topic_key(r.topic_text), r.document_id::text), v.effective_at desc nulls last) src
            """, versionId);
        ensureAllEmployees(versionId, departmentId);
        audit.logAs(actor, "TRAINING_MATRIX", code, matrixId, "TRAINING_MATRIX_CREATED", null, "DRAFT", "Matrix created with a draft version 1");
        return version(actor, versionId);
    }

    @Transactional
    public Map<String, Object> save(UserAccount actor, UUID versionId, SaveRequest request) {
        Map<String, Object> v = lockVersion(versionId);
        UUID department = departmentOf(v);
        requireManage(actor, department);
        requireStatus(v, "DRAFT");
        requireVersion(v, request == null ? null : request.version());
        if (request.rows() == null) throw new IllegalArgumentException("TRAINING_MATRIX_ROWS_REQUIRED");
        Set<UUID> allowed = new LinkedHashSet<>(jdbc.queryForList("select id from training_job_roles where is_active and department_id=?", UUID.class, department));
        Map<String, String> before = rowSnapshot(versionId);
        // SOP.0003 5.3.1: the columns of the senior management positions are built by QA (Training Administration); the head of department cannot change them (a row for all employees is for them too)
        Set<UUID> senior = new LinkedHashSet<>(jdbc.queryForList("select id from training_job_roles where is_active and senior_management and department_id=?", UUID.class, department));
        boolean qa = access.has(actor, "training.admin.manage");
        Map<String, Set<UUID>> seniorBefore = new LinkedHashMap<>();
        if (!qa && !senior.isEmpty()) {
            for (Map<String, Object> c : jdbc.queryForList("select coalesce('T' || training_topic_key(r.topic_text), 'D' || r.document_id) as k, c.position_id from training_matrix_rows r join training_matrix_cells c on c.row_id = r.id where r.version_id=? and not r.all_employees", versionId))
                if (senior.contains((UUID) c.get("position_id"))) seniorBefore.computeIfAbsent(String.valueOf(c.get("k")), k -> new LinkedHashSet<>()).add((UUID) c.get("position_id"));
            for (RowRequest row : request.rows()) {
                if (Boolean.TRUE.equals(row.allEmployees())) continue;
                Set<UUID> after = new LinkedHashSet<>(row.positionIds() == null ? List.<UUID>of() : row.positionIds());
                after.retainAll(senior);
                if (!after.equals(seniorBefore.getOrDefault(rowKey(clean(row.topicText()), row.documentId()), Set.of()))) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "TRAINING_MATRIX_SENIOR_QA_ONLY");
            }
            // taking a row out takes its senior management cells out too
            Set<String> sent = new LinkedHashSet<>();
            for (RowRequest row : request.rows()) if (!Boolean.TRUE.equals(row.allEmployees())) sent.add(rowKey(clean(row.topicText()), row.documentId()));
            for (String key : seniorBefore.keySet()) if (!sent.contains(key)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "TRAINING_MATRIX_SENIOR_QA_ONLY");
        }
        String reasonBefore = String.valueOf(v.get("change_reason") == null ? "" : v.get("change_reason"));
        // the rows Quality Assurance locked: a head of department cannot take one out or unlock it
        Set<String> lockedBefore = new LinkedHashSet<>(jdbc.queryForList("select coalesce('T' || training_topic_key(topic_text), 'D' || document_id) from training_matrix_rows where version_id=? and locked", String.class, versionId));
        if (!qa) {
            Set<String> sentKeys = new LinkedHashSet<>();
            for (RowRequest row : request.rows()) sentKeys.add(rowKey(clean(row.topicText()), row.documentId()));
            for (String key : lockedBefore) if (!sentKeys.contains(key)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "TRAINING_MATRIX_LOCKED_ROW");
        }
        jdbc.update("delete from training_matrix_cells where row_id in (select id from training_matrix_rows where version_id=?)", versionId);
        jdbc.update("delete from training_matrix_rows where version_id=?", versionId);
        int no = 0;
        Set<String> seen = new LinkedHashSet<>();
        for (RowRequest row : request.rows()) {
            if (row.group() == null || !GROUPS.contains(row.group())) throw new IllegalArgumentException("TRAINING_MATRIX_ROW_INVALID");
            String topicText = clean(row.topicText());
            if ((topicText == null) == (row.documentId() == null) || (topicText != null && topicText.length() > 500)) throw new IllegalArgumentException("TRAINING_MATRIX_ROW_INVALID");
            if (!seen.add(rowKey(topicText, row.documentId()))) throw new IllegalArgumentException("TRAINING_MATRIX_ROW_DUPLICATE");
            // Quality Assurance locks a row (it is for all employees and the head of department cannot take it out); only a person of Training Administration can lock or unlock one
            boolean locked = Boolean.TRUE.equals(row.allEmployees()) && (qa ? Boolean.TRUE.equals(row.locked()) : lockedBefore.contains(rowKey(topicText, row.documentId())));
            if (row.documentId() != null && jdbc.queryForObject("select count(*) from documents where id=?", Integer.class, row.documentId()) == 0) throw new IllegalArgumentException("TRAINING_MATRIX_ROW_INVALID");
            UUID rowId = UUID.randomUUID();
            jdbc.update("insert into training_matrix_rows(id, version_id, row_no, row_group, topic_text, document_id, annual_required, note, all_employees, locked) values (?,?,?,?,?,?,?,?,?,?)",
                    rowId, versionId, ++no, row.group(), topicText, row.documentId(), Boolean.TRUE.equals(row.annualRequired()), row.note() == null || row.note().isBlank() ? null : row.note().trim(), Boolean.TRUE.equals(row.allEmployees()), locked);
            for (UUID position : row.positionIds() == null ? List.<UUID>of() : new LinkedHashSet<>(row.positionIds())) {
                if (!allowed.contains(position)) throw new IllegalArgumentException("TRAINING_MATRIX_POSITION_INVALID");
                jdbc.update("insert into training_matrix_cells(row_id, position_id) values (?,?)", rowId, position);
            }
        }
        // the trainings required of all employees are always in the matrix, whatever the request says
        ensureAllEmployees(versionId, department);
        jdbc.update("update training_matrix_versions set change_reason=?, version=version+1, updated_at=now() where id=?", request.changeReason() == null ? null : request.changeReason().trim(), versionId);
        List<AuditTrailChangeResponse> changes = new ArrayList<>(rowChanges(before, rowSnapshot(versionId)));
        String reasonAfter = request.changeReason() == null ? "" : request.changeReason().trim();
        if (!reasonBefore.equals(reasonAfter)) changes.add(new AuditTrailChangeResponse("What changed in this version", reasonBefore.isEmpty() ? null : reasonBefore, reasonAfter.isEmpty() ? null : reasonAfter));
        audit.logAs(actor, "TRAINING_MATRIX", label(v), versionId, "TRAINING_MATRIX_SAVED", null, null, no + " rows saved; " + changes.size() + " change" + (changes.size() == 1 ? "" : "s"), changes);
        return version(actor, versionId);
    }

    /** A row for all employees (locked by Quality Assurance, or ticked by the head of department) is ticked for every active Work Position of the department, so that the grid and the form show it. */
    private void ensureAllEmployees(UUID versionId, UUID department) {
        // a row for all employees (locked by Quality Assurance, or ticked by the head of department) is ticked for every active Work Position of the department, so that the grid and the form show it
        jdbc.update("insert into training_matrix_cells(row_id, position_id) select r.id, jr.id from training_matrix_rows r cross join training_job_roles jr where r.version_id=? and r.all_employees and jr.department_id=? and jr.is_active on conflict do nothing", versionId, department);
    }

    /** Starts the next version from the effective one. Only one version at a time can be open. */
    @Transactional
    public Map<String, Object> upgrade(UserAccount actor, UUID matrixId) {
        Map<String, Object> m = matrixRow(matrixId);
        requireManage(actor, (UUID) m.get("department_id"));
        List<Map<String, Object>> effective = jdbc.queryForList("select id, version_no from training_matrix_versions where matrix_id=? and status='EFFECTIVE' for update", matrixId);
        if (effective.isEmpty()) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_MATRIX_NOT_EFFECTIVE");
        Integer open = jdbc.queryForObject("select count(*) from training_matrix_versions where matrix_id=? and status in ('DRAFT','PENDING_APPROVAL')", Integer.class, matrixId);
        if (open != null && open > 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_MATRIX_OPEN_VERSION");
        return version(actor, startNextVersion(actor, m, effective.getFirst()));
    }

    /** The next version as a draft, copied from the effective one; the caller has checked the access and that no other version is open. */
    private UUID startNextVersion(UserAccount actor, Map<String, Object> m, Map<String, Object> effectiveVersion) {
        UUID matrixId = (UUID) m.get("id");
        List<Map<String, Object>> effective = List.of(effectiveVersion);
        int next = ((Number) jdbc.queryForObject("select max(version_no) from training_matrix_versions where matrix_id=?", Number.class, matrixId)).intValue() + 1;
        UUID versionId = UUID.randomUUID();
        jdbc.update("insert into training_matrix_versions(id, matrix_id, version_no, prepared_by) values (?,?,?,?)", versionId, matrixId, next, actor.getId());
        for (Map<String, Object> row : jdbc.queryForList("select * from training_matrix_rows where version_id=? order by row_no", effective.getFirst().get("id"))) {
            UUID rowId = UUID.randomUUID();
            jdbc.update("insert into training_matrix_rows(id, version_id, row_no, row_group, topic_text, document_id, annual_required, note, all_employees, locked) values (?,?,?,?,?,?,?,?,?,?)",
                    rowId, versionId, row.get("row_no"), row.get("row_group"), row.get("topic_text"), row.get("document_id"), row.get("annual_required"), row.get("note"), row.get("all_employees"), row.get("locked"));
            jdbc.update("insert into training_matrix_cells(row_id, position_id) select ?, position_id from training_matrix_cells where row_id=?", rowId, row.get("id"));
        }
        ensureAllEmployees(versionId, (UUID) m.get("department_id"));
        audit.logAs(actor, "TRAINING_MATRIX", m.get("code") + " v" + next, versionId, "TRAINING_MATRIX_UPGRADED", null, "DRAFT", "New version " + next + " started from version " + effective.getFirst().get("version_no"));
        return versionId;
    }

    /**
     * Quality Assurance (Training Administration) applies the rows it locked in this version to the matrices of all the other departments: the row is added (or locked, if the department already has it) in the
     * draft that is open; a matrix with only an effective version gets a new draft; a matrix whose version waits for approval is left as it is and reported, to be applied once that version is decided.
     */
    @Transactional
    public Map<String, Object> applyLockedRows(UserAccount actor, UUID versionId) {
        access.require(actor, "training.admin.manage");
        Map<String, Object> source = versionRow(versionId);
        List<Map<String, Object>> rows = jdbc.queryForList("select row_group, topic_text, document_id, annual_required from training_matrix_rows where version_id=? and locked order by row_no", versionId);
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_MATRIX_NO_LOCKED_ROWS");
        UUID sourceMatrix = (UUID) source.get("matrix_id");
        List<Map<String, Object>> report = new ArrayList<>();
        for (Map<String, Object> m : jdbc.queryForList("select * from training_matrices where id <> ? order by code for update", sourceMatrix)) {
            UUID matrixId = (UUID) m.get("id");
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("code", m.get("code"));
            List<Map<String, Object>> open = jdbc.queryForList("select id, status, version_no from training_matrix_versions where matrix_id=? and status in ('DRAFT','PENDING_APPROVAL') for update", matrixId);
            UUID target;
            String outcome;
            if (!open.isEmpty() && "PENDING_APPROVAL".equals(open.getFirst().get("status"))) {
                entry.put("outcome", "SKIPPED_PENDING_APPROVAL");
                report.add(entry);
                continue;
            } else if (!open.isEmpty()) {
                target = (UUID) open.getFirst().get("id");
                outcome = "ADDED_TO_DRAFT";
            } else {
                List<Map<String, Object>> effective = jdbc.queryForList("select id, version_no from training_matrix_versions where matrix_id=? and status='EFFECTIVE'", matrixId);
                if (effective.isEmpty()) {
                    entry.put("outcome", "SKIPPED_NO_VERSION");
                    report.add(entry);
                    continue;
                }
                target = startNextVersion(actor, m, effective.getFirst());
                outcome = "NEW_DRAFT";
            }
            int changed = 0;
            for (Map<String, Object> r : rows) {
                String topic = (String) r.get("topic_text");
                UUID document = (UUID) r.get("document_id");
                List<Map<String, Object>> have = jdbc.queryForList(topic != null
                        ? "select id, locked, all_employees from training_matrix_rows where version_id=? and training_topic_key(topic_text) = training_topic_key(?)"
                        : "select id, locked, all_employees from training_matrix_rows where version_id=? and document_id = ?", target, topic != null ? topic : document);
                if (have.isEmpty()) {
                    jdbc.update("""
                        insert into training_matrix_rows(id, version_id, row_no, row_group, topic_text, document_id, annual_required, all_employees, locked)
                        select gen_random_uuid(), ?, coalesce(max(row_no), 0) + 1, ?, ?, ?, ?, true, true from training_matrix_rows where version_id=?
                        """, target, r.get("row_group"), topic, document, r.get("annual_required"), target);
                    changed++;
                } else if (!Boolean.TRUE.equals(have.getFirst().get("locked")) || !Boolean.TRUE.equals(have.getFirst().get("all_employees"))) {
                    jdbc.update("update training_matrix_rows set all_employees=true, locked=true where id=?", have.getFirst().get("id"));
                    changed++;
                }
            }
            ensureAllEmployees(target, (UUID) m.get("department_id"));
            if (changed == 0) outcome = "ALREADY_THERE";
            else {
                jdbc.update("update training_matrix_versions set version=version+1, updated_at=now() where id=?", target);
                audit.logAs(actor, "TRAINING_MATRIX", m.get("code") + " (draft)", target, "TRAINING_MATRIX_LOCKED_ROWS_APPLIED", null, "DRAFT",
                        changed + " row" + (changed == 1 ? "" : "s") + " locked by Quality Assurance applied from " + label(source));
            }
            entry.put("outcome", outcome);
            entry.put("rows", changed);
            report.add(entry);
        }
        audit.logAs(actor, "TRAINING_MATRIX", label(source), versionId, "TRAINING_MATRIX_LOCKED_ROWS_APPLY", null, null, rows.size() + " locked row" + (rows.size() == 1 ? "" : "s") + " applied to " + report.size() + " other matrices");
        return Map.of("lockedRows", rows.size(), "matrices", report);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> eligibleApprovers(UserAccount actor, UUID versionId, String search, int page, int limit) {
        Map<String, Object> v = versionRow(versionId);
        return approvals.eligibleApprovers(actor, subject(v), "MATRIX_APPROVE", search, page, limit, keptApart(v, actor));
    }

    /** Sends the version for approval: the preparer signs and chooses the person who approves. */
    @Transactional
    public Map<String, Object> submit(UserAccount actor, UUID versionId, SubmitRequest request) {
        Map<String, Object> v = lockVersion(versionId);
        UUID department = departmentOf(v);
        requireManage(actor, department);
        requireStatus(v, "DRAFT");
        requireVersion(v, request == null ? null : request.version());
        Integer rows = jdbc.queryForObject("select count(*) from training_matrix_rows where version_id=?", Integer.class, versionId);
        if (rows == null || rows == 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_MATRIX_EMPTY");
        Integer uncovered = jdbc.queryForObject("select count(*) from training_matrix_rows r where r.version_id=? and not r.all_employees and not exists (select 1 from training_matrix_cells c where c.row_id = r.id)", Integer.class, versionId);
        if (uncovered != null && uncovered > 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_MATRIX_ROW_WITHOUT_POSITION");
        if (request.signatureToken() == null || request.signatureToken().isBlank()) throw new IllegalArgumentException("TRAINING_SIGNATURE_REQUIRED");
        approvals.cancelOpen(TYPE, versionId, "Resubmitted");
        approvals.designate(actor, subject(v), "MATRIX_APPROVE", request.approverUserId(), Set.of(actor.getId()));
        UUID signature = sign(actor, v, "TRAINING_MATRIX_PREPARED", request.signatureToken());
        String approverName = users.findById(request.approverUserId()).map(UserAccount::getFullName).orElse(String.valueOf(request.approverUserId()));
        jdbc.update("update training_matrix_versions set status='PENDING_APPROVAL', prepared_by=?, submitted_at=now(), prepare_signature_id=?, content_sha256=?, reject_reason=null, version=version+1, updated_at=now() where id=?",
                actor.getId(), signature, contentHash(versionId), versionId);
        audit.logAs(actor, "TRAINING_MATRIX", label(v), versionId, "TRAINING_MATRIX_SUBMITTED", "DRAFT", "PENDING_APPROVAL", "Sent for approval to " + approverName + " (" + rows + " rows)",
                List.of(new AuditTrailChangeResponse("Status", "Draft", "Pending Approval"),
                        new AuditTrailChangeResponse("Prepared by", null, actor.getFullName()),
                        new AuditTrailChangeResponse("Designated approver", null, approverName),
                        new AuditTrailChangeResponse("What changed in this version", null, v.get("change_reason") == null ? null : String.valueOf(v.get("change_reason")))),
                signature);
        return version(actor, versionId);
    }

    @Transactional
    public Map<String, Object> approve(UserAccount actor, UUID versionId, SignRequest request) {
        Map<String, Object> v = lockVersion(versionId);
        requireStatus(v, "PENDING_APPROVAL");
        requireVersion(v, request == null ? null : request.version());
        if (request.signatureToken() == null || request.signatureToken().isBlank()) throw new IllegalArgumentException("TRAINING_SIGNATURE_REQUIRED");
        UUID assignment = approvals.requireCanSign(actor, subject(v), "MATRIX_APPROVE", keptApart(v, actor));
        UUID signature = sign(actor, v, "TRAINING_MATRIX_APPROVED", request.signatureToken());
        approvals.complete(assignment, signature);
        List<Integer> replaced = jdbc.queryForList("select version_no from training_matrix_versions where matrix_id=? and status='EFFECTIVE'", Integer.class, v.get("matrix_id"));
        jdbc.update("update training_matrix_versions set status='OBSOLETED', version=version+1, updated_at=now() where matrix_id=? and status='EFFECTIVE'", v.get("matrix_id"));
        jdbc.update("update training_matrix_versions set status='EFFECTIVE', approved_by=?, approved_at=now(), effective_at=now(), approve_signature_id=?, version=version+1, updated_at=now() where id=?",
                actor.getId(), signature, versionId);
        jdbc.update("update training_matrices set current_version_id=? where id=?", versionId, v.get("matrix_id"));
        List<AuditTrailChangeResponse> approved = new ArrayList<>(List.of(new AuditTrailChangeResponse("Status", "Pending Approval", "Effective"),
                new AuditTrailChangeResponse("Approved by", null, actor.getFullName())));
        for (Integer old : replaced) approved.add(new AuditTrailChangeResponse("Version " + old + " status", "Effective", "Obsoleted"));
        audit.logAs(actor, "TRAINING_MATRIX", label(v), versionId, "TRAINING_MATRIX_APPROVED", "PENDING_APPROVAL", "EFFECTIVE",
                "Version " + v.get("version_no") + " is now effective" + (replaced.isEmpty() ? "" : "; it replaces version " + replaced.getFirst()), approved, signature);
        tellPreparer(v, actor, "TRAINING_MATRIX_APPROVED", "Training: matrix approved", label(v) + " was approved by " + actor.getFullName() + " and is now effective.");
        return version(actor, versionId);
    }

    @Transactional
    public Map<String, Object> reject(UserAccount actor, UUID versionId, RejectRequest request) {
        Map<String, Object> v = lockVersion(versionId);
        requireStatus(v, "PENDING_APPROVAL");
        requireVersion(v, request == null ? null : request.version());
        if (request.reason() == null || request.reason().isBlank()) throw new IllegalArgumentException("TRAINING_REASON_REQUIRED");
        UUID assignment = approvals.requireCanSign(actor, subject(v), "MATRIX_APPROVE", keptApart(v, actor));
        approvals.complete(assignment, null);
        approvals.cancelOpen(TYPE, versionId, "Rejected");
        jdbc.update("update training_matrix_versions set status='DRAFT', reject_reason=?, version=version+1, updated_at=now() where id=?", request.reason().trim(), versionId);
        audit.logAs(actor, "TRAINING_MATRIX", label(v), versionId, "TRAINING_MATRIX_REJECTED", "PENDING_APPROVAL", "DRAFT", request.reason().trim());
        tellPreparer(v, actor, "TRAINING_MATRIX_REJECTED", "Training: matrix sent back", label(v) + " was sent back by " + actor.getFullName() + ". Reason: " + request.reason().trim());
        return version(actor, versionId);
    }

    // ----------------------------------------------------------------------------------------------------------------------------- topics and positions

    /**
     * The Work Positions that people hold for Training (read only). A role comes from a job assignment signed by both people (APD.0024), or, for people who were there before the system, from the
     * mapping that Training Administration made once; there is no way to give a role here any more. A person can hold several.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> personPositions(UserAccount actor, String search, boolean unmatchedOnly, String department, UUID positionId, String mapped, String suggested, String sortBy, String sortDirection, int page, int limit) {
        access.require(actor, "training.admin.manage", "training.job_assignment.view", "training.job_assignment.manage", "training.matrix.view", "training.matrix.manage");
        String roles = "(select string_agg(r.name, ', ' order by r.name) from training_person_positions tp join training_job_roles r on r.id = tp.position_id where tp.person_user_id = u.id and tp.valid_to is null)";
        StringBuilder where = new StringBuilder(" where u.status = 'Active'");
        List<Object> args = new ArrayList<>();
        // a person who is not allowed on all departments sees the people of their own department only
        if (!access.allDepartments(actor)) {
            if (actor.getDepartment() == null || actor.getDepartment().isBlank()) where.append(" and false");
            else { where.append(" and lower(trim(u.department)) = lower(trim(?))"); args.add(actor.getDepartment()); }
        }
        if (search != null && !search.isBlank()) {
            where.append(" and (lower(u.full_name) like ? escape '\' or lower(coalesce(u.employee_code,'')) like ? escape '\' or lower(coalesce(u.department,'')) like ? escape '\' or lower(coalesce(u.position,'')) like ? escape '\' or lower(coalesce(" + roles + ",'')) like ? escape '\')");
            String like = "%" + escape(search.trim().toLowerCase(Locale.ROOT)) + "%";
            args.add(like); args.add(like); args.add(like); args.add(like); args.add(like);
        }
        String has = " exists (select 1 from training_person_positions tp where tp.person_user_id = u.id and tp.valid_to is null)";
        if (unmatchedOnly || "NO".equalsIgnoreCase(mapped)) where.append(" and not").append(has);
        if ("YES".equalsIgnoreCase(mapped)) where.append(" and").append(has);
        if (department != null && !department.isBlank()) { where.append(" and lower(trim(u.department)) = lower(trim(?))"); args.add(department); }
        if (positionId != null) { where.append(" and exists (select 1 from training_person_positions tp where tp.person_user_id = u.id and tp.valid_to is null and tp.position_id = ?)"); args.add(positionId); }
        String from = " from app_users u ";
        Long total = jdbc.queryForObject("select count(*)" + from + where, Long.class, args.toArray());
        int safeLimit = Math.min(Math.max(limit, 1), 100), safePage = Math.max(page, 1);
        args.add(safeLimit); args.add((safePage - 1) * safeLimit);
        List<Map<String, Object>> rows = jdbc.queryForList("select u.id as person_id, u.full_name, u.avatar, u.employee_code, u.department, u.position as position_text, " + roles + " as job_role_names, "
                + "(select count(*) from training_person_positions tp where tp.person_user_id = u.id and tp.valid_to is null) as job_role_count, "
                + "(select r.name from training_person_positions tp join training_job_roles r on r.id = tp.position_id where tp.person_user_id = u.id and tp.valid_to is null order by r.name, r.id limit 1) as first_position_name, "
                + "(select r.name from training_person_positions tp join training_job_roles r on r.id = tp.position_id where tp.person_user_id = u.id and tp.valid_to is null order by r.name, r.id limit 1 offset 1) as second_position_name, "
                + "(select string_agg(distinct tp.source, ', ') from training_person_positions tp where tp.person_user_id = u.id and tp.valid_to is null) as sources"
                + from + where + TrainingRows.orderBy(sortBy, sortDirection, Map.of("fullName", "u.full_name", "employeeCode", "u.employee_code", "department", "u.department", "positionText", "u.position", "jobRoleNames", roles), "u.full_name") + " limit ? offset ?", args.toArray());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("data", TrainingRows.camel(rows));
        long count = total == null ? 0 : total;
        result.put("pagination", Map.of("page", safePage, "limit", safeLimit, "total", count, "totalPages", Math.max(1, (count + safeLimit - 1) / safeLimit)));
        return result;
    }

    /** Pages the current positions of a person visible in the person-positions list. */
    @Transactional(readOnly = true)
    public Map<String, Object> personPositionDetails(UserAccount actor, UUID personId, String search, int page, int limit) {
        access.require(actor, "training.admin.manage", "training.job_assignment.view", "training.job_assignment.manage", "training.matrix.view", "training.matrix.manage");
        boolean all = access.allDepartments(actor);
        if (!all && (actor.getDepartment() == null || actor.getDepartment().isBlank())) throw new SecurityException(TrainingAccess.DENIED);
        String scope = all ? "" : " and lower(trim(u.department)) = lower(trim(?))";
        List<Object> scopeArgs = new ArrayList<>();
        scopeArgs.add(personId);
        if (!all) scopeArgs.add(actor.getDepartment());
        Integer allowed = jdbc.queryForObject("select count(*) from app_users u where u.id = ? and u.status = 'Active'" + scope, Integer.class, scopeArgs.toArray());
        if (allowed == null || allowed == 0) throw new SecurityException(TrainingAccess.DENIED);
        String like = "%" + escape(search == null ? "" : search.trim().toLowerCase(Locale.ROOT)) + "%";
        String from = " from training_person_positions tp join training_job_roles r on r.id = tp.position_id join app_users u on u.id = tp.person_user_id ";
        String where = " where tp.person_user_id = ? and u.status = 'Active' and tp.valid_to is null and lower(r.name) like ? escape '\\'" + scope;
        List<Object> args = new ArrayList<>();
        args.add(personId); args.add(like);
        if (!all) args.add(actor.getDepartment());
        Long count = jdbc.queryForObject("select count(*)" + from + where, Long.class, args.toArray());
        int safePage = Math.max(1, page), safeLimit = Math.min(100, Math.max(1, limit));
        long total = count == null ? 0 : count;
        args.add(safeLimit); args.add((long) (safePage - 1) * safeLimit);
        var rows = TrainingRows.camel(jdbc.queryForList("select r.id::text as id, r.name, coalesce(d.name, '') as department, false as carried, tp.source"
                + from + " left join departments d on d.id = tp.department_id " + where + " order by r.name, r.id limit ? offset ?", args.toArray()));
        return Map.of("data", rows, "pagination", Map.of("page", safePage, "limit", safeLimit, "total", total, "totalPages", Math.max(1, (total + safeLimit - 1) / safeLimit)));
    }

    /** Every active Work Position (with its department), for the filters. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> allPositions(UserAccount actor) {
        access.require(actor, "training.admin.manage", "training.matrix.view", "training.matrix.manage");
        return TrainingRows.camel(jdbc.queryForList("select p.id, p.code, p.name, p.department_id, d.name as department_name from training_job_roles p left join departments d on d.id = p.department_id where p.is_active order by p.name"));
    }

    // ----------------------------------------------------------------------------------------------------------------------------- helpers

    private Map<String, Object> matrixRow(UUID id) {
        return jdbc.queryForList("select * from training_matrices where id=?", id).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
    }

    private Map<String, Object> versionRow(UUID id) {
        return jdbc.queryForList("select * from training_matrix_versions where id=?", id).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
    }

    private Map<String, Object> lockVersion(UUID id) {
        return jdbc.queryForList("select * from training_matrix_versions where id=? for update", id).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
    }

    private UUID departmentOf(Map<String, Object> version) {
        return (UUID) matrixRow((UUID) version.get("matrix_id")).get("department_id");
    }

    /** What two texts of a topic are compared by: case and the spaces between the words do not matter (the same rule as the database function training_topic_key). */
    static String topicKey(String text) {
        return text == null ? "" : text.trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }

    private static String rowKey(String topicText, UUID documentId) {
        return topicText != null ? "T" + topicKey(topicText) : "D" + documentId;
    }

    private static String clean(String topicText) {
        return topicText == null || topicText.isBlank() ? null : topicText.trim().replaceAll("\\s+", " ");
    }

    /** Each row of a version as "title" -> "positions | annual", to tell what a save changed. */
    private Map<String, String> rowSnapshot(UUID versionId) {
        Map<String, String> out = new LinkedHashMap<>();
        for (Map<String, Object> r : jdbc.queryForList("""
                select r.id, r.annual_required, r.all_employees, coalesce(r.topic_text, d.document_number || ' ' || d.document_name) as title
                from training_matrix_rows r left join documents d on d.id = r.document_id
                where r.version_id=? order by r.row_no""", versionId)) {
            List<String> positions = jdbc.queryForList("select p.name from training_matrix_cells c join training_job_roles p on p.id = c.position_id where c.row_id=? order by p.name", String.class, r.get("id"));
            out.put(String.valueOf(r.get("title")), (Boolean.TRUE.equals(r.get("all_employees")) ? "All employees" : positions.isEmpty() ? "no position" : String.join(", ", positions)) + (Boolean.TRUE.equals(r.get("annual_required")) ? " | every year" : ""));
        }
        return out;
    }

    private List<AuditTrailChangeResponse> rowChanges(Map<String, String> before, Map<String, String> after) {
        List<AuditTrailChangeResponse> out = new ArrayList<>();
        after.forEach((title, now) -> {
            if (!before.containsKey(title)) out.add(new AuditTrailChangeResponse("Row added: " + title, null, now));
            else if (!before.get(title).equals(now)) out.add(new AuditTrailChangeResponse("Row changed: " + title, before.get(title), now));
        });
        before.forEach((title, was) -> {
            if (!after.containsKey(title)) out.add(new AuditTrailChangeResponse("Row removed: " + title, was, null));
        });
        return out;
    }

    private String label(Map<String, Object> version) {
        return matrixRow((UUID) version.get("matrix_id")).get("code") + " v" + version.get("version_no");
    }

    private TrainingApprovalService.Subject subject(Map<String, Object> version) {
        return new TrainingApprovalService.Subject(TYPE, (UUID) version.get("id"), departmentOf(version), label(version), "training.matrix.manage");
    }

    /** The person who prepared the version, and the person who is acting, cannot approve it. */
    private Set<UUID> keptApart(Map<String, Object> version, UserAccount actor) {
        Set<UUID> apart = new LinkedHashSet<>();
        if (version.get("prepared_by") != null) apart.add((UUID) version.get("prepared_by"));
        return apart;
    }

    private void tellPreparer(Map<String, Object> version, UserAccount actor, String event, String title, String message) {
        if (version.get("prepared_by") == null) return;
        users.findById((UUID) version.get("prepared_by")).ifPresent(preparer -> notifier.send(event, preparer, actor, title, message, TYPE, (UUID) version.get("id"), null));
    }

    private void requireManage(UserAccount actor, UUID department) {
        access.require(actor, "training.matrix.manage");
        access.requireScope(actor, department);
    }

    private static void requireStatus(Map<String, Object> v, String... allowed) {
        for (String s : allowed) if (s.equals(v.get("status"))) return;
        throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_MATRIX_INVALID_TRANSITION");
    }

    private static void requireVersion(Map<String, Object> v, Integer version) {
        if (version == null || version.intValue() != ((Number) v.get("version")).intValue()) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_MATRIX_VERSION_CHANGED");
    }

    private UUID sign(UserAccount actor, Map<String, Object> v, String meaning, String token) {
        String reason = "Training Management: " + meaning.replace("TRAINING_", "").replace('_', ' ').toLowerCase(Locale.ROOT);
        return signatures.createEntitySignature(TYPE, (UUID) v.get("id"), label(v), actor, token, meaning, reason, null, null, null).getId();
    }

    /** A fingerprint of the rows and cells at the time of submission, so that what was approved can be proved to be what was prepared. */
    private String contentHash(UUID versionId) {
        StringBuilder sb = new StringBuilder();
        for (Map<String, Object> r : jdbc.queryForList("select id, row_no, row_group, topic_text, document_id, annual_required, all_employees, locked from training_matrix_rows where version_id=? order by row_no", versionId)) {
            sb.append(r.get("row_no")).append('|').append(r.get("row_group")).append('|').append(r.get("topic_text")).append('|').append(r.get("document_id")).append('|').append(r.get("annual_required")).append('|').append(r.get("locked"));
            for (UUID p : jdbc.queryForList("select position_id from training_matrix_cells where row_id=? order by position_id", UUID.class, r.get("id"))) sb.append('|').append(p);
            sb.append('\n');
        }
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(sb.toString().getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }

    private static String escape(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
