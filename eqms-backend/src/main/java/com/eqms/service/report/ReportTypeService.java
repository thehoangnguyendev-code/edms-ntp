package com.eqms.service.report;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.service.AuditTrailService;
import com.eqms.service.EffectivePermissionService;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.util.*;

/**
 * Report Types (REPORT-PLATFORM-2026-10-15): the sources of report data. Each is a {@link ReportMetadataProvider} written in code, with its own columns, filters and
 * authorization; administration sees them here and enables or disables them. A type that is disabled cannot start a template or a run. The list is searched,
 * filtered, sorted and paged here.
 */
@Service
public class ReportTypeService {
    private static final Set<String> SORTS = Set.of("name", "code", "category", "columns", "templates", "status");

    private final JdbcTemplate jdbc;
    private final EffectivePermissionService permissions;
    private final AuditTrailService audit;
    private final Map<String, ReportMetadataProvider> providers = new LinkedHashMap<>();

    public ReportTypeService(JdbcTemplate jdbc, EffectivePermissionService permissions, AuditTrailService audit, List<ReportMetadataProvider> providers) {
        this.jdbc = jdbc;
        this.permissions = permissions;
        this.audit = audit;
        for (ReportMetadataProvider provider : providers) {
            if (this.providers.put(provider.code(), provider) != null) throw new IllegalStateException("REPORT_TYPE_DUPLICATE");
        }
    }

    public boolean exists(String code) { return providers.containsKey(code); }

    /** A type that is not in the table yet is enabled: a new provider works as soon as it is deployed, and an administrator may then disable it. */
    public boolean isEnabled(String code) {
        List<Boolean> rows = jdbc.queryForList("select enabled from report_types where code=?", Boolean.class, code);
        return rows.isEmpty() || Boolean.TRUE.equals(rows.getFirst());
    }

    /** Refuses a type that is unknown or disabled; used before a template is created or changed and before a run. */
    public void requireUsable(String code) {
        if (!providers.containsKey(code)) throw new IllegalArgumentException("REPORT_SOURCE_UNKNOWN");
        if (!isEnabled(code)) throw new IllegalArgumentException("REPORT_TYPE_DISABLED");
    }

    /** Whether the person holds what the type needs; a type with no permission of its own applies the scopes of the template. */
    public boolean mayUse(UserAccount actor, String code) {
        ReportMetadataProvider provider = providers.get(code);
        if (provider == null) return false;
        Set<String> actual = permissions.getEffectivePermissionCodes(actor);
        return actual.containsAll(provider.requiredPermissions())
                && (provider.usePermissions().isEmpty() || provider.usePermissions().stream().anyMatch(actual::contains));
    }

    public Map<String, Object> list(UserAccount actor, String status, String category, String search, String sortBy, String sortDirection, int page, int limit) {
        require(actor, "reports.types.view", "reports.types.manage");
        if (!Set.of("ALL", "ENABLED", "DISABLED").contains(status)) throw new IllegalArgumentException("REPORT_FILTER_NOT_ALLOWED");
        if (!SORTS.contains(sortBy) || !Set.of("asc", "desc").contains(sortDirection)) throw new IllegalArgumentException("REPORT_SORT_NOT_ALLOWED");
        if (page < 1 || limit < 1 || limit > 100 || search == null || search.length() > 200) throw new IllegalArgumentException("REPORT_PAGE_INVALID");
        String term = search.trim().toLowerCase(Locale.ROOT);
        List<Map<String, Object>> rows = new ArrayList<>();
        for (ReportMetadataProvider provider : providers.values()) {
            Map<String, Object> row = row(provider);
            if ("ENABLED".equals(status) && !(boolean) row.get("enabled")) continue;
            if ("DISABLED".equals(status) && (boolean) row.get("enabled")) continue;
            if (!category.isBlank() && !category.equals(row.get("category"))) continue;
            if (!term.isEmpty() && !(String.valueOf(row.get("name")) + " " + row.get("code") + " " + row.get("description")).toLowerCase(Locale.ROOT).contains(term)) continue;
            rows.add(row);
        }
        Comparator<Map<String, Object>> order = switch (sortBy) {
            case "code" -> Comparator.comparing(r -> String.valueOf(r.get("code")));
            case "category" -> Comparator.comparing(r -> String.valueOf(r.get("category")));
            case "columns" -> Comparator.comparingInt(r -> ((Number) r.get("columnCount")).intValue());
            case "templates" -> Comparator.comparingLong(r -> ((Number) r.get("templateCount")).longValue());
            case "status" -> Comparator.comparing(r -> (boolean) r.get("enabled"));
            default -> Comparator.comparing(r -> String.valueOf(r.get("name")).toLowerCase(Locale.ROOT));
        };
        order = order.thenComparing(r -> String.valueOf(r.get("code")));
        rows.sort("desc".equals(sortDirection) ? order.reversed() : order);
        int total = rows.size();
        int from = Math.min((page - 1) * limit, total);
        Map<String, Object> pagination = new LinkedHashMap<>();
        pagination.put("page", page);
        pagination.put("limit", limit);
        pagination.put("total", total);
        pagination.put("totalPages", Math.max(1, (int) Math.ceil(total / (double) limit)));
        return Map.of("data", rows.subList(from, Math.min(total, from + limit)), "pagination", pagination, "categories", categories());
    }

    public Map<String, Object> detail(UserAccount actor, String code) {
        require(actor, "reports.types.view", "reports.types.manage");
        ReportMetadataProvider provider = providers.get(code);
        if (provider == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "REPORT_SOURCE_UNKNOWN");
        Map<String, Object> result = new LinkedHashMap<>(row(provider));
        Set<String> dates = new HashSet<>();
        for (Map<String, String> filter : provider.filters()) {
            String column = provider.filterColumns().get(filter.get("code"));
            if ("DATE".equals(filter.get("type")) && column != null) dates.add(column);
        }
        List<Map<String, Object>> columns = new ArrayList<>();
        for (String column : provider.columns().keySet().stream().sorted().toList()) {
            columns.add(Map.of("code", column, "label", provider.labels().getOrDefault(column, column), "required", provider.requiredFields().contains(column),
                    "type", dates.contains(column) ? "DATE" : "TEXT", "sortable", true));
        }
        result.put("columns", columns);
        result.put("filters", provider.filters().stream().map(f -> Map.of("code", f.get("code"), "label", f.getOrDefault("name", f.get("code")), "type", f.getOrDefault("type", "TEXT"))).toList());
        result.put("usePermissions", provider.usePermissions());
        result.put("requiredPermissions", provider.requiredPermissions());
        return result;
    }

    @Transactional
    public Map<String, Object> setEnabled(UserAccount actor, String code, int version, boolean enabled, String reason) {
        require(actor, "reports.types.manage");
        ReportMetadataProvider provider = providers.get(code);
        if (provider == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "REPORT_SOURCE_UNKNOWN");
        if (reason == null || reason.isBlank() || reason.length() > 1000) throw new IllegalArgumentException("REPORT_CHANGE_REASON_REQUIRED");
        jdbc.update("insert into report_types(code) values (?) on conflict (code) do nothing", code);
        Map<String, Object> current = jdbc.queryForMap("select enabled, version from report_types where code=? for update", code);
        if (((Number) current.get("version")).intValue() != version) throw new ResponseStatusException(HttpStatus.CONFLICT, "REPORT_TYPE_VERSION_CHANGED");
        if (Boolean.TRUE.equals(current.get("enabled")) == enabled) throw new ResponseStatusException(HttpStatus.CONFLICT, "REPORT_TYPE_UNCHANGED");
        jdbc.update("update report_types set enabled=?, version=version+1, updated_by=?, updated_at=now() where code=?", enabled, actor.getId(), code);
        audit.logAs(actor, "REPORT_TYPE", code, UUID.nameUUIDFromBytes(("REPORT_TYPE:" + code).getBytes(StandardCharsets.UTF_8)),
                enabled ? "REPORT_TYPE_ENABLED" : "REPORT_TYPE_DISABLED", enabled ? "DISABLED" : "ENABLED", enabled ? "ENABLED" : "DISABLED", reason.trim());
        return detail(actor, code);
    }

    private Map<String, Object> row(ReportMetadataProvider provider) {
        Map<String, Object> state = jdbc.queryForList("select enabled, version, updated_at from report_types where code=?", provider.code()).stream().findFirst().orElse(Map.of());
        Long templates = jdbc.queryForObject("select count(*) from report_definitions where source_code=? and deleted_at is null", Long.class, provider.code());
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("code", provider.code());
        row.put("name", provider.name());
        row.put("category", provider.category());
        row.put("description", provider.description());
        row.put("columnCount", provider.columns().size());
        row.put("templateCount", templates == null ? 0 : templates);
        row.put("enabled", state.get("enabled") == null || Boolean.TRUE.equals(state.get("enabled")));
        row.put("version", state.get("version") == null ? 1 : ((Number) state.get("version")).intValue());
        row.put("updatedAt", state.get("updated_at"));
        return row;
    }

    private List<String> categories() { return providers.values().stream().map(ReportMetadataProvider::category).distinct().sorted().toList(); }

    private void require(UserAccount actor, String... codes) {
        if (actor == null || actor.getId() == null || actor.getStatus() != UserStatus.Active) throw new SecurityException("REPORT_SCOPE_DENIED");
        Set<String> actual = permissions.getEffectivePermissionCodes(actor);
        if (Arrays.stream(codes).noneMatch(actual::contains)) throw new SecurityException("REPORT_SCOPE_DENIED");
    }
}
