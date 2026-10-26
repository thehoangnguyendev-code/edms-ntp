package com.eqms.service.training;

import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.entity.UserAccount;
import com.eqms.service.AuditTrailService;
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
import java.util.UUID;

/**
 * Job Roles of Training (SOP.0003 5.2 and 5.3.8): a duty under a department, for example "QC - Microbiology", under the title (Position of the Dictionaries) that the person has. The training
 * matrix has one column for each Job Role and a job assignment (APD.0024) gives a Job Role to a person. The code and the department of a Job Role never change; a Job Role that a person
 * holds now cannot be deactivated.
 */
@Service
public class TrainingJobRoleService {
    private static final String TYPE = "TRAINING_JOB_ROLE";
    private static final String[] READERS = {"training.admin.manage", "training.matrix.view", "training.matrix.manage", "training.job_assignment.view", "training.job_assignment.manage"};
    private final JdbcTemplate jdbc;
    private final TrainingAccess access;
    private final AuditTrailService audit;

    public TrainingJobRoleService(JdbcTemplate jdbc, TrainingAccess access, AuditTrailService audit) {
        this.jdbc = jdbc;
        this.access = access;
        this.audit = audit;
    }

    public record SaveRequest(String code, String name, UUID departmentId, UUID titlePositionId, String description, String jurisdiction, Boolean active, Integer version) {}

    private static final String SELECT = """
        select r.id, r.code, r.name, r.department_id, d.name as department_name, r.title_position_id, tp.name as title_position_name, r.description, r.jurisdiction, r.is_active as active, r.version,
               (select count(*) from training_person_positions pp where pp.position_id = r.id and pp.valid_to is null) as holders,
               (select count(distinct c.row_id) from training_matrix_cells c join training_matrix_rows mr on mr.id = c.row_id join training_matrix_versions v on v.id = mr.version_id
                 where c.position_id = r.id and v.status = 'EFFECTIVE') as effective_topics
          from training_job_roles r join departments d on d.id = r.department_id left join positions tp on tp.id = r.title_position_id
        """;

    @Transactional(readOnly = true)
    public Map<String, Object> list(UserAccount actor, String search, String status, UUID departmentId, UUID titlePositionId, String sortBy, String sortDirection, int page, int limit) {
        access.require(actor, READERS);
        TrainingListFilter filter = new TrainingListFilter().contains(search, "r.code", "r.name", "d.name", "tp.name", "r.description")
                .equal("r.department_id", departmentId).equal("r.title_position_id", titlePositionId);
        // A status the screen does not know is ignored rather than turned into SQL.
        if ("Active".equalsIgnoreCase(status)) filter.raw("r.is_active");
        else if ("Inactive".equalsIgnoreCase(status)) filter.raw("not r.is_active");
        String from = " from training_job_roles r join departments d on d.id = r.department_id left join positions tp on tp.id = r.title_position_id ";
        int safeLimit = Math.min(Math.max(limit, 1), 100), safePage = Math.max(page, 1);
        Long total = jdbc.queryForObject("select count(*)" + from + filter.where(), Long.class, filter.args().toArray());
        List<Object> args = new ArrayList<>(filter.args());
        args.add(safeLimit);
        args.add((safePage - 1) * safeLimit);
        List<Map<String, Object>> rows = TrainingRows.camel(jdbc.queryForList(SELECT + filter.where()
                + TrainingRows.orderBy(sortBy, sortDirection, Map.of("code", "r.code", "name", "r.name", "department", "d.name", "title", "tp.name", "active", "r.is_active"), "r.name") + " limit ? offset ?", args.toArray()));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("data", rows);
        long count = total == null ? 0 : total;
        result.put("pagination", Map.of("page", safePage, "limit", safeLimit, "total", count, "totalPages", Math.max(1, (count + safeLimit - 1) / safeLimit)));
        return result;
    }

    /** The active Job Roles of a department (or of all), for the matrix, the job assignment and the filters. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> options(UserAccount actor, UUID departmentId) {
        access.require(actor, READERS);
        TrainingListFilter filter = new TrainingListFilter().raw("r.is_active").equal("r.department_id", departmentId);
        return TrainingRows.camel(jdbc.queryForList("select r.id, r.code, r.name, r.department_id, d.name as department_name, tp.name as title_position_name"
                + " from training_job_roles r join departments d on d.id = r.department_id left join positions tp on tp.id = r.title_position_id" + filter.where() + " order by d.name, r.name", filter.args().toArray()));
    }

    @Transactional(readOnly = true)
    public Map<String, Object> get(UserAccount actor, UUID id) {
        access.require(actor, READERS);
        return TrainingRows.camel(jdbc.queryForList(SELECT + " where r.id = ?", id).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED)));
    }

    @Transactional
    public Map<String, Object> save(UserAccount actor, UUID id, SaveRequest request) {
        access.require(actor, "training.admin.manage");
        if (request == null || request.name() == null || request.name().isBlank() || request.name().trim().length() > 120) throw new IllegalArgumentException("TRAINING_TITLE_REQUIRED");
        if (request.titlePositionId() != null && jdbc.queryForObject("select count(*) from positions where id = ? and is_active", Integer.class, request.titlePositionId()) == 0) throw new IllegalArgumentException("TRAINING_POSITION_INVALID");
        UUID roleId = id;
        List<AuditTrailChangeResponse> changes = new ArrayList<>();
        if (id == null) {
            if (request.code() == null || !request.code().trim().matches("[A-Za-z0-9._-]{1,40}")) throw new IllegalArgumentException("TRAINING_JOB_ROLE_INVALID");
            if (request.departmentId() == null || jdbc.queryForObject("select count(*) from departments where id = ?", Integer.class, request.departmentId()) == 0) throw new IllegalArgumentException("TRAINING_DEPARTMENT_REQUIRED");
            if (jdbc.queryForObject("select count(*) from training_job_roles where lower(code) = lower(?)", Integer.class, request.code().trim()) > 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_JOB_ROLE_CODE_USED");
            if (jdbc.queryForObject("select count(*) from training_job_roles where department_id = ? and lower(name) = lower(?)", Integer.class, request.departmentId(), request.name().trim()) > 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_JOB_ROLE_NAME_USED");
            roleId = UUID.randomUUID();
            jdbc.update("insert into training_job_roles(id, department_id, title_position_id, code, name, description, jurisdiction, created_by, updated_by) values (?,?,?,?,?,?,?,?,?)", roleId, request.departmentId(), request.titlePositionId(),
                    request.code().trim().toUpperCase(Locale.ROOT), request.name().trim(), blank(request.description()), blank(request.jurisdiction()), actor.getId(), actor.getId());
        } else {
            Map<String, Object> current = jdbc.queryForList("select * from training_job_roles where id = ? for update", id).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
            if (request.version() == null || request.version() != ((Number) current.get("version")).intValue()) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_JOB_ROLE_VERSION_CHANGED");
            boolean wasActive = Boolean.TRUE.equals(current.get("is_active"));
            boolean active = request.active() == null ? wasActive : request.active();
            if (!active && wasActive && jdbc.queryForObject("select count(*) from training_person_positions where position_id = ? and valid_to is null", Integer.class, id) > 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_JOB_ROLE_IN_USE");
            if (jdbc.queryForObject("select count(*) from training_job_roles where department_id = ? and lower(name) = lower(?) and id <> ?", Integer.class, current.get("department_id"), request.name().trim(), id) > 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_JOB_ROLE_NAME_USED");
            if (!request.name().trim().equals(current.get("name"))) changes.add(new AuditTrailChangeResponse("Name", String.valueOf(current.get("name")), request.name().trim()));
            if (active != wasActive) changes.add(new AuditTrailChangeResponse("Status", wasActive ? "Active" : "Inactive", active ? "Active" : "Inactive"));
            jdbc.update("update training_job_roles set name=?, title_position_id=?, description=?, jurisdiction=?, is_active=?, version=version+1, updated_by=?, updated_at=now() where id=?", request.name().trim(), request.titlePositionId(),
                    blank(request.description()), blank(request.jurisdiction()), active, actor.getId(), id);
        }
        audit.logAs(actor, TYPE, request.name().trim(), roleId, id == null ? "TRAINING_JOB_ROLE_CREATED" : "TRAINING_JOB_ROLE_UPDATED", null, null, request.name().trim(), changes);
        return TrainingRows.camel(jdbc.queryForList(SELECT + " where r.id = ?", roleId).getFirst());
    }

    private static String blank(String text) {
        return text == null || text.isBlank() ? null : text.trim();
    }
}
