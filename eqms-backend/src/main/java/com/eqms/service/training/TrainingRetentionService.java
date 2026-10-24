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
 * How long the personal training records of people who have left must be kept (SOP.0003 5.3.10: ten years after leaving; the number of years is a setting). The list shows, for every
 * person who has left and has training records, the day they left, the day the retention ends and whether it has ended. It only marks: nothing is deleted or changed, and the
 * disposal of records after the retention is a separate procedure with its own approval that is not part of this software (D-17).
 */
@Service
public class TrainingRetentionService {
    private final JdbcTemplate jdbc;
    private final TrainingAccess access;

    public TrainingRetentionService(JdbcTemplate jdbc, TrainingAccess access) {
        this.jdbc = jdbc;
        this.access = access;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> list(UserAccount actor, UUID departmentId, String state, String search, String sortBy, String sortDirection, int page, int limit) {
        access.require(actor, "training.record.view");
        UUID department = departmentId != null ? departmentId : access.departmentOf(actor);
        if (department == null) throw new IllegalArgumentException("TRAINING_DEPARTMENT_REQUIRED");
        access.requireScope(actor, department);
        List<Object> args = new ArrayList<>();
        args.add(department);
        StringBuilder where = new StringBuilder(" where 1=1");
        if (state != null && !state.isBlank()) {
            if (!List.of("RETAINED", "ENDED").contains(state)) throw new IllegalArgumentException("TRAINING_STATUS_INVALID");
            where.append("RETAINED".equals(state) ? " and x.retained_until >= current_date" : " and x.retained_until < current_date");
        }
        if (search != null && !search.isBlank()) {
            String like = "%" + search.trim().toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
            where.append(" and (lower(x.full_name) like ? escape '\\' or lower(coalesce(x.employee_code,'')) like ? escape '\\' or lower(coalesce(x.position,'')) like ? escape '\\')");
            for (int i = 0; i < 3; i++) args.add(like);
        }
        String base = """
            select u.id, u.full_name, u.employee_code, u.avatar, u.position, u.termination_date,
                   (u.termination_date + make_interval(years => (select retention_years_after_leaving from training_settings where id = 1)))::date as retained_until,
                   (select count(*) from training_records r where r.person_user_id = u.id) as records
              from app_users u join departments d on lower(trim(d.name)) = lower(trim(u.department)) and d.id = ?
             where u.termination_date is not null and exists (select 1 from training_records r where r.person_user_id = u.id)
            """;
        int safeLimit = Math.min(Math.max(limit, 1), 100), safePage = Math.max(page, 1);
        Long total = jdbc.queryForObject("select count(*) from (" + base + ") x" + where, Long.class, args.toArray());
        args.add(safeLimit);
        args.add((safePage - 1) * safeLimit);
        List<Map<String, Object>> rows = jdbc.queryForList("select x.*, (x.retained_until < current_date) as ended from (" + base + ") x" + where
                + TrainingRows.orderBy(sortBy, sortDirection, Map.of("fullName", "x.full_name", "employeeCode", "x.employee_code", "position", "x.position", "terminationDate", "x.termination_date",
                        "retainedUntil", "x.retained_until", "records", "x.records"), "x.retained_until") + " limit ? offset ?", args.toArray());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("data", TrainingRows.camel(rows));
        long count = total == null ? 0 : total;
        result.put("pagination", Map.of("page", safePage, "limit", safeLimit, "total", count, "totalPages", Math.max(1, (count + safeLimit - 1) / safeLimit)));
        result.put("retentionYears", jdbc.queryForObject("select retention_years_after_leaving from training_settings where id = 1", Integer.class));
        return result;
    }
}
