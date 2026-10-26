package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Who is trained on what the effective matrix of the department requires (SDS-TR-001 section 12). Everything is computed here, from the matrix, the
 * position of each person and the training records that are not voided; the screen only shows it. A requirement is met by a record of the same document
 * (SOP row) or of a topic with the same name; an annual requirement is due again one year after the last record.
 */
@Service
public class TrainingComplianceService {
    private final JdbcTemplate jdbc;
    private final TrainingAccess access;

    public TrainingComplianceService(JdbcTemplate jdbc, TrainingAccess access) {
        this.jdbc = jdbc;
        this.access = access;
    }

    private static final String BASE = """
        with ev as (select v.id from training_matrix_versions v join training_matrices mx on mx.id = v.matrix_id where mx.department_id = ? and v.status = 'EFFECTIVE'),
        req as (
          select r.id as row_id, r.annual_required, coalesce(t.name, d.document_name) as title, coalesce(t.code, d.document_number) as code, t.name as tname,
                 d.document_number as dnum, c.position_id
            from ev join training_matrix_rows r on r.version_id = ev.id join training_matrix_cells c on c.row_id = r.id
            left join training_topics t on t.id = r.topic_id left join documents d on d.id = r.document_id),
        people as (
          select tp.person_user_id as pid, u.full_name, u.employee_code, tp.position_id, p.name as position_name
            from training_person_positions tp join app_users u on u.id = tp.person_user_id join training_job_roles p on p.id = tp.position_id
           where tp.valid_to is null and u.status = 'Active'),
        gaps as (
          select distinct on (pe.pid, req.row_id) pe.pid, pe.full_name, pe.employee_code, pe.position_name, req.title, req.code, req.annual_required,
                 (select max(r.completed_on) from training_records r left join training_record_voids v on v.record_id = r.id
                   where r.person_user_id = pe.pid and v.id is null
                     and ((req.dnum is not null and r.document_number = req.dnum) or (req.tname is not null and lower(r.topic_text) = lower(req.tname)))) as last_done
            from people pe join req on req.position_id = pe.position_id
           order by pe.pid, req.row_id, pe.position_name)
        select *, case when last_done is null then 'MISSING'
                       when annual_required and last_done < current_date - interval '1 year' then 'DUE'
                       else 'OK' end as status
          from gaps
        """;

    private UUID department(UserAccount actor, UUID departmentId) {
        access.require(actor, "training.compliance.view");
        UUID department = departmentId != null ? departmentId : access.departmentOf(actor);
        if (department == null) throw new IllegalArgumentException("TRAINING_DEPARTMENT_REQUIRED");
        access.requireScope(actor, department);
        return department;
    }

    /**
     * The training the effective matrix of the department asks for the position of one person, and where the person stands: MISSING (never done), DUE (annual and older than a year) or
     * OK. The caller has already checked who may see the person. A person with no position for training, or a department with no effective matrix, has no rows.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> gapsOfPerson(UUID personId, UUID departmentId) {
        List<Map<String, Object>> rows = departmentId == null ? List.of()
                : jdbc.queryForList("select x.* from (" + BASE + ") x where x.pid = ? order by case x.status when 'MISSING' then 0 when 'DUE' then 1 else 2 end, x.title", departmentId, personId);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("positionName", rows.isEmpty() ? null : rows.getFirst().get("position_name"));
        out.put("required", rows.size());
        out.put("missing", rows.stream().filter((r) -> "MISSING".equals(r.get("status"))).count());
        out.put("due", rows.stream().filter((r) -> "DUE".equals(r.get("status"))).count());
        out.put("done", rows.stream().filter((r) -> "OK".equals(r.get("status"))).count());
        out.put("gaps", TrainingRows.camel(rows));
        return out;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> coverage(UserAccount actor, UUID departmentId, String status, String search, String sortBy, String sortDirection, int page, int limit) {
        UUID department = department(actor, departmentId);
        List<Object> args = new ArrayList<>();
        args.add(department);
        StringBuilder where = new StringBuilder(" where 1=1");
        if (status != null && !status.isBlank()) {
            if (!List.of("MISSING", "DUE", "OK").contains(status)) throw new IllegalArgumentException("TRAINING_STATUS_INVALID");
            where.append(" and x.status = ?");
            args.add(status);
        }
        if (search != null && !search.isBlank()) {
            String like = "%" + search.trim().toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
            where.append(" and (lower(x.full_name) like ? escape '\\' or lower(coalesce(x.employee_code,'')) like ? escape '\\' or lower(x.title) like ? escape '\\' or lower(coalesce(x.position_name,'')) like ? escape '\\' or lower(coalesce(x.code,'')) like ? escape '\\')");
            args.add(like); args.add(like); args.add(like); args.add(like); args.add(like);
        }
        int safeLimit = Math.min(Math.max(limit, 1), 100), safePage = Math.max(page, 1);
        Long total = jdbc.queryForObject("select count(*) from (" + BASE + ") x" + where, Long.class, args.toArray());
        args.add(safeLimit);
        args.add((safePage - 1) * safeLimit);
        List<Map<String, Object>> rows = jdbc.queryForList("select x.*, au.avatar from (" + BASE + ") x left join app_users au on au.id = x.pid" + where
                + TrainingRows.orderBy(sortBy, sortDirection, Map.of("fullName", "x.full_name", "employeeCode", "x.employee_code", "positionName", "x.position_name", "title", "x.title", "annualRequired", "x.annual_required", "lastDone", "x.last_done", "status", "case x.status when 'MISSING' then 0 when 'DUE' then 1 else 2 end"),
                "case x.status when 'MISSING' then 0 when 'DUE' then 1 else 2 end, x.full_name, x.title") + " limit ? offset ?", args.toArray());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("data", TrainingRows.camel(rows));
        long count = total == null ? 0 : total;
        result.put("pagination", Map.of("page", safePage, "limit", safeLimit, "total", count, "totalPages", Math.max(1, (count + safeLimit - 1) / safeLimit)));
        return result;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> summary(UserAccount actor, UUID departmentId) {
        UUID department = department(actor, departmentId);
        Map<String, Object> row = jdbc.queryForMap("select count(*) as required, count(*) filter (where x.status = 'OK') as ok, count(*) filter (where x.status = 'MISSING') as missing, "
                + "count(*) filter (where x.status = 'DUE') as due, count(distinct x.pid) as people from (" + BASE + ") x", department);
        Map<String, Object> out = new LinkedHashMap<>(TrainingRows.camel(row));
        long required = ((Number) row.get("required")).longValue();
        out.put("percentTrained", required == 0 ? null : Math.round(((Number) row.get("ok")).doubleValue() * 1000 / required) / 10.0);
        out.put("hasEffectiveMatrix", jdbc.queryForObject("select count(*) from training_matrix_versions v join training_matrices m on m.id = v.matrix_id where m.department_id = ? and v.status = 'EFFECTIVE'", Integer.class, department) > 0);
        out.put("peopleWithoutPosition", jdbc.queryForObject("select count(*) from app_users u where u.status = 'Active' and lower(trim(u.department)) = lower(trim((select name from departments where id = ?))) and not exists (select 1 from training_person_positions tp where tp.person_user_id = u.id and tp.valid_to is null)", Integer.class, department));
        out.put("openReviews", jdbc.queryForObject("select count(*) from training_personnel_reviews r join app_users u on u.id = r.person_user_id where r.status = 'OPEN' and lower(trim(u.department)) = lower(trim((select name from departments where id = ?)))", Integer.class, department));
        out.put("overdueActivities", jdbc.queryForObject("select count(*) from training_activities where organizer_department_id = ? and due_date < current_date and status in ('PLANNED','NOTIFIED','IN_PROGRESS','PENDING_QA_CONFIRMATION')", Integer.class, department));
        out.put("dueSoonActivities", jdbc.queryForObject("select count(*) from training_activities where organizer_department_id = ? and due_date between current_date and current_date + 14 and status in ('PLANNED','NOTIFIED','IN_PROGRESS','PENDING_QA_CONFIRMATION')", Integer.class, department));
        return out;
    }
}
