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
 * the retention after leaving, and the switch of the link with Document Control. A change needs the version that was read, is checked
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

    public record SettingsWrite(Integer version, Integer passPercent, Integer documentTrainingDaysDefault,
                                Integer annualRequirementDueMonth, Integer annualRequirementDueDay, Integer absenceRetrainMonths,
                                Integer retentionYearsAfterLeaving, Integer reviewReadyReminderDays, Integer reviewOpenReminderDays,
                                Integer resultsDueDays, String reason, String resultsDueDayType, Integer initialTrainingDays,
                                Boolean warnScheduledAfterDue, Integer selfReadingReminderFirstDays, Integer selfReadingReminderSecondDays, Integer makeupReminderDays,
                                Map<String, String> downloadFileNames, String trainingNumberEntryMode) {
        /** Without the way the Training Number is given: it stays as it is. */
        public SettingsWrite(Integer version, Integer passPercent, Integer documentTrainingDaysDefault, Integer annualRequirementDueMonth, Integer annualRequirementDueDay, Integer absenceRetrainMonths,
                             Integer retentionYearsAfterLeaving, Integer reviewReadyReminderDays, Integer reviewOpenReminderDays, Integer resultsDueDays, String reason, String resultsDueDayType, Integer initialTrainingDays,
                             Boolean warnScheduledAfterDue, Integer selfReadingReminderFirstDays, Integer selfReadingReminderSecondDays, Integer makeupReminderDays, Map<String, String> downloadFileNames) {
            this(version, passPercent, documentTrainingDaysDefault, annualRequirementDueMonth, annualRequirementDueDay, absenceRetrainMonths, retentionYearsAfterLeaving, reviewReadyReminderDays,
                    reviewOpenReminderDays, resultsDueDays, reason, resultsDueDayType, initialTrainingDays, warnScheduledAfterDue, selfReadingReminderFirstDays, selfReadingReminderSecondDays, makeupReminderDays, downloadFileNames, null);
        }

        /** Without the patterns of the file names: they stay as they are. */
        public SettingsWrite(Integer version, Integer passPercent, Integer documentTrainingDaysDefault, Integer annualRequirementDueMonth, Integer annualRequirementDueDay, Integer absenceRetrainMonths,
                             Integer retentionYearsAfterLeaving, Integer reviewReadyReminderDays, Integer reviewOpenReminderDays, Integer resultsDueDays, String reason, String resultsDueDayType, Integer initialTrainingDays,
                             Boolean warnScheduledAfterDue, Integer selfReadingReminderFirstDays, Integer selfReadingReminderSecondDays, Integer makeupReminderDays) {
            this(version, passPercent, documentTrainingDaysDefault, annualRequirementDueMonth, annualRequirementDueDay, absenceRetrainMonths, retentionYearsAfterLeaving, reviewReadyReminderDays,
                    reviewOpenReminderDays, resultsDueDays, reason, resultsDueDayType, initialTrainingDays, warnScheduledAfterDue, selfReadingReminderFirstDays, selfReadingReminderSecondDays, makeupReminderDays, null, null);
        }
    }

    /** How a Training Number is given: "AUTO" (the system issues it, the default) or "MANUAL" (the person creating the document types it). */
    @Transactional(readOnly = true)
    public String trainingNumberEntryMode() {
        List<String> rows = jdbc.queryForList("select training_number_entry_mode from training_settings where id=1", String.class);
        return !rows.isEmpty() && "MANUAL".equals(rows.getFirst()) ? "MANUAL" : "AUTO";
    }

    /** The Administrator raises the counter of the Training Numbers of a department and year to the last serial of the paper log (go-live). */
    public record NumberCounterRaise(UUID departmentId, Integer year, Integer lastSerial, String reason) {}

    /**
     * The counters of the Training Numbers: for each department and year, the last serial that was issued (or reserved from a paper log) and the number that comes next. Server side paging.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> numberCounters(UserAccount actor, int page, int limit) {
        access.require(actor, "training.settings.view", "training.settings.manage");
        int safeLimit = Math.min(Math.max(limit, 1), 100), safePage = Math.max(page, 1);
        Long total = jdbc.queryForObject("select count(*) from training_number_sequences", Long.class);
        List<Map<String, Object>> rows = TrainingRows.camel(jdbc.queryForList("""
            select s.department_id, d.name as department_name, d.code as department_code, s.year, s.last_serial
              from training_number_sequences s join departments d on d.id = s.department_id
             order by s.year desc, d.name limit ? offset ?
            """, safeLimit, (safePage - 1) * safeLimit));
        for (Map<String, Object> row : rows) {
            row.put("nextNumber", TrainingNumberService.format(String.valueOf(row.get("departmentCode")).trim(), ((Number) row.get("year")).intValue(), ((Number) row.get("lastSerial")).intValue() + 1));
        }
        long count = total == null ? 0 : total;
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("data", rows);
        result.put("pagination", Map.of("page", safePage, "limit", safeLimit, "total", count, "totalPages", Math.max(1, (count + safeLimit - 1) / safeLimit)));
        return result;
    }

    /** Only raises: a counter that goes down could issue a number twice. A reason is required and the change is in the Audit Trail. */
    @Transactional
    public Map<String, Object> raiseNumberCounter(UserAccount actor, NumberCounterRaise request) {
        access.require(actor, "training.settings.manage");
        if (request == null || request.departmentId() == null || request.year() == null || request.lastSerial() == null) throw new IllegalArgumentException("TRAINING_NUMBER_COUNTER_INCOMPLETE");
        if (request.reason() == null || request.reason().isBlank()) throw new IllegalArgumentException("TRAINING_REASON_REQUIRED");
        int thisYear = LocalDate.now(TrainingNumberService.ZONE).getYear();
        if (request.year() < 2000 || request.year() > thisYear + 1) throw new IllegalArgumentException("TRAINING_NUMBER_COUNTER_YEAR_INVALID");
        if (request.lastSerial() < 1 || request.lastSerial() > 999999) throw new IllegalArgumentException("TRAINING_NUMBER_COUNTER_SERIAL_INVALID");
        List<Map<String, Object>> department = jdbc.queryForList("select name, code from departments where id = ?", request.departmentId());
        if (department.isEmpty()) throw new IllegalArgumentException("TRAINING_DEPARTMENT_NOT_FOUND");
        String code = String.valueOf(department.getFirst().get("code")).trim();
        if (!code.matches("[A-Za-z0-9]{1,40}")) throw new IllegalArgumentException("TRAINING_DEPARTMENT_CODE_INVALID");
        List<Integer> before = jdbc.queryForList("select last_serial from training_number_sequences where department_id = ? and year = ?", Integer.class, request.departmentId(), request.year());
        Integer changed = jdbc.queryForObject("""
            with up as (
              insert into training_number_sequences(department_id, year, last_serial) values (?, ?, ?)
              on conflict (department_id, year) do update set last_serial = excluded.last_serial where training_number_sequences.last_serial < excluded.last_serial
              returning last_serial)
            select count(*) from up
            """, Integer.class, request.departmentId(), request.year(), request.lastSerial());
        if (changed == null || changed == 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_NUMBER_COUNTER_CAN_ONLY_RISE");
        audit.logAs(actor, "TRAINING_SETTINGS", "TRAINING_NUMBER_COUNTER " + code + " " + request.year(), AUDIT_ID, "TRAINING_NUMBER_COUNTER_RAISED", null, null,
                "Counter of " + department.getFirst().get("name") + " " + request.year() + " raised from " + (before.isEmpty() ? "none" : before.getFirst()) + " to " + request.lastSerial()
                        + ". Next number: " + TrainingNumberService.format(code.toUpperCase(java.util.Locale.ROOT), request.year(), request.lastSerial() + 1) + ". Reason: " + request.reason().trim());
        return numberCounters(actor, 1, 10);
    }

    // ---- values used by other services (no permission: they run for the person who triggered the work) ----

    public boolean warnScheduledAfterDue() { return bool("warn_scheduled_after_due", true); }
    public int passPercent() { return intValue("pass_percent", 70); }
    public int documentTrainingDaysDefault() { return intValue("document_training_days_default", 10); }

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
            select pass_percent, document_training_days_default, annual_requirement_due_month, annual_requirement_due_day,
                   absence_retrain_months, retention_years_after_leaving, review_ready_reminder_days, review_open_reminder_days, results_due_days, results_due_day_type, initial_training_days, warn_scheduled_after_due, self_reading_reminder_first_days, self_reading_reminder_second_days, makeup_reminder_days, training_number_entry_mode, version, updated_at
              from training_settings where id=1
            """);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("passPercent", row.get("pass_percent"));
        result.put("documentTrainingDaysDefault", row.get("document_training_days_default"));
        result.put("annualRequirementDueMonth", row.get("annual_requirement_due_month"));
        result.put("annualRequirementDueDay", row.get("annual_requirement_due_day"));
        result.put("absenceRetrainMonths", row.get("absence_retrain_months"));
        result.put("retentionYearsAfterLeaving", row.get("retention_years_after_leaving"));
        result.put("reviewReadyReminderDays", row.get("review_ready_reminder_days"));
        result.put("reviewOpenReminderDays", row.get("review_open_reminder_days"));
        result.put("resultsDueDays", row.get("results_due_days"));
        result.put("resultsDueDayType", row.get("results_due_day_type"));
        result.put("initialTrainingDays", row.get("initial_training_days"));
        result.put("warnScheduledAfterDue", row.get("warn_scheduled_after_due"));
        result.put("selfReadingReminderFirstDays", row.get("self_reading_reminder_first_days"));
        result.put("selfReadingReminderSecondDays", row.get("self_reading_reminder_second_days"));
        result.put("makeupReminderDays", row.get("makeup_reminder_days"));
        result.put("trainingNumberEntryMode", row.get("training_number_entry_mode"));
        result.put("downloadFileNames", new TrainingFileNames(jdbc).describe());
        result.put("version", row.get("version"));
        result.put("updatedAt", row.get("updated_at"));
        return result;
    }

    @Transactional
    public Map<String, Object> update(UserAccount actor, SettingsWrite request) {
        access.require(actor, "training.settings.manage");
        if (request == null) throw new IllegalArgumentException("TRAINING_SETTINGS_INVALID");
        if (request.reason() != null && request.reason().length() > 1000) throw new IllegalArgumentException("TRAINING_REASON_REQUIRED");
        var current = jdbc.queryForMap("select * from training_settings where id=1 for update");
        if (!Objects.equals(((Number) current.get("version")).intValue(), request.version())) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_SETTINGS_VERSION_CHANGED");

        int pass = pick(request.passPercent(), current, "pass_percent");
        int days = pick(request.documentTrainingDaysDefault(), current, "document_training_days_default");
        int month = pick(request.annualRequirementDueMonth(), current, "annual_requirement_due_month");
        int day = pick(request.annualRequirementDueDay(), current, "annual_requirement_due_day");
        int absence = pick(request.absenceRetrainMonths(), current, "absence_retrain_months");
        int retention = pick(request.retentionYearsAfterLeaving(), current, "retention_years_after_leaving");
        int readyDays = pick(request.reviewReadyReminderDays(), current, "review_ready_reminder_days");
        int openDays = pick(request.reviewOpenReminderDays(), current, "review_open_reminder_days");
        int resultsDays = pick(request.resultsDueDays(), current, "results_due_days");
        int initialDays = pick(request.initialTrainingDays(), current, "initial_training_days");
        int readFirst = pick(request.selfReadingReminderFirstDays(), current, "self_reading_reminder_first_days");
        int readSecond = pick(request.selfReadingReminderSecondDays(), current, "self_reading_reminder_second_days");
        int makeupDays = pick(request.makeupReminderDays(), current, "makeup_reminder_days");
        String dayType = request.resultsDueDayType() == null ? String.valueOf(current.get("results_due_day_type")) : request.resultsDueDayType();
        if (!TrainingWorkingDays.valid(dayType)) throw new IllegalArgumentException("TRAINING_SETTINGS_INVALID");
        String currentEntryMode = current.get("training_number_entry_mode") == null ? "AUTO" : String.valueOf(current.get("training_number_entry_mode"));
        String entryMode = request.trainingNumberEntryMode() == null ? currentEntryMode : request.trainingNumberEntryMode();
        if (!"AUTO".equals(entryMode) && !"MANUAL".equals(entryMode)) throw new IllegalArgumentException("TRAINING_SETTINGS_INVALID");
        boolean warnAfterDue = request.warnScheduledAfterDue() == null ? Boolean.TRUE.equals(current.get("warn_scheduled_after_due")) : request.warnScheduledAfterDue();
        if (pass < 1 || pass > 100 || days < 1 || days > 365 || absence < 1 || absence > 60) throw new IllegalArgumentException("TRAINING_SETTINGS_INVALID");
        if (resultsDays < 1 || resultsDays > 60) throw new IllegalArgumentException("TRAINING_SETTINGS_INVALID");
        // the limits of the column (V674): a person counts as a new employee for 1 to 730 days after the start
        if (initialDays < 1 || initialDays > 730) throw new IllegalArgumentException("TRAINING_SETTINGS_INVALID");
        if (readyDays < 1 || readyDays > 60 || openDays < 1 || openDays > 365) throw new IllegalArgumentException("TRAINING_SETTINGS_INVALID");
        // two different reminders before the due date of a self-reading: the first (more days) and the second (fewer days)
        if (readFirst < 1 || readFirst > 30 || readSecond < 1 || readSecond > 30 || readSecond >= readFirst) throw new IllegalArgumentException("TRAINING_SETTINGS_INVALID");
        if (makeupDays < 1 || makeupDays > 365) throw new IllegalArgumentException("TRAINING_SETTINGS_INVALID");
        if (month < 1 || month > 12 || day < 1 || day > 31 || day > LocalDate.of(2025, month, 1).lengthOfMonth()) throw new IllegalArgumentException("TRAINING_SETTINGS_INVALID");
        // The SOP keeps training records for at least ten years after the employee leaves: a shorter time is refused.
        if (retention < 10) throw new IllegalArgumentException("TRAINING_RETENTION_TOO_SHORT");

        List<String> changes = new ArrayList<>();
        change(changes, "Pass mark (%)", current.get("pass_percent"), pass);
        change(changes, "Days to train on a new document", current.get("document_training_days_default"), days);
        change(changes, "Annual requirement due month", current.get("annual_requirement_due_month"), month);
        change(changes, "Annual requirement due day", current.get("annual_requirement_due_day"), day);
        change(changes, "Months of absence before retraining", current.get("absence_retrain_months"), absence);
        change(changes, "Years to keep records after leaving", current.get("retention_years_after_leaving"), retention);
        change(changes, "Days before a review that is ready to close is reminded", current.get("review_ready_reminder_days"), readyDays);
        change(changes, "Days before a review with items to do is reminded", current.get("review_open_reminder_days"), openDays);
        change(changes, "Days to finish a training and send the results to QA", current.get("results_due_days"), resultsDays);
        change(changes, "How the days to send the results to QA are counted", current.get("results_due_day_type"), dayType);
        change(changes, "Days a person counts as a new employee", current.get("initial_training_days"), initialDays);
        change(changes, "Warn when a session is scheduled after the due date", Boolean.TRUE.equals(current.get("warn_scheduled_after_due")) ? "on" : "off", warnAfterDue ? "on" : "off");
        change(changes, "Days before the due date of a self-reading for the first reminder", current.get("self_reading_reminder_first_days"), readFirst);
        change(changes, "Days before the due date of a self-reading for the second reminder", current.get("self_reading_reminder_second_days"), readSecond);
        change(changes, "Days after the due date to remind about a person still absent without a make-up training", current.get("makeup_reminder_days"), makeupDays);
        change(changes, "How the Training Number is given", currentEntryMode, entryMode);
        // the patterns of the names of the downloaded files: only the forms that were sent change; an empty pattern brings back the default
        TrainingFileNames names = new TrainingFileNames(jdbc);
        Map<String, String> patterns = new LinkedHashMap<>(names.saved());
        if (request.downloadFileNames() != null) {
            for (Map.Entry<String, String> e : request.downloadFileNames().entrySet()) {
                String key = e.getKey();
                String value = e.getValue() == null ? "" : e.getValue().trim();
                List<String> problems = TrainingFileNames.problems(key, value);
                if (!problems.isEmpty()) throw new IllegalArgumentException("TRAINING_FILE_NAME_PATTERN_INVALID: " + key + ": " + String.join("; ", problems));
                String before = patterns.getOrDefault(key, TrainingFileNames.form(key).defaultPattern());
                if (value.isEmpty()) patterns.remove(key); else patterns.put(key, value);
                String after = patterns.getOrDefault(key, TrainingFileNames.form(key).defaultPattern());
                change(changes, "File name of " + key, before, after);
            }
        }
        if (changes.isEmpty()) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_SETTINGS_UNCHANGED");

        jdbc.update("""
            update training_settings set pass_percent=?, document_training_days_default=?, annual_requirement_due_month=?,
              annual_requirement_due_day=?, absence_retrain_months=?, retention_years_after_leaving=?, review_ready_reminder_days=?, review_open_reminder_days=?, results_due_days=?,
              results_due_day_type=?, initial_training_days=?, warn_scheduled_after_due=?, self_reading_reminder_first_days=?, self_reading_reminder_second_days=?, makeup_reminder_days=?, training_number_entry_mode=?, download_file_names=cast(? as jsonb), version=version+1, updated_by=?, updated_at=now() where id=1
            """, pass, days, month, day, absence, retention, readyDays, openDays, resultsDays, dayType, initialDays, warnAfterDue, readFirst, readSecond, makeupDays, entryMode, TrainingFileNames.toJson(patterns), actor.getId());
        String reason = request.reason() == null ? "" : request.reason().trim();
        audit.logAs(actor, "TRAINING_SETTINGS", "TRAINING_SETTINGS", AUDIT_ID, "TRAINING_SETTINGS_UPDATED", null, null,
                (reason.isEmpty() ? "" : reason + " | ") + String.join("; ", changes));
        return read();
    }

    private static int pick(Integer requested, Map<String, Object> current, String column) {
        return requested == null ? ((Number) current.get(column)).intValue() : requested;
    }

    private static void change(List<String> changes, String label, Object before, Object after) {
        if (!Objects.equals(String.valueOf(before), String.valueOf(after))) changes.add(label + ": " + before + " -> " + after);
    }
}
