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
 * The list of signature meanings of the E-Sign Config screen, searched, filtered, sorted and paged here. Reading only: a meaning is renamed through the settings, with a signature.
 * The module of a meaning is the first word of its code (BACKUP, TRAINING, AUDIT ...).
 */
@Service
public class ElectronicSignatureMeaningQueryService {
    private static final Map<String, String> SORTS = Map.of("code", "m.code", "displayName", "m.display_name", "updatedAt", "m.updated_at", "module", "split_part(m.code, '_', 1)");

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
            where.append(" and (lower(m.code) like ? escape '\\' or lower(m.display_name) like ? escape '\\')");
            args.add(like);
            args.add(like);
        }
        if (module != null && !module.isBlank()) {
            where.append(" and split_part(m.code, '_', 1) = ?");
            args.add(module.trim().toUpperCase(Locale.ROOT));
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
        for (Map<String, Object> row : jdbc.queryForList("select m.id, m.code, m.display_name, m.updated_at, split_part(m.code, '_', 1) as module from electronic_signature_meanings m" + where + order + " limit ? offset ?", args.toArray())) {
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("id", row.get("id") instanceof UUID id ? id.toString() : String.valueOf(row.get("id")));
            out.put("code", row.get("code"));
            out.put("displayName", row.get("display_name"));
            out.put("module", row.get("module"));
            out.put("updatedAt", row.get("updated_at") instanceof java.sql.Timestamp t ? t.toInstant().toString() : null);
            rows.add(out);
        }
        long count = total == null ? 0 : total;
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("data", rows);
        result.put("pagination", Map.of("page", safePage, "limit", safeLimit, "total", count, "totalPages", Math.max(1, (count + safeLimit - 1) / safeLimit)));
        result.put("modules", jdbc.queryForList("select distinct split_part(code, '_', 1) from electronic_signature_meanings order by 1", String.class));
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
