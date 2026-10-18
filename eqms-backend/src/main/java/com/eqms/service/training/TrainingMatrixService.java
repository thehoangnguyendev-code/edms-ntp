package com.eqms.service.training;

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

    public record RowRequest(String group, UUID topicId, UUID documentId, Boolean annualRequired, String note, List<UUID> positionIds) {}
    public record SaveRequest(Integer version, String changeReason, List<RowRequest> rows) {}
    public record SubmitRequest(Integer version, String signatureToken, UUID approverUserId) {}
    public record SignRequest(Integer version, String signatureToken) {}
    public record RejectRequest(Integer version, String reason) {}
    public record TopicRequest(String code, String name, String scope, UUID departmentId, Boolean active, Integer version) {}

    // ----------------------------------------------------------------------------------------------------------------------------- reading

    @Transactional(readOnly = true)
    public Map<String, Object> matrices(UserAccount actor, String search, String state, int page, int limit) {
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
            """ + from + where + " order by d.name limit ? offset ?", pageArgs.toArray());
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
        out.put("versions", TrainingRows.camel(jdbc.queryForList("""
            select v.id, v.version_no, v.status, v.change_reason, v.reject_reason, v.effective_at, v.approved_at, pu.full_name as prepared_by_name, au.full_name as approved_by_name
              from training_matrix_versions v left join app_users pu on pu.id = v.prepared_by left join app_users au on au.id = v.approved_by
             where v.matrix_id=? order by v.version_no desc
            """, matrixId)));
        out.put("canManage", access.has(actor, "training.matrix.manage") && access.inScope(actor, (UUID) m.get("department_id")));
        return out;
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
            select r.id, r.row_no, r.row_group, r.topic_id, r.document_id, r.annual_required, r.note,
                   t.code as topic_code, t.name as topic_name, d.document_number, d.document_name
              from training_matrix_rows r left join training_topics t on t.id = r.topic_id left join documents d on d.id = r.document_id
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
        return TrainingRows.camel(jdbc.queryForList("select id, code, name from positions where is_active and department_id=? order by name", departmentId));
    }

    @Transactional(readOnly = true)
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
        return Map.of("from", va.get("versionNo"), "to", vb.get("versionNo"), "added", added, "removed", removed, "changed", changed);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Map<String, Object>> byKey(Map<String, Object> version) {
        Map<String, Map<String, Object>> map = new LinkedHashMap<>();
        for (Map<String, Object> row : (List<Map<String, Object>>) version.get("rows")) {
            map.put(row.get("topicId") != null ? "T" + row.get("topicId") : "D" + row.get("documentId"), row);
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
            select r.row_no, r.row_group, r.annual_required, coalesce(t.name, d.document_name) as title, coalesce(t.code, d.document_number) as code
              from training_matrix_versions v join training_matrix_rows r on r.version_id = v.id join training_matrix_cells c on c.row_id = r.id and c.position_id = ?
              left join training_topics t on t.id = r.topic_id left join documents d on d.id = r.document_id
             where v.matrix_id=? and v.status='EFFECTIVE' order by r.row_no
            """, positionId, matrixId));
    }

    // ----------------------------------------------------------------------------------------------------------------------------- writing

    @Transactional
    public Map<String, Object> createMatrix(UserAccount actor, UUID departmentId) {
        access.require(actor, "training.matrix.manage");
        if (departmentId == null) throw new IllegalArgumentException("TRAINING_DEPARTMENT_REQUIRED");
        access.requireScope(actor, departmentId);
        String code = jdbc.queryForList("select code from departments where id=?", String.class, departmentId).stream().findFirst().orElseThrow(() -> new IllegalArgumentException("TRAINING_DEPARTMENT_REQUIRED"));
        Integer exists = jdbc.queryForObject("select count(*) from training_matrices where department_id=?", Integer.class, departmentId);
        if (exists != null && exists > 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_MATRIX_EXISTS");
        UUID matrixId = UUID.randomUUID(), versionId = UUID.randomUUID();
        jdbc.update("insert into training_matrices(id, department_id, code, created_by) values (?,?,?,?)", matrixId, departmentId, "TM-" + code, actor.getId());
        jdbc.update("insert into training_matrix_versions(id, matrix_id, version_no, prepared_by) values (?,?,1,?)", versionId, matrixId, actor.getId());
        audit.logAs(actor, "TRAINING_MATRIX", "TM-" + code, matrixId, "TRAINING_MATRIX_CREATED", null, "DRAFT", "Matrix created with a draft version 1");
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
        Set<UUID> allowed = new LinkedHashSet<>(jdbc.queryForList("select id from positions where is_active and department_id=?", UUID.class, department));
        jdbc.update("delete from training_matrix_cells where row_id in (select id from training_matrix_rows where version_id=?)", versionId);
        jdbc.update("delete from training_matrix_rows where version_id=?", versionId);
        int no = 0;
        Set<String> seen = new LinkedHashSet<>();
        for (RowRequest row : request.rows()) {
            if (row.group() == null || !GROUPS.contains(row.group())) throw new IllegalArgumentException("TRAINING_MATRIX_ROW_INVALID");
            if ((row.topicId() == null) == (row.documentId() == null)) throw new IllegalArgumentException("TRAINING_MATRIX_ROW_INVALID");
            if (!seen.add(row.topicId() != null ? "T" + row.topicId() : "D" + row.documentId())) throw new IllegalArgumentException("TRAINING_MATRIX_ROW_DUPLICATE");
            if (row.topicId() != null && jdbc.queryForObject("select count(*) from training_topics where id=? and active", Integer.class, row.topicId()) == 0) throw new IllegalArgumentException("TRAINING_MATRIX_ROW_INVALID");
            if (row.documentId() != null && jdbc.queryForObject("select count(*) from documents where id=?", Integer.class, row.documentId()) == 0) throw new IllegalArgumentException("TRAINING_MATRIX_ROW_INVALID");
            UUID rowId = UUID.randomUUID();
            jdbc.update("insert into training_matrix_rows(id, version_id, row_no, row_group, topic_id, document_id, annual_required, note) values (?,?,?,?,?,?,?,?)",
                    rowId, versionId, ++no, row.group(), row.topicId(), row.documentId(), Boolean.TRUE.equals(row.annualRequired()), row.note() == null || row.note().isBlank() ? null : row.note().trim());
            for (UUID position : row.positionIds() == null ? List.<UUID>of() : new LinkedHashSet<>(row.positionIds())) {
                if (!allowed.contains(position)) throw new IllegalArgumentException("TRAINING_MATRIX_POSITION_INVALID");
                jdbc.update("insert into training_matrix_cells(row_id, position_id) values (?,?)", rowId, position);
            }
        }
        jdbc.update("update training_matrix_versions set change_reason=?, version=version+1, updated_at=now() where id=?", request.changeReason() == null ? null : request.changeReason().trim(), versionId);
        audit.logAs(actor, "TRAINING_MATRIX", label(v), versionId, "TRAINING_MATRIX_SAVED", null, null, no + " rows saved");
        return version(actor, versionId);
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
        int next = ((Number) jdbc.queryForObject("select max(version_no) from training_matrix_versions where matrix_id=?", Number.class, matrixId)).intValue() + 1;
        UUID versionId = UUID.randomUUID();
        jdbc.update("insert into training_matrix_versions(id, matrix_id, version_no, prepared_by) values (?,?,?,?)", versionId, matrixId, next, actor.getId());
        for (Map<String, Object> row : jdbc.queryForList("select * from training_matrix_rows where version_id=? order by row_no", effective.getFirst().get("id"))) {
            UUID rowId = UUID.randomUUID();
            jdbc.update("insert into training_matrix_rows(id, version_id, row_no, row_group, topic_id, document_id, annual_required, note) values (?,?,?,?,?,?,?,?)",
                    rowId, versionId, row.get("row_no"), row.get("row_group"), row.get("topic_id"), row.get("document_id"), row.get("annual_required"), row.get("note"));
            jdbc.update("insert into training_matrix_cells(row_id, position_id) select ?, position_id from training_matrix_cells where row_id=?", rowId, row.get("id"));
        }
        audit.logAs(actor, "TRAINING_MATRIX", m.get("code") + " v" + next, versionId, "TRAINING_MATRIX_UPGRADED", null, "DRAFT", "New version " + next + " started from version " + effective.getFirst().get("version_no"));
        return version(actor, versionId);
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
        Integer uncovered = jdbc.queryForObject("select count(*) from training_matrix_rows r where r.version_id=? and not exists (select 1 from training_matrix_cells c where c.row_id = r.id)", Integer.class, versionId);
        if (uncovered != null && uncovered > 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_MATRIX_ROW_WITHOUT_POSITION");
        if (request.signatureToken() == null || request.signatureToken().isBlank()) throw new IllegalArgumentException("TRAINING_SIGNATURE_REQUIRED");
        approvals.cancelOpen(TYPE, versionId, "Resubmitted");
        approvals.designate(actor, subject(v), "MATRIX_APPROVE", request.approverUserId(), Set.of(actor.getId()));
        UUID signature = sign(actor, v, "TRAINING_MATRIX_PREPARED", request.signatureToken());
        jdbc.update("update training_matrix_versions set status='PENDING_APPROVAL', prepared_by=?, submitted_at=now(), prepare_signature_id=?, content_sha256=?, reject_reason=null, version=version+1, updated_at=now() where id=?",
                actor.getId(), signature, contentHash(versionId), versionId);
        audit.logAs(actor, "TRAINING_MATRIX", label(v), versionId, "TRAINING_MATRIX_SUBMITTED", "DRAFT", "PENDING_APPROVAL", "Sent for approval");
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
        jdbc.update("update training_matrix_versions set status='OBSOLETE', version=version+1, updated_at=now() where matrix_id=? and status='EFFECTIVE'", v.get("matrix_id"));
        jdbc.update("update training_matrix_versions set status='EFFECTIVE', approved_by=?, approved_at=now(), effective_at=now(), approve_signature_id=?, version=version+1, updated_at=now() where id=?",
                actor.getId(), signature, versionId);
        jdbc.update("update training_matrices set current_version_id=? where id=?", versionId, v.get("matrix_id"));
        audit.logAs(actor, "TRAINING_MATRIX", label(v), versionId, "TRAINING_MATRIX_APPROVED", "PENDING_APPROVAL", "EFFECTIVE", "Version " + v.get("version_no") + " is now effective");
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

    @Transactional(readOnly = true)
    public List<Map<String, Object>> topics(UserAccount actor, String search, boolean activeOnly) {
        access.require(actor, "training.matrix.view", "training.matrix.manage", "training.admin.manage");
        String like = "%" + escape((search == null ? "" : search.trim()).toLowerCase(Locale.ROOT)) + "%";
        return TrainingRows.camel(jdbc.queryForList("""
            select t.id, t.code, t.name, t.scope, t.department_id, d.name as department_name, t.active, t.version
              from training_topics t left join departments d on d.id = t.department_id
             where (lower(t.name) like ? escape '\\' or lower(t.code) like ? escape '\\')""" + (activeOnly ? " and t.active" : "") + " order by t.code limit 200", like, like));
    }

    /** Paged, searchable, sortable list for the Training Topics administration screen. Sort keys are fixed; anything else falls back to code. */
    @Transactional(readOnly = true)
    public Map<String, Object> topicsPage(UserAccount actor, String search, String scope, String status, String sortBy, String sortDirection, int page, int limit) {
        access.require(actor, "training.matrix.view", "training.matrix.manage", "training.admin.manage");
        String like = "%" + escape((search == null ? "" : search.trim()).toLowerCase(Locale.ROOT)) + "%";
        List<Object> filters = new ArrayList<>(List.of(like, like));
        StringBuilder where = new StringBuilder(" where (lower(t.name) like ? escape '\\' or lower(t.code) like ? escape '\\')");
        // A scope or status the screen does not know is ignored rather than turned into SQL.
        if (scope != null && Set.of("FACTORY_GENERAL", "DEPARTMENT_GENERAL", "OTHER").contains(scope)) {
            where.append(" and t.scope = ?");
            filters.add(scope);
        }
        if ("Active".equalsIgnoreCase(status)) where.append(" and t.active");
        else if ("Inactive".equalsIgnoreCase(status)) where.append(" and not t.active");
        String from = " from training_topics t left join departments d on d.id = t.department_id";
        String column = switch (sortBy == null ? "" : sortBy) {
            case "name" -> "t.name";
            case "scope" -> "t.scope";
            case "department" -> "d.name";
            case "active" -> "t.active";
            default -> "t.code";
        };
        String direction = "desc".equalsIgnoreCase(sortDirection) ? "desc" : "asc";
        int safeLimit = Math.min(Math.max(limit, 1), 100), safePage = Math.max(page, 1);
        Long total = jdbc.queryForObject("select count(*)" + from + where, Long.class, filters.toArray());
        List<Object> args = new ArrayList<>(filters);
        args.add(safeLimit);
        args.add((safePage - 1) * safeLimit);
        List<Map<String, Object>> rows = jdbc.queryForList("""
            select t.id, t.code, t.name, t.scope, t.department_id, d.name as department_name, t.active, t.version
            """ + from + where + " order by " + column + " " + direction + ", t.code limit ? offset ?", args.toArray());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("data", TrainingRows.camel(rows));
        long count = total == null ? 0 : total;
        result.put("pagination", Map.of("page", safePage, "limit", safeLimit, "total", count, "totalPages", Math.max(1, (count + safeLimit - 1) / safeLimit)));
        return result;
    }

    @Transactional
    public Map<String, Object> saveTopic(UserAccount actor, UUID id, TopicRequest request) {
        access.require(actor, "training.admin.manage");
        if (request == null || request.name() == null || request.name().isBlank() || request.name().length() > 255) throw new IllegalArgumentException("TRAINING_TITLE_REQUIRED");
        String scope = request.scope() == null ? "OTHER" : request.scope();
        if (!Set.of("FACTORY_GENERAL", "DEPARTMENT_GENERAL", "OTHER").contains(scope)) throw new IllegalArgumentException("TRAINING_TOPIC_INVALID");
        if ("DEPARTMENT_GENERAL".equals(scope) && request.departmentId() == null) throw new IllegalArgumentException("TRAINING_DEPARTMENT_REQUIRED");
        UUID topicId = id;
        if (id == null) {
            if (request.code() == null || !request.code().trim().matches("[A-Za-z0-9._-]{1,40}")) throw new IllegalArgumentException("TRAINING_TOPIC_INVALID");
            Integer dup = jdbc.queryForObject("select count(*) from training_topics where upper(code)=upper(?)", Integer.class, request.code().trim());
            if (dup != null && dup > 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_TOPIC_CODE_USED");
            topicId = UUID.randomUUID();
            jdbc.update("insert into training_topics(id, code, name, scope, department_id, created_by) values (?,?,?,?,?,?)", topicId, request.code().trim().toUpperCase(Locale.ROOT), request.name().trim(), scope,
                    "DEPARTMENT_GENERAL".equals(scope) ? request.departmentId() : null, actor.getId());
        } else {
            Map<String, Object> current = jdbc.queryForList("select * from training_topics where id=? for update", id).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
            if (request.version() == null || request.version() != ((Number) current.get("version")).intValue()) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_TOPIC_VERSION_CHANGED");
            jdbc.update("update training_topics set name=?, scope=?, department_id=?, active=?, version=version+1 where id=?", request.name().trim(), scope,
                    "DEPARTMENT_GENERAL".equals(scope) ? request.departmentId() : null, request.active() == null ? current.get("active") : request.active(), id);
        }
        audit.logAs(actor, "TRAINING_TOPIC", request.name().trim(), topicId, id == null ? "TRAINING_TOPIC_CREATED" : "TRAINING_TOPIC_UPDATED", null, null, request.name().trim());
        return TrainingRows.camel(jdbc.queryForList("select id, code, name, scope, department_id, active, version from training_topics where id=?", topicId).getFirst());
    }

    /** The positions of a person (the user table keeps only text). The report of people without a position is for the person who maps them by hand. */
    @Transactional(readOnly = true)
    public Map<String, Object> personPositions(UserAccount actor, String search, boolean unmatchedOnly, int page, int limit) {
        access.require(actor, "training.admin.manage");
        StringBuilder where = new StringBuilder(" where u.status = 'Active'");
        List<Object> args = new ArrayList<>();
        if (search != null && !search.isBlank()) {
            where.append(" and (lower(u.full_name) like ? escape '\\' or lower(coalesce(u.employee_code,'')) like ? escape '\\')");
            String like = "%" + escape(search.trim().toLowerCase(Locale.ROOT)) + "%";
            args.add(like); args.add(like);
        }
        if (unmatchedOnly) where.append(" and tp.id is null");
        String from = " from app_users u left join training_person_positions tp on tp.person_user_id = u.id and tp.valid_to is null left join positions p on p.id = tp.position_id ";
        Long total = jdbc.queryForObject("select count(*)" + from + where, Long.class, args.toArray());
        int safeLimit = Math.min(Math.max(limit, 1), 100), safePage = Math.max(page, 1);
        args.add(safeLimit); args.add((safePage - 1) * safeLimit);
        List<Map<String, Object>> rows = jdbc.queryForList("""
            select u.id as person_id, u.full_name, u.employee_code, u.department, u.position as position_text, p.id as position_id, p.name as position_name,
                   (select pp.id from positions pp where lower(trim(pp.name)) = lower(trim(u.position)) limit 1) as suggested_position_id
            """ + from + where + " order by u.full_name limit ? offset ?", args.toArray());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("data", TrainingRows.camel(rows));
        long count = total == null ? 0 : total;
        result.put("pagination", Map.of("page", safePage, "limit", safeLimit, "total", count, "totalPages", Math.max(1, (count + safeLimit - 1) / safeLimit)));
        return result;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> allPositions(UserAccount actor) {
        access.require(actor, "training.admin.manage", "training.matrix.view", "training.matrix.manage");
        return TrainingRows.camel(jdbc.queryForList("select p.id, p.code, p.name, p.department_id, d.name as department_name from positions p left join departments d on d.id = p.department_id where p.is_active order by p.name"));
    }

    @Transactional
    public Map<String, Object> setPersonPosition(UserAccount actor, UUID personId, UUID positionId) {
        access.require(actor, "training.admin.manage");
        UserAccount person = users.findById(personId).orElseThrow(() -> new IllegalArgumentException("TRAINING_PARTICIPANT_NOT_ELIGIBLE"));
        if (person.getStatus() != UserStatus.Active) throw new IllegalArgumentException("TRAINING_PARTICIPANT_NOT_ELIGIBLE");
        List<Map<String, Object>> position = jdbc.queryForList("select id, name, department_id from positions where id=? and is_active", positionId);
        if (position.isEmpty()) throw new IllegalArgumentException("TRAINING_POSITION_INVALID");
        jdbc.update("update training_person_positions set valid_to=current_date where person_user_id=? and valid_to is null", personId);
        jdbc.update("insert into training_person_positions(id, person_user_id, position_id, department_id, source, created_by) values (?,?,?,?, 'ADMIN', ?)", UUID.randomUUID(), personId, positionId, position.getFirst().get("department_id"), actor.getId());
        audit.logAs(actor, "TRAINING_PERSON_POSITION", person.getFullName(), personId, "TRAINING_PERSON_POSITION_SET", null, String.valueOf(position.getFirst().get("name")), "Position mapped by hand");
        return Map.of("personId", personId, "positionId", positionId, "positionName", position.getFirst().get("name"));
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
        for (Map<String, Object> r : jdbc.queryForList("select id, row_no, row_group, topic_id, document_id, annual_required from training_matrix_rows where version_id=? order by row_no", versionId)) {
            sb.append(r.get("row_no")).append('|').append(r.get("row_group")).append('|').append(r.get("topic_id")).append('|').append(r.get("document_id")).append('|').append(r.get("annual_required"));
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
