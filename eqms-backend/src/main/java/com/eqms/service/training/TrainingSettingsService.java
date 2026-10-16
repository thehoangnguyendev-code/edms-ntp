package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import com.eqms.service.AuditTrailService;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * The settings of Training Management in one row (SDS-TR-001 section 4.1): the pass mark, the days to train on a new document, the days to send results,
 * the retention after leaving, and the switch of the link with Document Control. A change needs the version that was read and a reason, is checked
 * against the limits of the SOP, and is recorded in the Audit Trail with what changed.
 */
@Service
public class TrainingSettingsService {
    private static final UUID AUDIT_ID = UUID.nameUUIDFromBytes("TRAINING_SETTINGS".getBytes(java.nio.charset.StandardCharsets.UTF_8));

    private final JdbcTemplate jdbc;
    private final TrainingAccess access;
    private final AuditTrailService audit;

    public TrainingSettingsService(JdbcTemplate jdbc, TrainingAccess access, AuditTrailService audit) {
        this.jdbc = jdbc;
        this.access = access;
        this.audit = audit;
    }

    public record SettingsWrite(Integer version, Integer passPercent, Integer documentTrainingDaysDefault, Integer resultsDueWorkingDays,
                                Integer annualRequirementDueMonth, Integer annualRequirementDueDay, Integer absenceRetrainMonths,
                                Integer retentionYearsAfterLeaving, Boolean integrationEnabled, String reason) {}

    // ---- values used by other services (no permission: they run for the person who triggered the work) ----

    public boolean integrationEnabled() { return bool("integration_enabled", true); }
    public int passPercent() { return intValue("pass_percent", 70); }
    public int documentTrainingDaysDefault() { return intValue("document_training_days_default", 10); }
    public int resultsDueWorkingDays() { return intValue("results_due_working_days", 7); }

    private int intValue(String column, int fallback) {
        List<Integer> rows = jdbc.queryForList("select " + column + " from training_settings where id=1", Integer.class);
        return rows.isEmpty() || rows.getFirst() == null ? fallback : rows.getFirst();
    }

    private boolean bool(String column, boolean fallback) {
        List<Boolean> rows = jdbc.queryForList("select " + column + " from training_settings where id=1", Boolean.class);
        return rows.isEmpty() || rows.getFirst() == null ? fallback : rows.getFirst();
    }

    // ---- the screen ----

    public Map<String, Object> get(UserAccount actor) {
        access.require(actor, "training.settings.view", "training.settings.manage");
        return read();
    }

    private Map<String, Object> read() {
        var row = jdbc.queryForMap("""
            select pass_percent, document_training_days_default, results_due_working_days, annual_requirement_due_month, annual_requirement_due_day,
                   absence_retrain_months, retention_years_after_leaving, integration_enabled, version, updated_at
              from training_settings where id=1
            """);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("passPercent", row.get("pass_percent"));
        result.put("documentTrainingDaysDefault", row.get("document_training_days_default"));
        result.put("resultsDueWorkingDays", row.get("results_due_working_days"));
        result.put("annualRequirementDueMonth", row.get("annual_requirement_due_month"));
        result.put("annualRequirementDueDay", row.get("annual_requirement_due_day"));
        result.put("absenceRetrainMonths", row.get("absence_retrain_months"));
        result.put("retentionYearsAfterLeaving", row.get("retention_years_after_leaving"));
        result.put("integrationEnabled", row.get("integration_enabled"));
        result.put("version", row.get("version"));
        result.put("updatedAt", row.get("updated_at"));
        return result;
    }

    @Transactional
    public Map<String, Object> update(UserAccount actor, SettingsWrite request) {
        access.require(actor, "training.settings.manage");
        if (request == null) throw new IllegalArgumentException("TRAINING_SETTINGS_INVALID");
        if (request.reason() == null || request.reason().isBlank() || request.reason().length() > 1000) throw new IllegalArgumentException("TRAINING_REASON_REQUIRED");
        var current = jdbc.queryForMap("select * from training_settings where id=1 for update");
        if (!Objects.equals(((Number) current.get("version")).intValue(), request.version())) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_SETTINGS_VERSION_CHANGED");

        int pass = pick(request.passPercent(), current, "pass_percent");
        int days = pick(request.documentTrainingDaysDefault(), current, "document_training_days_default");
        int results = pick(request.resultsDueWorkingDays(), current, "results_due_working_days");
        int month = pick(request.annualRequirementDueMonth(), current, "annual_requirement_due_month");
        int day = pick(request.annualRequirementDueDay(), current, "annual_requirement_due_day");
        int absence = pick(request.absenceRetrainMonths(), current, "absence_retrain_months");
        int retention = pick(request.retentionYearsAfterLeaving(), current, "retention_years_after_leaving");
        boolean integration = request.integrationEnabled() == null ? Boolean.TRUE.equals(current.get("integration_enabled")) : request.integrationEnabled();
        if (pass < 1 || pass > 100 || days < 1 || days > 365 || results < 1 || results > 60 || absence < 1 || absence > 60) throw new IllegalArgumentException("TRAINING_SETTINGS_INVALID");
        if (month < 1 || month > 12 || day < 1 || day > 31 || day > LocalDate.of(2025, month, 1).lengthOfMonth()) throw new IllegalArgumentException("TRAINING_SETTINGS_INVALID");
        // The SOP keeps training records for at least ten years after the employee leaves: a shorter time is refused.
        if (retention < 10) throw new IllegalArgumentException("TRAINING_RETENTION_TOO_SHORT");

        List<String> changes = new ArrayList<>();
        change(changes, "Pass mark (%)", current.get("pass_percent"), pass);
        change(changes, "Days to train on a new document", current.get("document_training_days_default"), days);
        change(changes, "Working days to send results to QA", current.get("results_due_working_days"), results);
        change(changes, "Annual requirement due month", current.get("annual_requirement_due_month"), month);
        change(changes, "Annual requirement due day", current.get("annual_requirement_due_day"), day);
        change(changes, "Months of absence before retraining", current.get("absence_retrain_months"), absence);
        change(changes, "Years to keep records after leaving", current.get("retention_years_after_leaving"), retention);
        change(changes, "Link with Document Control", Boolean.TRUE.equals(current.get("integration_enabled")) ? "on" : "off", integration ? "on" : "off");
        if (changes.isEmpty()) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_SETTINGS_UNCHANGED");

        jdbc.update("""
            update training_settings set pass_percent=?, document_training_days_default=?, results_due_working_days=?, annual_requirement_due_month=?,
              annual_requirement_due_day=?, absence_retrain_months=?, retention_years_after_leaving=?, integration_enabled=?, version=version+1,
              updated_by=?, updated_at=now() where id=1
            """, pass, days, results, month, day, absence, retention, integration, actor.getId());
        audit.logAs(actor, "TRAINING_SETTINGS", "TRAINING_SETTINGS", AUDIT_ID, "TRAINING_SETTINGS_UPDATED", null, null, request.reason().trim() + " | " + String.join("; ", changes));
        return read();
    }

    private static int pick(Integer requested, Map<String, Object> current, String column) {
        return requested == null ? ((Number) current.get(column)).intValue() : requested;
    }

    private static void change(List<String> changes, String label, Object before, Object after) {
        if (!Objects.equals(String.valueOf(before), String.valueOf(after))) changes.add(label + ": " + before + " -> " + after);
    }
}
