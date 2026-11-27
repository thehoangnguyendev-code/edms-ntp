package com.eqms.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * The list of signing actions of the E-Sign Config screen (the action is fixed, the meaning is what an administrator can change), searched, filtered, sorted and paged here. Reading only: a meaning is renamed through the settings, with a signature.
 * The module of a meaning is the first word of its code (BACKUP, TRAINING, AUDIT ...).
 */
@Service
public class ElectronicSignatureMeaningQueryService {
    private static final Map<String, String> SORTS = Map.of("code", "m.code", "displayName", "m.display_name", "actionName", "coalesce(m.action_name, m.display_name)", "updatedAt", "m.updated_at", "module", "split_part(m.code, '_', 1)");

    /**
     * The level-1 menu whose action a meaning signs, from the code of the meaning. The meanings with no prefix (Prepared, Reviewed, Approved...) are those
     * of the document revisions. A new family of codes is added here; until then it is shown as "Other" rather than guessed.
     */
    private static final String MODULE_SQL = "(case"
            + " when m.code like 'TRAINING\\_%' then 'Training Management'"
            + " when m.code like 'REPORT\\_%' then 'Reports'"
            + " when m.code like 'AUDIT\\_%' then 'Audit Trail'"
            + " when m.code like 'BACKUP\\_%' then 'Backup & Restore'"
            + " when m.code ~ '^(ACCESS_PROFILE|PERMISSION_SET|SOD|TIME_LIMITED|USER|WORKFLOW_AUTHORIZATION)_' then 'Security & Authorization'"
            + " when m.code ~ '^(EMAIL_TEMPLATE|NOTIFICATION|SECURITY_CONFIGURATION)_' then 'System Administration'"
            + " when m.code ~ '^((DOCUMENT|CONTROLLED_COPY|UNCONTROLLED_COPY|LEGACY_DOCUMENT)_|(PREPARED|REVIEWED|APPROVED|REJECTED|CANCELLED|PUBLISHED|OBSOLETED|SUBMITTED_FOR_REVIEW|RECORD_LOGGED)$)' then 'Document Control'"
            + " else 'Other' end)";

    private final JdbcTemplate jdbc;

    public ElectronicSignatureMeaningQueryService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> page(String search, String module, String updatedFrom, String updatedTo, String sortBy, String sortDirection, int page, int limit) {
        List<Object> args = new ArrayList<>();
        StringBuilder where = new StringBuilder(" where 1=1");
        if (search != null && !search.isBlank()) {
            String like = "%" + search.trim().toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
            where.append(" and (eqms_fold(m.code) like eqms_fold(?) escape '\\' or eqms_fold(m.display_name) like eqms_fold(?) escape '\\' or eqms_fold(coalesce(m.action_name, m.display_name)) like eqms_fold(?) escape '\\')");
            args.add(like);
            args.add(like);
            args.add(like);
        }
        if (module != null && !module.isBlank()) {
            where.append(" and ").append(MODULE_SQL).append(" = ?");
            args.add(module.trim());
        }
        LocalDate from = date(updatedFrom), to = date(updatedTo);
        if (from != null) {
            where.append(" and m.updated_at >= ?");
            args.add(Timestamp.from(from.atStartOfDay(com.eqms.util.DateTimeFormatUtils.ZONE).toInstant()));
        }
        if (to != null) {
            where.append(" and m.updated_at < ?");
            args.add(Timestamp.from(to.plusDays(1).atStartOfDay(com.eqms.util.DateTimeFormatUtils.ZONE).toInstant()));
        }
        Long total = jdbc.queryForObject("select count(*) from electronic_signature_meanings m" + where, Long.class, args.toArray());
        int safeLimit = Math.min(Math.max(limit, 1), 100), safePage = Math.max(page, 1);
        args.add(safeLimit);
        args.add((safePage - 1) * safeLimit);
        String column = sortBy == null ? null : SORTS.get(sortBy);
        String order = column == null ? " order by m.code" : " order by " + column + " " + ("desc".equalsIgnoreCase(sortDirection) ? "desc" : "asc") + ", m.code";
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Map<String, Object> row : jdbc.queryForList("select m.id, m.code, m.display_name, coalesce(m.action_name, m.display_name) as action_name, m.updated_at, " + MODULE_SQL + " as module from electronic_signature_meanings m" + where + order + " limit ? offset ?", args.toArray())) {
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("id", row.get("id") instanceof UUID id ? id.toString() : String.valueOf(row.get("id")));
            out.put("code", row.get("code"));
            out.put("actionName", row.get("action_name"));
            out.put("displayName", row.get("display_name"));
            out.put("module", row.get("module"));
            out.put("updatedAt", row.get("updated_at") instanceof java.sql.Timestamp t ? t.toInstant().toString() : null);
            rows.add(out);
        }
        long count = total == null ? 0 : total;
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("data", rows);
        result.put("pagination", Map.of("page", safePage, "limit", safeLimit, "total", count, "totalPages", Math.max(1, (count + safeLimit - 1) / safeLimit)));
        result.put("modules", jdbc.queryForList("select distinct " + MODULE_SQL + " from electronic_signature_meanings m order by 1", String.class));
        return result;
    }

    private static LocalDate date(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return LocalDate.parse(value.trim());
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("DATE_INVALID");
        }
    }
}
