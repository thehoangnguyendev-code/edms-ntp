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

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Name formats for report templates, maintained in Report Administration (REPORT-NAME-FORMAT-2026-10-14). A format is an ordered list of
 * fixed parts and input parts joined by a separator. A template that uses a format takes its display name from the format and the values
 * typed for its input parts. Changing a format does not rename templates that already exist.
 */
@Service
public class ReportNameFormatService {
    /** The separators an administrator may choose. */
    public static final Set<String> SEPARATORS = Set.of(" - ", " / ", " | ", " _ ");
    public static final Set<String> RULES = Set.of("TEXT", "UPPER_CODE", "DIGITS");
    private static final int MAX_PARTS = 10;
    private static final int MAX_NAME = 255;
    private static final Pattern CODE = Pattern.compile("[A-Z][A-Z0-9_]{2,79}");
    private static final Pattern TEXT = Pattern.compile("[^\\p{Cntrl}<>]+");
    private static final Pattern UPPER = Pattern.compile("[A-Z0-9_]+");
    private static final Pattern DIGITS = Pattern.compile("[0-9]+");

    private final JdbcTemplate jdbc;
    private final EffectivePermissionService permissions;
    private final AuditTrailService audit;

    public ReportNameFormatService(JdbcTemplate jdbc, EffectivePermissionService permissions, AuditTrailService audit) {
        this.jdbc = jdbc;
        this.permissions = permissions;
        this.audit = audit;
    }

    public record PartWrite(String type, String fixedText, String inputLabel, String inputRule, Integer maxLength) {}
    public record FormatWrite(String code, String name, String separator, String description, List<PartWrite> parts, String reason, Boolean active, Integer version) {}

    /**
     * Builds a display name from a format's parts (rows with part_type, fixed_text, input_label, input_rule, max_length, ordered) and the
     * values typed for the input parts. Refuses (IllegalArgumentException REPORT_NAME_INVALID) a missing or invalid input value.
     */
    public static String compose(List<Map<String, Object>> parts, String separator, Map<String, String> values) {
        if (parts == null || parts.isEmpty() || separator == null) throw new IllegalArgumentException("REPORT_NAME_INVALID");
        Map<String, String> typed = values == null ? Map.of() : values;
        List<String> pieces = new ArrayList<>();
        for (var part : parts) {
            if ("FIXED".equals(part.get("part_type"))) {
                pieces.add(String.valueOf(part.get("fixed_text")));
                continue;
            }
            String key = String.valueOf(part.get("display_order"));
            String value = typed.get(key);
            if (value == null || value.isBlank()) throw new IllegalArgumentException("REPORT_NAME_INVALID");
            value = value.trim();
            int max = part.get("max_length") == null ? 100 : ((Number) part.get("max_length")).intValue();
            if (value.length() > max || !matches(String.valueOf(part.get("input_rule")), value)) throw new IllegalArgumentException("REPORT_NAME_INVALID");
            pieces.add(value);
        }
        String name = String.join(separator, pieces);
        if (name.length() > MAX_NAME) throw new IllegalArgumentException("REPORT_NAME_INVALID");
        return name;
    }

    static boolean matches(String rule, String value) {
        return switch (rule) {
            case "UPPER_CODE" -> UPPER.matcher(value).matches();
            case "DIGITS" -> DIGITS.matcher(value).matches();
            default -> TEXT.matcher(value).matches();
        };
    }

    /** The example shown beside a format: fixed parts as written, input parts as their labels in angle brackets. */
    static String example(List<PartWrite> parts, String separator) {
        List<String> pieces = new ArrayList<>();
        for (var part : parts) pieces.add("FIXED".equals(part.type()) ? part.fixedText() : "<" + part.inputLabel() + ">");
        return String.join(separator, pieces);
    }

    /** Paged and searched on the server by name or code. Inactive rules are listed only when asked for. */
    /** status: ALL, ENABLED or DISABLED. Sorted on the server by name, code, version, status or last change. */
    public Map<String, Object> list(UserAccount actor, String status, String search, String sortBy, String sortDirection, int page, int limit) {
        return list(actor, status, search, sortBy, sortDirection, page, limit, "", "");
    }

    /** As above, and only the formats last changed between two dates (yyyy-MM-dd, both ends included) when they are given. */
    public Map<String, Object> list(UserAccount actor, String status, String search, String sortBy, String sortDirection, int page, int limit, String modifiedFrom, String modifiedTo) {
        require(actor, "reports.definition.view", "reports.definition.manage", "reports.name_format.manage");
        int safeLimit = Math.min(Math.max(limit, 1), 100); int safePage = Math.max(page, 1);
        String term = "%" + (search == null ? "" : search.trim().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")) + "%";
        String statusClause = switch (status == null ? "ALL" : status) {
            case "ENABLED" -> "and active = true ";
            case "DISABLED" -> "and active = false ";
            default -> "";
        };
        String where = "where (name ilike ? or code ilike ?) " + statusClause;
        List<Object> dateArgs = new ArrayList<>();
        if (modifiedFrom != null && !modifiedFrom.isBlank()) { where += "and updated_at >= cast(? as date) "; dateArgs.add(date(modifiedFrom)); }
        if (modifiedTo != null && !modifiedTo.isBlank()) { where += "and updated_at < cast(? as date) + interval '1 day' "; dateArgs.add(date(modifiedTo)); }
        String orderColumn = switch (sortBy == null ? "name" : sortBy) {
            case "code" -> "code";
            case "version" -> "version";
            case "status" -> "active";
            case "updatedAt" -> "updated_at";
            default -> "name";
        };
        String direction = "desc".equalsIgnoreCase(sortDirection) ? "desc" : "asc";
        List<Object> countArgs = new ArrayList<>(List.of(term, term));
        countArgs.addAll(dateArgs);
        long total = jdbc.queryForObject("select count(*) from report_name_formats " + where, Long.class, countArgs.toArray());
        List<Object> pageArgs = new ArrayList<>(countArgs);
        pageArgs.add(safeLimit);
        pageArgs.add((safePage - 1) * safeLimit);
        var rows = jdbc.queryForList("select id, code, name, separator, description, active, version, updated_at as \"updatedAt\" from report_name_formats "
                + where + "order by " + orderColumn + " " + direction + ", code limit ? offset ?", pageArgs.toArray());
        for (var row : rows) {
            var parts = partsOf((UUID) row.get("id"));
            row.put("partCount", parts.size());
            row.put("example", example(parts, String.valueOf(row.get("separator"))));
            row.put("parts", parts);
        }
        return Map.of("data", rows, "pagination", Map.of("page", safePage, "limit", safeLimit, "total", total, "totalPages", (total + safeLimit - 1) / safeLimit));
    }

    public Map<String, Object> detail(UserAccount actor, UUID id) {
        require(actor, "reports.definition.view", "reports.definition.manage", "reports.name_format.manage");
        var rows = jdbc.queryForList("select id, code, name, separator, description, active, version from report_name_formats where id=?", id);
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "REPORT_NAME_FORMAT_NOT_FOUND");
        var result = new LinkedHashMap<String, Object>(rows.getFirst());
        result.put("parts", jdbc.queryForList("select display_order as \"order\", part_type as \"type\", fixed_text as \"fixedText\", input_label as \"inputLabel\", input_rule as \"inputRule\", max_length as \"maxLength\" from report_name_format_parts where format_id=? order by display_order", id));
        return result;
    }

    @Transactional
    public Map<String, Object> create(UserAccount actor, FormatWrite request) {
        require(actor, "reports.name_format.manage");
        validate(request);
        if (!jdbc.queryForList("select 1 from report_name_formats where code=?", request.code()).isEmpty()) throw new ResponseStatusException(HttpStatus.CONFLICT, "REPORT_NAME_FORMAT_CODE_EXISTS");
        UUID id = UUID.randomUUID();
        // Only one format is active at a time: a new format is active only when no other one is, otherwise it waits until it is enabled.
        boolean noneActive = jdbc.queryForList("select 1 from report_name_formats where active=true").isEmpty();
        jdbc.update("insert into report_name_formats(id, code, name, separator, description, active) values(?,?,?,?,?,?)",
                id, request.code(), request.name().trim(), request.separator(), blankToNull(request.description()), noneActive);
        writeParts(id, request.parts());
        audit.logAs(actor, "REPORT_NAME_FORMAT", request.code(), id, "REPORT_NAME_FORMAT_CREATED", null, noneActive ? "ACTIVE" : "INACTIVE", request.reason().trim());
        return detail(actor, id);
    }

    /** Changes a format. The version must be the one the administrator read (no silent overwrite). Existing template names are not changed. */
    @Transactional
    public Map<String, Object> update(UserAccount actor, UUID id, FormatWrite request) {
        require(actor, "reports.name_format.manage");
        validate(request);
        var rows = jdbc.queryForList("select code, version from report_name_formats where id=? for update", id);
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "REPORT_NAME_FORMAT_NOT_FOUND");
        if (!Objects.equals(((Number) rows.getFirst().get("version")).intValue(), request.version())) throw new ResponseStatusException(HttpStatus.CONFLICT, "REPORT_NAME_FORMAT_VERSION_CHANGED");
        if (!request.code().equals(rows.getFirst().get("code"))) throw new IllegalArgumentException("REPORT_NAME_FORMAT_CODE_IMMUTABLE");
        jdbc.update("update report_name_formats set name=?, separator=?, description=?, version=version+1, updated_at=now() where id=?",
                request.name().trim(), request.separator(), blankToNull(request.description()), id);
        jdbc.update("delete from report_name_format_parts where format_id=?", id);
        writeParts(id, request.parts());
        audit.logAs(actor, "REPORT_NAME_FORMAT", request.code(), id, "REPORT_NAME_FORMAT_UPDATED", null, null, request.reason().trim());
        return detail(actor, id);
    }

    @Transactional
    public Map<String, Object> setActive(UserAccount actor, UUID id, int version, boolean active, String reason) {
        require(actor, "reports.name_format.manage");
        if (reason == null || reason.isBlank() || reason.length() > 1000) throw new IllegalArgumentException("REPORT_CHANGE_REASON_REQUIRED");
        var rows = jdbc.queryForList("select code, version from report_name_formats where id=? for update", id);
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "REPORT_NAME_FORMAT_NOT_FOUND");
        if (!Objects.equals(((Number) rows.getFirst().get("version")).intValue(), version)) throw new ResponseStatusException(HttpStatus.CONFLICT, "REPORT_NAME_FORMAT_VERSION_CHANGED");
        if (active) {
            // Enabling a format makes it the one that names new templates, so the format that was active is disabled in the same step and both are recorded.
            for (var other : jdbc.queryForList("select id, code from report_name_formats where active=true and id<>? for update", id)) {
                jdbc.update("update report_name_formats set active=false, version=version+1, updated_at=now() where id=?", other.get("id"));
                audit.logAs(actor, "REPORT_NAME_FORMAT", String.valueOf(other.get("code")), (UUID) other.get("id"), "REPORT_NAME_FORMAT_DISABLED", "ACTIVE", "INACTIVE",
                        "Replaced by " + rows.getFirst().get("code") + ". " + reason.trim());
            }
        }
        jdbc.update("update report_name_formats set active=?, version=version+1, updated_at=now() where id=?", active, id);
        audit.logAs(actor, "REPORT_NAME_FORMAT", String.valueOf(rows.getFirst().get("code")), id,
                active ? "REPORT_NAME_FORMAT_ENABLED" : "REPORT_NAME_FORMAT_DISABLED", null, String.valueOf(active).toUpperCase(), reason.trim());
        return detail(actor, id);
    }

    /** A date filter as yyyy-MM-dd; anything else is refused before it reaches the query. */
    private static String date(String value) {
        String trimmed = value.trim();
        if (!trimmed.matches("\\d{4}-\\d{2}-\\d{2}")) throw new IllegalArgumentException("REPORT_FILTER_NOT_ALLOWED");
        return trimmed;
    }

    private void validate(FormatWrite request) {
        if (request == null || request.code() == null || !CODE.matcher(request.code()).matches()) throw new IllegalArgumentException("REPORT_NAME_FORMAT_CODE_INVALID");
        if (request.name() == null || request.name().isBlank() || request.name().length() > 120) throw new IllegalArgumentException("REPORT_NAME_FORMAT_NAME_REQUIRED");
        if (request.separator() == null || !SEPARATORS.contains(request.separator())) throw new IllegalArgumentException("REPORT_NAME_FORMAT_SEPARATOR_INVALID");
        if (request.description() != null && request.description().length() > 500) throw new IllegalArgumentException("REPORT_DESCRIPTION_TOO_LONG");
        if (request.reason() == null || request.reason().isBlank() || request.reason().length() > 1000) throw new IllegalArgumentException("REPORT_CHANGE_REASON_REQUIRED");
        if (request.parts() == null || request.parts().isEmpty() || request.parts().size() > MAX_PARTS) throw new IllegalArgumentException("REPORT_NAME_FORMAT_PARTS_INVALID");
        boolean hasInput = false;
        for (var part : request.parts()) {
            if (part == null || part.type() == null) throw new IllegalArgumentException("REPORT_NAME_FORMAT_PARTS_INVALID");
            if ("FIXED".equals(part.type())) {
                if (part.fixedText() == null || part.fixedText().isBlank() || part.fixedText().length() > 100 || !TEXT.matcher(part.fixedText()).matches())
                    throw new IllegalArgumentException("REPORT_NAME_FORMAT_PARTS_INVALID");
            } else if ("INPUT".equals(part.type())) {
                hasInput = true;
                if (part.inputLabel() == null || part.inputLabel().isBlank() || part.inputLabel().length() > 100 || !TEXT.matcher(part.inputLabel()).matches())
                    throw new IllegalArgumentException("REPORT_NAME_FORMAT_PARTS_INVALID");
                if (part.inputRule() == null || !RULES.contains(part.inputRule())) throw new IllegalArgumentException("REPORT_NAME_FORMAT_PARTS_INVALID");
                if (part.maxLength() == null || part.maxLength() < 1 || part.maxLength() > 200) throw new IllegalArgumentException("REPORT_NAME_FORMAT_PARTS_INVALID");
            } else {
                throw new IllegalArgumentException("REPORT_NAME_FORMAT_PARTS_INVALID");
            }
        }
        if (!hasInput) throw new IllegalArgumentException("REPORT_NAME_FORMAT_NEEDS_INPUT");
    }

    private void writeParts(UUID formatId, List<PartWrite> parts) {
        int order = 1;
        for (var part : parts) {
            boolean fixed = "FIXED".equals(part.type());
            jdbc.update("insert into report_name_format_parts(id, format_id, display_order, part_type, fixed_text, input_label, input_rule, max_length) values(?,?,?,?,?,?,?,?)",
                    UUID.randomUUID(), formatId, order++, part.type(), fixed ? part.fixedText() : null,
                    fixed ? null : part.inputLabel(), fixed ? null : part.inputRule(), fixed ? null : part.maxLength());
        }
    }

    private List<PartWrite> partsOf(UUID formatId) {
        return jdbc.query("select part_type, fixed_text, input_label, input_rule, max_length from report_name_format_parts where format_id=? order by display_order",
                (rs, n) -> new PartWrite(rs.getString("part_type"), rs.getString("fixed_text"), rs.getString("input_label"), rs.getString("input_rule"),
                        rs.getObject("max_length") == null ? null : rs.getInt("max_length")), formatId);
    }

    private void require(UserAccount actor, String... codes) {
        if (actor == null || actor.getId() == null || actor.getStatus() != UserStatus.Active) throw new SecurityException("REPORT_SCOPE_DENIED");
        Set<String> actual = permissions.getEffectivePermissionCodes(actor);
        if (Arrays.stream(codes).noneMatch(actual::contains)) throw new SecurityException("REPORT_SCOPE_DENIED");
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
