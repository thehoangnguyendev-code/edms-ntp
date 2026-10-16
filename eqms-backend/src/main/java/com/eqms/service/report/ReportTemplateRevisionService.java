package com.eqms.service.report;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.service.EffectivePermissionService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * Revisions of a report template (REPORT-TEMPLATE-REVISION-2026-10-14). The live rows of a template hold its EFFECTIVE revision, the only one that
 * runs. A revision written after that (DRAFT, PENDING_APPROVAL) is kept here, with its whole content, until it is approved; approving it replaces the
 * live rows and the earlier effective revision becomes OBSOLETE. A template that was never approved has one revision whose content is still in
 * the live rows (snapshot is null). Released revisions keep their whole content for ever, so any revision can be read and compared later.
 */
@Service
public class ReportTemplateRevisionService {
    public static final Set<String> OPEN = Set.of("DRAFT", "PENDING_APPROVAL");
    private static final Set<String> STATUSES = Set.of("DRAFT", "PENDING_APPROVAL", "EFFECTIVE", "OBSOLETE", "DISCARDED");
    private static final int MAX_PAGE = 100;

    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    private final EffectivePermissionService permissions;

    public ReportTemplateRevisionService(JdbcTemplate jdbc, ObjectMapper json, EffectivePermissionService permissions) {
        this.jdbc = jdbc;
        this.json = json;
        this.permissions = permissions;
    }

    // ---- reads used by the template service -------------------------------------------------------------------------------------------------

    /** The revision being written (DRAFT or PENDING_APPROVAL), or null. */
    public Map<String, Object> open(String code) {
        var rows = jdbc.queryForList("select * from report_template_revisions where definition_code=? and status in ('DRAFT','PENDING_APPROVAL')", code);
        return rows.isEmpty() ? null : rows.getFirst();
    }

    /** The effective revision, or null when the template has never been approved. */
    public Map<String, Object> effective(String code) {
        var rows = jdbc.queryForList("select * from report_template_revisions where definition_code=? and status='EFFECTIVE'", code);
        return rows.isEmpty() ? null : rows.getFirst();
    }

    /** The number of the effective revision, or null. */
    public Integer effectiveNumber(String code) {
        var rows = jdbc.queryForList("select revision from report_template_revisions where definition_code=? and status='EFFECTIVE'", Integer.class, code);
        return rows.isEmpty() ? null : rows.getFirst();
    }

    /** The content of an open revision, or null when its content is in the live rows. */
    public Map<String, Object> payloadOf(Map<String, Object> revision) {
        if (revision == null || revision.get("snapshot") == null) return null;
        return json.convertValue(parse(revision.get("snapshot")), json.getTypeFactory().constructMapType(LinkedHashMap.class, String.class, Object.class));
    }

    /** The version a client must send to change the open revision: the live version it grew from plus the number of times it was saved. */
    public static int versionOf(Map<String, Object> open) {
        return ((Number) open.get("base_version")).intValue() + ((Number) open.get("draft_version")).intValue();
    }

    // ---- writes used by the template service ------------------------------------------------------------------------------------------------

    /** Revision 1 of a new template; its content is in the live rows. */
    public void startFirst(String code, UUID actorId, String reason) {
        jdbc.update("""
            insert into report_template_revisions(definition_code,revision,status,change_reason,created_by_user_id,last_changed_by_user_id)
            values(?,1,'DRAFT',?,?,?)
            """, code, reason, actorId, actorId);
    }

    /** The first edit of a template that has an effective revision starts the next revision, with the content the actor wrote. */
    public void startRevision(String code, UUID actorId, int baseVersion, Map<String, Object> payload, String reason) {
        int next = Objects.requireNonNullElse(jdbc.queryForObject("select max(revision) from report_template_revisions where definition_code=?", Integer.class, code), 0) + 1;
        jdbc.update("""
            insert into report_template_revisions(definition_code,revision,status,snapshot,draft_version,base_version,change_reason,created_by_user_id,last_changed_by_user_id)
            values(?,?,'DRAFT',cast(? as jsonb),1,?,?,?,?)
            """, code, next, write(payload), baseVersion, reason, actorId, actorId);
    }

    /** A further save of the open revision. It goes back to Draft, so a submission has to be made again. */
    public void saveDraft(String code, UUID actorId, Map<String, Object> payload, String reason) {
        jdbc.update("""
            update report_template_revisions set snapshot=cast(? as jsonb),status='DRAFT',draft_version=draft_version+1,change_reason=?,
              last_changed_by_user_id=?,last_changed_at=now(),submitted_by_user_id=null,submitted_at=null,approval_comment=null
             where definition_code=? and status in ('DRAFT','PENDING_APPROVAL')
            """, write(payload), reason, actorId, code);
    }

    /** A save of a template that has no effective revision yet; the content is in the live rows. */
    public void touchLive(String code, UUID actorId, String reason) {
        int updated = jdbc.update("""
            update report_template_revisions set status='DRAFT',change_reason=?,last_changed_by_user_id=?,last_changed_at=now(),
              submitted_by_user_id=null,submitted_at=null,approval_comment=null
             where definition_code=? and status in ('DRAFT','PENDING_APPROVAL')
            """, reason, actorId, code);
        if (updated == 0) {
            int next = Objects.requireNonNullElse(jdbc.queryForObject("select max(revision) from report_template_revisions where definition_code=?", Integer.class, code), 0) + 1;
            jdbc.update("insert into report_template_revisions(definition_code,revision,status,change_reason,created_by_user_id,last_changed_by_user_id) values(?,?,'DRAFT',?,?,?)",
                    code, next, reason, actorId, actorId);
        }
    }

    /** A revision that is still a Draft is discarded. It stays on record, with its content, as Discarded. Returns false when there is no Draft to discard. */
    public boolean discard(String code, UUID actorId, String reason) {
        return jdbc.update("update report_template_revisions set status='DISCARDED',discarded_by_user_id=?,discarded_at=now(),discard_reason=? where definition_code=? and status='DRAFT'",
                actorId, reason, code) > 0;
    }

    public void markSubmitted(String code, UUID actorId) {
        jdbc.update("update report_template_revisions set status='PENDING_APPROVAL',submitted_by_user_id=?,submitted_at=now(),approval_comment=null where definition_code=? and status='DRAFT'", actorId, code);
    }

    public void markReturned(String code, String reason) {
        jdbc.update("update report_template_revisions set status='DRAFT',approval_comment=?,submitted_by_user_id=null,submitted_at=null where definition_code=? and status='PENDING_APPROVAL'", reason, code);
    }

    /**
     * The open revision is approved: it becomes the effective revision with the content now in the live rows, and the revision that was effective
     * before becomes superseded. Returns the number of the released revision.
     */
    public int release(String code, int definitionVersion, UUID approverId, String signatureId, Map<String, Object> content) {
        var open = open(code);
        if (open == null) throw new ResponseStatusException(HttpStatus.CONFLICT, "REPORT_TEMPLATE_NOT_PENDING");
        int number = ((Number) open.get("revision")).intValue();
        jdbc.update("update report_template_revisions set status='OBSOLETE',superseded_at=now(),superseded_by_revision=? where definition_code=? and status='EFFECTIVE'", number, code);
        jdbc.update("""
            update report_template_revisions set status='EFFECTIVE',snapshot=cast(? as jsonb),definition_version=?,approved_by_user_id=?,approved_at=now(),
              approval_signature_id=?,approval_comment=null,effective_at=now(),draft_version=draft_version
             where definition_code=? and status='PENDING_APPROVAL'
            """, write(content), definitionVersion, approverId, signatureId, code);
        return number;
    }

    // ---- screens: list, detail, compare (all processing on the server) -----------------------------------------------------------------------

    public Map<String, Object> list(UserAccount actor, String code, String status, String search, String sortBy, String sortDirection, int page, int limit) {
        requireView(actor);
        if (jdbc.queryForList("select 1 from report_definitions where code=?", code).isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "REPORT_TEMPLATE_NOT_FOUND");
        if (status != null && !status.isBlank() && !"ALL".equals(status) && !STATUSES.contains(status)) throw new IllegalArgumentException("REPORT_FILTER_NOT_ALLOWED");
        String term = search == null ? "" : search.trim();
        if (term.length() > 200) throw new IllegalArgumentException("REPORT_FILTER_NOT_ALLOWED");
        String pattern = "%" + term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
        String order = switch (sortBy == null ? "revision" : sortBy) {
            case "revision" -> "r.revision";
            case "status" -> "r.status";
            case "effectiveAt" -> "r.effective_at";
            case "approvedAt" -> "r.approved_at";
            case "lastChangedAt" -> "r.last_changed_at";
            default -> throw new IllegalArgumentException("REPORT_SORT_NOT_ALLOWED");
        };
        String direction = "asc".equalsIgnoreCase(sortDirection) ? "asc" : "desc";
        int safeLimit = Math.max(1, Math.min(limit, MAX_PAGE));
        int safePage = Math.max(1, page);
        StringBuilder where = new StringBuilder(" from report_template_revisions r left join app_users c on c.id=r.created_by_user_id left join app_users a on a.id=r.approved_by_user_id"
                + " where r.definition_code=? and (coalesce(r.change_reason,'') ilike ? or cast(r.revision as text) ilike ? or coalesce(c.full_name,'') ilike ? or coalesce(a.full_name,'') ilike ?)");
        List<Object> args = new ArrayList<>(List.of(code, pattern, pattern, pattern, pattern));
        if (status != null && !status.isBlank() && !"ALL".equals(status)) { where.append(" and r.status=?"); args.add(status); }
        long total = Objects.requireNonNullElse(jdbc.queryForObject("select count(*)" + where, Long.class, args.toArray()), 0L);
        args.add(safeLimit);
        args.add((safePage - 1L) * safeLimit);
        var rows = jdbc.queryForList("select r.revision, r.status, r.change_reason as \"changeReason\", r.definition_version as \"definitionVersion\", r.created_at as \"createdAt\","
                + " c.full_name as \"createdByName\", r.last_changed_at as \"lastChangedAt\", r.approved_at as \"approvedAt\", a.full_name as \"approvedByName\","
                + " r.effective_at as \"effectiveAt\", r.superseded_at as \"obsoletedAt\", r.superseded_by_revision as \"obsoletedByRevision\""
                + where + " order by " + order + " " + direction + " nulls last, r.revision desc limit ? offset ?", args.toArray());
        return Map.of("data", rows, "pagination", Map.of("page", safePage, "limit", safeLimit, "total", total, "totalPages", (total + safeLimit - 1) / safeLimit));
    }

    /** One revision with all its content. The content of the open revision of a never-approved template is read from the live rows by the caller. */
    public Map<String, Object> detail(UserAccount actor, String code, int revision, Map<String, Object> liveContent) {
        requireView(actor);
        var rows = jdbc.queryForList("""
            select r.*, c.full_name as created_by_name, l.full_name as last_changed_by_name, a.full_name as approved_by_name, s.full_name as submitted_by_name
              from report_template_revisions r left join app_users c on c.id=r.created_by_user_id left join app_users l on l.id=r.last_changed_by_user_id
              left join app_users a on a.id=r.approved_by_user_id left join app_users s on s.id=r.submitted_by_user_id
             where r.definition_code=? and r.revision=?
            """, code, revision);
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "REPORT_TEMPLATE_REVISION_NOT_FOUND");
        var row = rows.getFirst();
        var result = new LinkedHashMap<String, Object>();
        result.put("definitionCode", code);
        result.put("revision", revision);
        result.put("status", row.get("status"));
        result.put("changeReason", row.get("change_reason"));
        result.put("definitionVersion", row.get("definition_version"));
        result.put("createdAt", row.get("created_at"));
        result.put("createdByName", row.get("created_by_name"));
        result.put("lastChangedAt", row.get("last_changed_at"));
        result.put("lastChangedByName", row.get("last_changed_by_name"));
        result.put("submittedAt", row.get("submitted_at"));
        result.put("submittedByName", row.get("submitted_by_name"));
        result.put("approvedAt", row.get("approved_at"));
        result.put("approvedByName", row.get("approved_by_name"));
        result.put("approvalComment", row.get("approval_comment"));
        result.put("effectiveAt", row.get("effective_at"));
        result.put("discardedAt", row.get("discarded_at"));
        result.put("discardReason", row.get("discard_reason"));
        result.put("obsoletedAt", row.get("superseded_at"));
        result.put("obsoletedByRevision", row.get("superseded_by_revision"));
        result.put("content", contentOf(row, liveContent));
        return result;
    }

    /**
     * What changed between two revisions of a template: the sections of their content that differ. "with" is a revision number, "previous" (the
     * revision before this one) or "effective". The comparison is done here; the screen only shows it.
     */
    public Map<String, Object> compare(UserAccount actor, String code, int revision, String with, Map<String, Object> liveContent) {
        requireView(actor);
        Integer other;
        if (with == null || with.isBlank() || "previous".equals(with)) {
            var rows = jdbc.queryForList("select max(revision) from report_template_revisions where definition_code=? and revision<?", Integer.class, code, revision);
            other = rows.isEmpty() ? null : rows.getFirst();
        } else if ("effective".equals(with)) {
            other = effectiveNumber(code);
        } else {
            try { other = Integer.valueOf(with); } catch (NumberFormatException invalid) { throw new IllegalArgumentException("REPORT_FILTER_NOT_ALLOWED"); }
        }
        var current = detail(actor, code, revision, liveContent);
        var result = new LinkedHashMap<String, Object>();
        result.put("revision", revision);
        result.put("comparedWith", other);
        if (other == null) {
            result.put("changes", List.of());
            return result;
        }
        var before = detail(actor, code, other, liveContent);
        @SuppressWarnings("unchecked") Map<String, Object> a = (Map<String, Object>) before.get("content");
        @SuppressWarnings("unchecked") Map<String, Object> b = (Map<String, Object>) current.get("content");
        result.put("changes", diff(a, b));
        return result;
    }

    // ---- the content of a revision and the difference between two ----------------------------------------------------------------------------

    private Map<String, Object> contentOf(Map<String, Object> row, Map<String, Object> liveContent) {
        Map<String, Object> source = row.get("snapshot") != null ? payloadOf(row) : liveContent;
        var content = new LinkedHashMap<String, Object>();
        if (source == null) return content;
        for (String key : List.of("displayName", "description", "sourceCode", "gmpUse", "allowedFormats", "nameFormatId", "nameValues", "layout", "fields", "roleScopes")) {
            if (source.containsKey(key)) content.put(key, source.get(key));
        }
        return content;
    }

    /** Differences, section by section, between two contents. Each entry says what changed, from what, to what. */
    static List<Map<String, Object>> diff(Map<String, Object> from, Map<String, Object> to) {
        List<Map<String, Object>> changes = new ArrayList<>();
        for (var entry : List.of(Map.entry("displayName", "Template name"), Map.entry("description", "Description"),
                Map.entry("gmpUse", "For GMP use"), Map.entry("nameFormatId", "Name rule"))) {
            Object a = from.get(entry.getKey()), b = to.get(entry.getKey());
            if (!Objects.equals(text(a), text(b))) changes.add(change("General", entry.getValue(), "CHANGED", text(a), text(b)));
        }
        if (!Objects.equals(text(from.get("allowedFormats")), text(to.get("allowedFormats"))))
            changes.add(change("Output", "Output formats", "CHANGED", text(from.get("allowedFormats")), text(to.get("allowedFormats"))));
        if (!Objects.equals(text(from.get("layout")), text(to.get("layout"))))
            changes.add(change("Layout", "Report layout", "CHANGED", from.get("layout") == null ? "—" : "defined", to.get("layout") == null ? "—" : "changed"));
        diffList(changes, "Fields", from.get("fields"), to.get("fields"), "code", "name", List.of("allowed", "defaultSelected", "required"));
        diffList(changes, "Access", from.get("roleScopes"), to.get("roleScopes"), "roleId", "roleName", List.of("scope"));
        return changes;
    }

    @SuppressWarnings("unchecked")
    private static void diffList(List<Map<String, Object>> changes, String section, Object fromList, Object toList, String keyName, String labelName, List<String> attributes) {
        Map<String, Map<String, Object>> a = index(fromList, keyName), b = index(toList, keyName);
        for (var entry : b.entrySet()) {
            String label = String.valueOf(entry.getValue().getOrDefault(labelName, entry.getKey()));
            Map<String, Object> old = a.get(entry.getKey());
            if (old == null) { changes.add(change(section, label, "ADDED", null, describe(entry.getValue(), attributes))); continue; }
            for (String attribute : attributes) {
                if (!Objects.equals(text(old.get(attribute)), text(entry.getValue().get(attribute))))
                    changes.add(change(section, label + " — " + attribute, "CHANGED", text(old.get(attribute)), text(entry.getValue().get(attribute))));
            }
        }
        for (var entry : a.entrySet()) {
            if (!b.containsKey(entry.getKey())) changes.add(change(section, String.valueOf(entry.getValue().getOrDefault(labelName, entry.getKey())), "REMOVED", describe(entry.getValue(), attributes), null));
        }
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Map<String, Object>> index(Object list, String keyName) {
        var result = new LinkedHashMap<String, Map<String, Object>>();
        if (list instanceof List<?> items) for (Object item : items) if (item instanceof Map<?, ?> map && map.get(keyName) != null) result.put(String.valueOf(map.get(keyName)), (Map<String, Object>) map);
        return result;
    }

    private static String describe(Map<String, Object> item, List<String> attributes) {
        List<String> parts = new ArrayList<>();
        for (String attribute : attributes) parts.add(attribute + "=" + text(item.get(attribute)));
        return String.join(", ", parts);
    }

    private static Map<String, Object> change(String section, String item, String kind, String from, String to) {
        var result = new LinkedHashMap<String, Object>();
        result.put("section", section);
        result.put("item", item);
        result.put("kind", kind);
        result.put("from", from);
        result.put("to", to);
        return result;
    }

    private static String text(Object value) {
        if (value == null) return null;
        if (value instanceof Iterable<?> items) {
            List<String> parts = new ArrayList<>();
            for (Object item : items) parts.add(String.valueOf(item));
            return String.join(", ", parts);
        }
        return String.valueOf(value);
    }

    // ---- helpers -------------------------------------------------------------------------------------------------------------------------------

    private JsonNode parse(Object value) {
        try {
            if (value instanceof JsonNode node) return node;
            return json.readTree(String.valueOf(value));
        } catch (Exception invalid) {
            throw new IllegalStateException("REPORT_CONFIG_INVALID");
        }
    }

    private String write(Object value) {
        try { return json.writeValueAsString(value); } catch (Exception invalid) { throw new IllegalStateException("REPORT_CONFIG_INVALID"); }
    }

    private void requireView(UserAccount actor) {
        if (actor == null || actor.getId() == null || actor.getStatus() != UserStatus.Active) throw new SecurityException("REPORT_SCOPE_DENIED");
        Set<String> actual = permissions.getEffectivePermissionCodes(actor);
        if (Arrays.stream(new String[] {"reports.definition.view", "settings.configuration.view"}).noneMatch(actual::contains)) throw new SecurityException("REPORT_SCOPE_DENIED");
    }
}
