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
 * The settings of the Reports module (REPORT-PROPERTIES-2026-10-15), kept in one row as the settings of the Documents module are: the numbering of
 * report templates, the most rows a report file may hold, and two limits of scheduled reports.
 * A change needs the version that was read, is checked against the limits below, and is recorded in the Audit Trail with what changed.
 */
@Service
public class ReportPropertiesService {
    public static final int DEFAULT_MAX_ROWS = 10_000;
    public static final int DEFAULT_MAX_SCHEDULE_RECIPIENTS = 200;
    public static final int DEFAULT_SCHEDULE_RETRY_MINUTES = 5;
    /** The settings are one record; its audit entries share this identity. */
    private static final UUID AUDIT_ID = UUID.nameUUIDFromBytes("REPORT_PROPERTIES".getBytes(java.nio.charset.StandardCharsets.UTF_8));
    private static final Pattern PREFIX = Pattern.compile("[A-Z][A-Z0-9]{1,9}");

    private final JdbcTemplate jdbc;
    private final EffectivePermissionService permissions;
    private final AuditTrailService audit;

    public ReportPropertiesService(JdbcTemplate jdbc, EffectivePermissionService permissions, AuditTrailService audit) {
        this.jdbc = jdbc;
        this.permissions = permissions;
        this.audit = audit;
    }

    /** What an administrator sends. A missing number keeps the present value. */
    public record PropertiesWrite(Integer version, String templateNumberPrefix, Integer templateNumberDigits, Integer maxRows,
                                  Integer maxScheduleRecipients, Integer scheduleRetryMinutes, ReportLayout appearance) {
        public PropertiesWrite(Integer version, String templateNumberPrefix, Integer templateNumberDigits, Integer maxRows,
                               Integer maxScheduleRecipients, Integer scheduleRetryMinutes) {
            this(version, templateNumberPrefix, templateNumberDigits, maxRows, maxScheduleRecipients, scheduleRetryMinutes, null);
        }
    }

    private final com.fasterxml.jackson.databind.ObjectMapper json = new com.fasterxml.jackson.databind.ObjectMapper();
    private ReportWordService words;
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    public void configureWords(ReportWordService words) { this.words = words; }

    /**
     * The one appearance every report is rendered with (cover, header, footer, page numbers, font, stamp, watermark, logo, orientation, Word page templates);
     * the built-in default until an administrator sets one. Its charts are always empty: a report takes its charts from its template.
     */
    public ReportLayout appearance() {
        List<String> rows = jdbc.queryForList("select appearance::text from report_properties where id=1", String.class);
        if (rows.isEmpty() || rows.getFirst() == null) return ReportLayout.defaults();
        try {
            return json.readValue(rows.getFirst(), ReportLayout.class).withCharts(List.of());
        } catch (com.fasterxml.jackson.core.JsonProcessingException unreadable) {
            throw new IllegalStateException("REPORT_APPEARANCE_UNREADABLE", unreadable);
        }
    }

    // ---- values used by the other services ---------------------------------------------------------------------------------------------------

    public int maxRows() { return intValue("max_rows", DEFAULT_MAX_ROWS); }
    public int maxScheduleRecipients() { return intValue("max_schedule_recipients", DEFAULT_MAX_SCHEDULE_RECIPIENTS); }
    public int scheduleRetryMinutes() { return intValue("schedule_retry_minutes", DEFAULT_SCHEDULE_RETRY_MINUTES); }

    private int intValue(String column, int fallback) {
        List<Integer> rows = jdbc.queryForList("select " + column + " from report_properties where id=1", Integer.class);
        return rows.isEmpty() || rows.getFirst() == null ? fallback : rows.getFirst();
    }

    // ---- the screen --------------------------------------------------------------------------------------------------------------------------

    public Map<String, Object> get(UserAccount actor) {
        require(actor, "reports.properties.view", "reports.properties.manage");
        var row = jdbc.queryForMap("""
            select template_number_prefix, template_number_digits, template_number_sequence,
                   max_rows, max_schedule_recipients, schedule_retry_minutes, version, updated_at
              from report_properties where id=1
            """);
        var result = new LinkedHashMap<String, Object>();
        String prefix = String.valueOf(row.get("template_number_prefix"));
        int digits = ((Number) row.get("template_number_digits")).intValue();
        long last = ((Number) row.get("template_number_sequence")).longValue();
        result.put("templateNumberPrefix", prefix);
        result.put("templateNumberDigits", digits);
        result.put("templateNumberSeparator", ReportTemplateNumberService.SEPARATOR);
        result.put("lastTemplateSerial", last);
        result.put("nextTemplateNumber", ReportTemplateNumberService.format(prefix, digits, last + 1));
        result.put("maxRows", ((Number) row.get("max_rows")).intValue());
        result.put("maxScheduleRecipients", ((Number) row.get("max_schedule_recipients")).intValue());
        result.put("scheduleRetryMinutes", ((Number) row.get("schedule_retry_minutes")).intValue());
        result.put("appearance", appearance());
        result.put("version", ((Number) row.get("version")).intValue());
        result.put("updatedAt", row.get("updated_at"));
        return result;
    }

    @Transactional
    public Map<String, Object> update(UserAccount actor, PropertiesWrite request) {
        require(actor, "reports.properties.manage");
        if (request == null) throw new IllegalArgumentException("REPORT_PROPERTIES_INVALID");
        var current = jdbc.queryForMap("""
            select template_number_prefix, template_number_digits,
                   max_rows, max_schedule_recipients, schedule_retry_minutes, version
              from report_properties where id=1 for update
            """);
        if (!Objects.equals(((Number) current.get("version")).intValue(), request.version())) throw new ResponseStatusException(HttpStatus.CONFLICT, "REPORT_PROPERTIES_VERSION_CHANGED");
        String prefix = request.templateNumberPrefix() == null ? String.valueOf(current.get("template_number_prefix")) : request.templateNumberPrefix();
        if (!PREFIX.matcher(prefix).matches()) throw new IllegalArgumentException("REPORT_NUMBER_PREFIX_INVALID");
        int digits = request.templateNumberDigits() == null ? ((Number) current.get("template_number_digits")).intValue() : request.templateNumberDigits();
        if (digits < 3 || digits > 8) throw new IllegalArgumentException("REPORT_NUMBER_DIGITS_INVALID");
        int maxRows = request.maxRows() == null ? ((Number) current.get("max_rows")).intValue() : request.maxRows();
        if (maxRows < 1000 || maxRows > 100_000) throw new IllegalArgumentException("REPORT_MAX_ROWS_INVALID");
        int recipients = request.maxScheduleRecipients() == null ? ((Number) current.get("max_schedule_recipients")).intValue() : request.maxScheduleRecipients();
        if (recipients < 1 || recipients > 500) throw new IllegalArgumentException("REPORT_MAX_RECIPIENTS_INVALID");
        int retry = request.scheduleRetryMinutes() == null ? ((Number) current.get("schedule_retry_minutes")).intValue() : request.scheduleRetryMinutes();
        if (retry < 1 || retry > 60) throw new IllegalArgumentException("REPORT_RETRY_MINUTES_INVALID");

        List<String> changes = new ArrayList<>();
        change(changes, "Template number prefix", current.get("template_number_prefix"), prefix);
        change(changes, "Digits of the serial number", current.get("template_number_digits"), digits);
        change(changes, "Most rows in a report file", current.get("max_rows"), maxRows);
        change(changes, "Most recipients of a schedule", current.get("max_schedule_recipients"), recipients);
        change(changes, "Retry of a schedule after a temporary failure (minutes)", current.get("schedule_retry_minutes"), retry);
        ReportLayout before = appearance();
        ReportLayout appearance = request.appearance() == null ? before : request.appearance().withCharts(List.of()).validated();
        if (request.appearance() != null && !appearance.effectiveWordComponents().isEmpty()) {
            if (words == null) throw new IllegalStateException("REPORT_WORD_RENDERER_UNAVAILABLE");
            words.validate(appearance);
        }
        if (!appearance.equals(before)) changes.add("Report appearance: " + describe(before, appearance));
        if (changes.isEmpty()) throw new ResponseStatusException(HttpStatus.CONFLICT, "REPORT_PROPERTIES_UNCHANGED");

        String appearanceJson;
        try {
            appearanceJson = json.writeValueAsString(appearance);
        } catch (com.fasterxml.jackson.core.JsonProcessingException invalid) {
            throw new IllegalArgumentException("REPORT_LAYOUT_INVALID");
        }
        jdbc.update("""
            update report_properties set template_number_prefix=?, template_number_digits=?, max_rows=?, max_schedule_recipients=?,
              schedule_retry_minutes=?, appearance=cast(? as jsonb), version=version+1, updated_by=?, updated_at=now() where id=1
            """, prefix, digits, maxRows, recipients, retry, appearanceJson, actor.getId());
        audit.logAs(actor, "REPORT_PROPERTIES", "REPORT_PROPERTIES", AUDIT_ID, "REPORT_PROPERTIES_UPDATED", null, null, String.join("; ", changes));
        return get(actor);
    }

    /** Which parts of the appearance changed, by name; never the contents (a logo is a picture). */
    private static String describe(ReportLayout before, ReportLayout after) {
        List<String> parts = new ArrayList<>();
        if (before.cover() != after.cover() || !Objects.equals(before.coverTitle(), after.coverTitle()) || !Objects.equals(before.subtitle(), after.subtitle())
                || before.showExecutor() != after.showExecutor() || before.showGeneratedAt() != after.showGeneratedAt()) parts.add("cover");
        if (!Objects.equals(before.header(), after.header())) parts.add("header");
        if (!Objects.equals(before.footer(), after.footer()) || before.pageNumbers() != after.pageNumbers()) parts.add("footer and page numbers");
        if (!Objects.equals(before.effectiveFont(), after.effectiveFont())) parts.add("font");
        if (!Objects.equals(before.effectiveOrientation(), after.effectiveOrientation())) parts.add("paper layout");
        if (before.stampEnabled() != after.stampEnabled() || !Objects.equals(before.stamp(), after.stamp()) || !Objects.equals(before.effectiveStamp(), after.effectiveStamp())) parts.add("stamp");
        if (before.watermarkEnabled() != after.watermarkEnabled() || !Objects.equals(before.watermark(), after.watermark()) || !Objects.equals(before.effectiveWatermark(), after.effectiveWatermark())) parts.add("watermark");
        if (!Objects.equals(before.logo(), after.logo())) parts.add("logo");
        if (!Objects.equals(before.effectiveWordComponents(), after.effectiveWordComponents())) parts.add("Word page templates");
        return parts.isEmpty() ? "changed" : String.join(", ", parts) + " changed";
    }

    private static void change(List<String> changes, String label, Object before, Object after) {
        if (!Objects.equals(before == null ? null : String.valueOf(before), after == null ? null : String.valueOf(after)))
            changes.add(label + ": " + (before == null ? "none" : before) + " -> " + (after == null ? "none" : after));
    }

    private void require(UserAccount actor, String... codes) {
        if (actor == null || actor.getId() == null || actor.getStatus() != UserStatus.Active) throw new SecurityException("REPORT_SCOPE_DENIED");
        Set<String> actual = permissions.getEffectivePermissionCodes(actor);
        if (Arrays.stream(codes).noneMatch(actual::contains)) throw new SecurityException("REPORT_SCOPE_DENIED");
    }
}
