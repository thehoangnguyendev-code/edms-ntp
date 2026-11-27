package com.eqms.service.report;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.service.AuditTrailService;
import com.eqms.service.EffectivePermissionService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

/**
 * The appearances of the reports (REPORT-APPEARANCE-LIST-2026-11-15): any number of them, exactly one Active. The Active one is what every new report is drawn with; activating
 * another makes the present one Inactive in the same transaction, and the database refuses a second Active row on its own. To see them takes reports.appearance.view or .manage,
 * to change them reports.appearance.manage. Every change, activation and deletion has an entry in the Audit Trail. A report that was already made keeps the look it was made with.
 */
@Service
public class ReportAppearanceService {
    private static final int NAME_MAX = 120;
    private final JdbcTemplate jdbc;
    private final EffectivePermissionService permissions;
    private final AuditTrailService audit;
    private final ObjectMapper json = new ObjectMapper();
    private ReportWordService words;

    public ReportAppearanceService(JdbcTemplate jdbc, EffectivePermissionService permissions, AuditTrailService audit) {
        this.jdbc = jdbc;
        this.permissions = permissions;
        this.audit = audit;
    }

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    public void configureWords(ReportWordService words) { this.words = words; }

    /** A new appearance: its name, and its layout (as it was set on the screen), or else a copy of another appearance, or else the standard layout. */
    public record Create(String name, UUID copyFromId, ReportLayout appearance) {
        public Create(String name, UUID copyFromId) { this(name, copyFromId, null); }
    }

    /** What the list can be narrowed by; every value is checked against a fixed list. Dates are instants (ISO-8601). */
    public record Filters(String search, String status, String orientation, String font, String cover, String logo, String changedFrom, String changedTo, String activatedFrom, String activatedTo) {
        public Filters(String search, String status) { this(search, status, null, null, null, null, null, null, null, null); }
    }
    public record Update(Integer version, String name, ReportLayout appearance) {}

    // ---- reading -----------------------------------------------------------------------------------------------------------------------------

    /** One page of the appearances: search by name, filters, sort and paging (10 to 100 rows), all on the server. */
    public Map<String, Object> list(UserAccount actor, Filters filters, String sort, String direction, int page, int limit) {
        requireView(actor);
        var where = new StringBuilder(" where eqms_fold(a.name) like eqms_fold(?) escape '\\'");
        List<Object> args = new ArrayList<>();
        String text = filters.search() == null ? "" : filters.search().trim().toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
        args.add("%" + text + "%");
        if (filters.status() != null && !filters.status().isBlank()) {
            if (!Set.of("ACTIVE", "INACTIVE").contains(filters.status())) throw new IllegalArgumentException("REPORT_APPEARANCE_FILTER_INVALID");
            where.append(" and a.status=?"); args.add(filters.status());
        }
        if (filters.orientation() != null && !filters.orientation().isBlank()) {
            if (!Set.of("PORTRAIT", "LANDSCAPE").contains(filters.orientation())) throw new IllegalArgumentException("REPORT_APPEARANCE_FILTER_INVALID");
            where.append(" and coalesce(a.appearance->>'orientation','LANDSCAPE')=?"); args.add(filters.orientation());
        }
        if (filters.font() != null && !filters.font().isBlank()) {
            if (!ReportFonts.KEYS.contains(filters.font())) throw new IllegalArgumentException("REPORT_APPEARANCE_FILTER_INVALID");
            where.append(" and coalesce(a.appearance->>'fontFamily','NOTO_SANS')=?"); args.add(filters.font());
        }
        onOff(where, args, filters.cover(), "coalesce((a.appearance->>'cover')::boolean,false)");
        onOff(where, args, filters.logo(), "coalesce((a.appearance->'logo'->>'enabled')::boolean,false)");
        range(where, args, filters.changedFrom(), filters.changedTo(), "a.updated_at");
        range(where, args, filters.activatedFrom(), filters.activatedTo(), "a.activated_at");
        String column = switch (sort == null ? "" : sort) {
            case "name" -> "lower(a.name)";
            case "status" -> "a.status";
            case "updatedAt" -> "a.updated_at";
            case "activatedAt" -> "a.activated_at";
            default -> null;
        };
        String order = column == null ? "case when a.status='ACTIVE' then 0 else 1 end, lower(a.name)" : column + ("desc".equalsIgnoreCase(direction) ? " desc nulls last" : " asc nulls last") + ", lower(a.name)";
        int size = Math.min(Math.max(limit, 1), 100);
        long total = Optional.ofNullable(jdbc.queryForObject("select count(*) from report_appearances a" + where, Long.class, args.toArray())).orElse(0L);
        int pages = Math.max(1, (int) Math.ceil(total / (double) size));
        int current = Math.min(Math.max(page, 1), pages);
        args.add(size);
        args.add((current - 1) * size);
        List<Map<String, Object>> rows = jdbc.queryForList("""
                select a.id, a.name, a.status, a.version, a.created_at as "createdAt", a.updated_at as "updatedAt", u.full_name as "updatedByName", a.activated_at as "activatedAt",
                       coalesce(a.appearance->>'orientation','LANDSCAPE') as "orientation", coalesce(a.appearance->>'fontFamily','NOTO_SANS') as "fontFamily",
                       coalesce((a.appearance->>'cover')::boolean,false) as "cover", coalesce((a.appearance->'logo'->>'enabled')::boolean,false) as "logo"
                from report_appearances a left join app_users u on u.id = a.updated_by""" + where + " order by " + order + " limit ? offset ?", args.toArray());
        var result = new LinkedHashMap<String, Object>();
        result.put("data", rows);
        result.put("pagination", Map.of("page", current, "limit", size, "total", total, "totalPages", pages));
        return result;
    }

    private static void onOff(StringBuilder where, List<Object> args, String value, String expression) {
        if (value == null || value.isBlank()) return;
        if (!Set.of("ON", "OFF").contains(value)) throw new IllegalArgumentException("REPORT_APPEARANCE_FILTER_INVALID");
        where.append(" and ").append(expression).append("=?");
        args.add("ON".equals(value));
    }

    private static void range(StringBuilder where, List<Object> args, String from, String to, String column) {
        try {
            if (from != null && !from.isBlank()) { where.append(" and ").append(column).append(">=?"); args.add(java.sql.Timestamp.from(java.time.Instant.parse(from))); }
            if (to != null && !to.isBlank()) { where.append(" and ").append(column).append("<=?"); args.add(java.sql.Timestamp.from(java.time.Instant.parse(to))); }
        } catch (java.time.format.DateTimeParseException invalid) {
            throw new IllegalArgumentException("REPORT_APPEARANCE_FILTER_INVALID");
        }
    }

    public Map<String, Object> get(UserAccount actor, UUID id) {
        requireView(actor);
        return detail(id);
    }

    /** The Active appearance: what every new report is drawn with. The built-in default when there is none (a database that has not been migrated). Its charts are always empty. */
    public ReportLayout active() {
        List<String> rows = jdbc.queryForList("select appearance::text from report_appearances where status='ACTIVE'", String.class);
        if (rows.isEmpty() || rows.getFirst() == null) return ReportLayout.defaults().withCharts(List.of());
        return read(rows.getFirst());
    }

    /** A PDF of every page of the appearance, drawn with made-up values and rows. Taking a look is allowed to everyone who can see the list. */
    public byte[] preview(UserAccount actor, UUID id) throws Exception {
        requireView(actor);
        var row = detail(id);
        return ReportLayoutPreview.render(actor, String.valueOf(row.get("name")), (ReportLayout) row.get("appearance"), words);
    }

    // ---- changing ----------------------------------------------------------------------------------------------------------------------------

    /** A new appearance, Inactive: the standard one, or a copy of an existing one. */
    @Transactional
    public Map<String, Object> create(UserAccount actor, Create request) {
        requireManage(actor);
        if (request == null) throw new IllegalArgumentException("REPORT_APPEARANCE_INVALID");
        String name = cleanName(request.name());
        ReportLayout layout = ReportLayout.defaults().withCharts(List.of());
        if (request.appearance() != null) {
            layout = request.appearance().withCharts(List.of()).validated();
            if (!layout.effectiveWordComponents().isEmpty()) {
                if (words == null) throw new IllegalStateException("REPORT_WORD_RENDERER_UNAVAILABLE");
                words.validate(layout);
            }
        } else if (request.copyFromId() != null) layout = read(requireRow(request.copyFromId()).get("appearance").toString());
        UUID id = UUID.randomUUID();
        try {
            jdbc.update("insert into report_appearances(id,name,status,appearance,created_by,updated_by) values(?,?,'INACTIVE',cast(? as jsonb),?,?)", id, name, write(layout), actor.getId(), actor.getId());
        } catch (DuplicateKeyException taken) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "REPORT_APPEARANCE_NAME_TAKEN");
        }
        com.eqms.service.EntityChangeBroadcaster.changed("REPORT_APPEARANCE", id, null);
        audit.logAs(actor, "REPORT_APPEARANCE", name, id, "REPORT_APPEARANCE_CREATED", null, "INACTIVE", request.copyFromId() == null ? "Appearance created" : "Appearance created as a copy of another",
                java.util.List.of(com.eqms.util.AuditChanges.of("Name",null,name), com.eqms.util.AuditChanges.of("Copied From Another Appearance",null,request.copyFromId() == null ? "No" : "Yes")));
        return detail(id);
    }

    @Transactional
    public Map<String, Object> update(UserAccount actor, UUID id, Update request) {
        requireManage(actor);
        if (request == null || request.appearance() == null || request.version() == null) throw new IllegalArgumentException("REPORT_APPEARANCE_INVALID");
        var current = jdbc.queryForMap("select name, status, appearance::text as appearance, version from report_appearances where id=? for update", rowId(id));
        if (!Objects.equals(((Number) current.get("version")).intValue(), request.version())) throw new ResponseStatusException(HttpStatus.CONFLICT, "REPORT_PROPERTIES_VERSION_CHANGED");
        String name = request.name() == null ? String.valueOf(current.get("name")) : cleanName(request.name());
        ReportLayout before = read(String.valueOf(current.get("appearance")));
        ReportLayout after = request.appearance().withCharts(List.of()).validated();
        if (!after.effectiveWordComponents().isEmpty()) {
            if (words == null) throw new IllegalStateException("REPORT_WORD_RENDERER_UNAVAILABLE");
            words.validate(after);
        }
        boolean renamed = !name.equals(String.valueOf(current.get("name")));
        if (after.equals(before) && !renamed) throw new ResponseStatusException(HttpStatus.CONFLICT, "REPORT_PROPERTIES_UNCHANGED");
        try {
            jdbc.update("update report_appearances set name=?, appearance=cast(? as jsonb), version=version+1, updated_by=?, updated_at=now() where id=?", name, write(after), actor.getId(), id);
        } catch (DuplicateKeyException taken) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "REPORT_APPEARANCE_NAME_TAKEN");
        }
        List<String> parts = new ArrayList<>(describe(before, after));
        if (renamed) parts.add("name");
        com.eqms.service.EntityChangeBroadcaster.changed("REPORT_APPEARANCE", id, null);
        audit.logAs(actor, "REPORT_APPEARANCE", name, id, "REPORT_APPEARANCE_UPDATED", null, null, "Report appearance: " + String.join(", ", parts) + " changed",
                java.util.List.of(com.eqms.util.AuditChanges.of("Changed",null,String.join(", ", parts))));
        return detail(id);
    }

    /** Makes this appearance the Active one and the present one Inactive, in one transaction. */
    @Transactional
    public Map<String, Object> activate(UserAccount actor, UUID id) {
        requireManage(actor);
        List<Map<String, Object>> locked = jdbc.queryForList("select id, name, status from report_appearances order by id for update");
        var target = locked.stream().filter(row -> id.equals(row.get("id"))).findFirst().orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "REPORT_APPEARANCE_NOT_FOUND"));
        if ("ACTIVE".equals(target.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "REPORT_APPEARANCE_ALREADY_ACTIVE");
        for (var row : locked) {
            if (!"ACTIVE".equals(row.get("status"))) continue;
            jdbc.update("update report_appearances set status='INACTIVE', updated_at=now(), updated_by=? where id=?", actor.getId(), row.get("id"));
            audit.logAs(actor, "REPORT_APPEARANCE", String.valueOf(row.get("name")), (UUID) row.get("id"), "REPORT_APPEARANCE_DEACTIVATED", "ACTIVE", "INACTIVE", "Another appearance was activated");
        }
        jdbc.update("update report_appearances set status='ACTIVE', activated_at=now(), activated_by=?, updated_at=now(), updated_by=? where id=?", actor.getId(), actor.getId(), id);
        com.eqms.service.EntityChangeBroadcaster.changed("REPORT_APPEARANCE", id, null);
        audit.logAs(actor, "REPORT_APPEARANCE", String.valueOf(target.get("name")), id, "REPORT_APPEARANCE_ACTIVATED", "INACTIVE", "ACTIVE", "New reports are drawn with this appearance from now on");
        return detail(id);
    }

    /** An appearance that is not Active can be deleted; the Active one cannot, because reports are drawn with it. */
    @Transactional
    public void delete(UserAccount actor, UUID id) {
        requireManage(actor);
        var row = jdbc.queryForList("select name, status from report_appearances where id=? for update", id).stream().findFirst().orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "REPORT_APPEARANCE_NOT_FOUND"));
        if ("ACTIVE".equals(row.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "REPORT_APPEARANCE_ACTIVE_CANNOT_BE_DELETED");
        jdbc.update("delete from report_appearances where id=?", id);
        com.eqms.service.EntityChangeBroadcaster.changed("REPORT_APPEARANCE", id, null);
        audit.logAs(actor, "REPORT_APPEARANCE", String.valueOf(row.get("name")), id, "REPORT_APPEARANCE_DELETED", "INACTIVE", null, "Appearance deleted");
    }

    // ---- helpers -----------------------------------------------------------------------------------------------------------------------------

    private Map<String, Object> requireRow(UUID id) {
        return jdbc.queryForList("select id, name, status, appearance::text as appearance, version from report_appearances where id=?", id).stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "REPORT_APPEARANCE_NOT_FOUND"));
    }

    private UUID rowId(UUID id) {
        requireRow(id);
        return id;
    }

    private Map<String, Object> detail(UUID id) {
        var row = jdbc.queryForList("""
                select a.id, a.name, a.status, a.appearance::text as appearance, a.version, a.created_at as "createdAt", a.updated_at as "updatedAt", u.full_name as "updatedByName", a.activated_at as "activatedAt"
                from report_appearances a left join app_users u on u.id = a.updated_by where a.id=?""", id).stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "REPORT_APPEARANCE_NOT_FOUND"));
        var result = new LinkedHashMap<String, Object>(row);
        result.put("appearance", read(String.valueOf(row.get("appearance"))));
        return result;
    }

    private ReportLayout read(String text) {
        try {
            return json.readValue(text, ReportLayout.class).withCharts(List.of());
        } catch (JsonProcessingException unreadable) {
            throw new IllegalStateException("REPORT_APPEARANCE_UNREADABLE", unreadable);
        }
    }

    private String write(ReportLayout layout) {
        try {
            return json.writeValueAsString(layout);
        } catch (JsonProcessingException invalid) {
            throw new IllegalArgumentException("REPORT_LAYOUT_INVALID");
        }
    }

    /** A name is one line of letters, digits and punctuation, up to 120 characters, never empty. */
    static String cleanName(String raw) {
        if (raw != null && raw.codePoints().anyMatch(Character::isISOControl)) throw new IllegalArgumentException("REPORT_APPEARANCE_NAME_INVALID");
        String name = raw == null ? "" : raw.trim().replaceAll("\\s+", " ");
        if (name.isEmpty() || name.length() > NAME_MAX) throw new IllegalArgumentException("REPORT_APPEARANCE_NAME_INVALID");
        return name;
    }

    /** Which parts of the appearance changed, by name; never the contents (a logo is a picture). */
    static List<String> describe(ReportLayout before, ReportLayout after) {
        List<String> parts = new ArrayList<>();
        if (before.cover() != after.cover() || !Objects.equals(before.coverTitle(), after.coverTitle()) || !Objects.equals(before.subtitle(), after.subtitle())
                || before.showExecutor() != after.showExecutor() || before.showGeneratedAt() != after.showGeneratedAt() || !Objects.equals(before.coverTitleStyle(), after.coverTitleStyle())
                || !Objects.equals(before.coverSubtitleStyle(), after.coverSubtitleStyle())) parts.add("cover");
        if (!Objects.equals(before.header(), after.header())) parts.add("header");
        if (!Objects.equals(before.footer(), after.footer()) || before.pageNumbers() != after.pageNumbers()) parts.add("footer and page numbers");
        if (!Objects.equals(before.effectiveFont(), after.effectiveFont())) parts.add("font");
        if (!Objects.equals(before.effectiveOrientation(), after.effectiveOrientation())) parts.add("paper layout");
        if (before.stampEnabled() != after.stampEnabled() || !Objects.equals(before.stamp(), after.stamp()) || !Objects.equals(before.effectiveStamp(), after.effectiveStamp())) parts.add("stamp");
        if (before.watermarkEnabled() != after.watermarkEnabled() || !Objects.equals(before.watermark(), after.watermark()) || !Objects.equals(before.effectiveWatermark(), after.effectiveWatermark())) parts.add("watermark");
        if (!Objects.equals(before.logo(), after.logo())) parts.add("logo");
        if (!Objects.equals(before.effectiveWordComponents(), after.effectiveWordComponents())) parts.add("Word page templates");
        if (!Objects.equals(before.frame(), after.frame())) parts.add("page frame");
        return parts;
    }

    private void requireView(UserAccount actor) { require(actor, "reports.appearance.view", "reports.appearance.manage"); }

    private void requireManage(UserAccount actor) { require(actor, "reports.appearance.manage"); }

    private void require(UserAccount actor, String... codes) {
        if (actor == null || actor.getId() == null || actor.getStatus() != UserStatus.Active) throw new SecurityException("REPORT_SCOPE_DENIED");
        Set<String> actual = permissions.getEffectivePermissionCodes(actor);
        if (Arrays.stream(codes).noneMatch(actual::contains)) throw new SecurityException("REPORT_SCOPE_DENIED");
    }
}
