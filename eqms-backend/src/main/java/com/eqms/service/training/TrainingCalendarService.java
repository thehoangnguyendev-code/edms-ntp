package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import com.eqms.service.AuditTrailService;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.sql.Date;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * The days the site does not work, besides Saturday and Sunday (public holidays, company days off). They decide what "one working day" means for the time limits of
 * Training Management (SOP.0003 TR-13, and the rule for typing results from paper). Changes need the settings permission and a reason, and go to the Audit Trail.
 */
@Service
public class TrainingCalendarService {
    private static final UUID OBJECT_ID = UUID.fromString("00000000-0000-0000-0000-00000000c0de");

    private final JdbcTemplate jdbc;
    private final TrainingAccess access;
    private final AuditTrailService audit;

    public TrainingCalendarService(JdbcTemplate jdbc, TrainingAccess access, AuditTrailService audit) {
        this.jdbc = jdbc;
        this.access = access;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> list(UserAccount actor, Integer year) {
        access.require(actor, "training.settings.view", "training.settings.manage");
        int y = year == null ? LocalDate.now(TrainingNumberService.ZONE).getYear() : year;
        if (y < 2000 || y > 2100) throw new IllegalArgumentException("TRAINING_YEAR_INVALID");
        return TrainingRows.camel(jdbc.queryForList("""
            select d.day, d.reason as name, u.full_name as created_by_name, d.created_at from training_non_working_days d left join app_users u on u.id = d.created_by
             where d.day >= make_date(?, 1, 1) and d.day <= make_date(?, 12, 31) order by d.day
            """, y, y));
    }

    @Transactional
    public List<Map<String, Object>> add(UserAccount actor, LocalDate day, String name, String reason) {
        access.require(actor, "training.settings.manage");
        if (day == null || day.getYear() < 2000 || day.getYear() > 2100) throw new IllegalArgumentException("TRAINING_DATE_INVALID");
        if (name == null || name.isBlank() || name.length() > 120) throw new IllegalArgumentException("TRAINING_NAME_REQUIRED");
        if (reason == null || reason.isBlank()) throw new IllegalArgumentException("TRAINING_REASON_REQUIRED");
        if (day.getDayOfWeek() == DayOfWeek.SATURDAY || day.getDayOfWeek() == DayOfWeek.SUNDAY) throw new IllegalArgumentException("TRAINING_DAY_ALREADY_OFF");
        int rows = jdbc.update("insert into training_non_working_days(day, reason, created_by) values (?,?,?) on conflict (day) do nothing", Date.valueOf(day), name.trim(), actor.getId());
        if (rows == 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_DAY_ALREADY_OFF");
        audit.logAs(actor, "TRAINING_CALENDAR", "Non-working days", OBJECT_ID, "TRAINING_NON_WORKING_DAY_ADDED", null, day.toString(), name.trim() + ". " + reason.trim());
        return list(actor, day.getYear());
    }

    @Transactional
    public List<Map<String, Object>> remove(UserAccount actor, LocalDate day, String reason) {
        access.require(actor, "training.settings.manage");
        if (day == null) throw new IllegalArgumentException("TRAINING_DATE_INVALID");
        if (reason == null || reason.isBlank()) throw new IllegalArgumentException("TRAINING_REASON_REQUIRED");
        String name = jdbc.queryForList("select reason from training_non_working_days where day = ?", String.class, Date.valueOf(day)).stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "TRAINING_DAY_NOT_FOUND"));
        jdbc.update("delete from training_non_working_days where day = ?", Date.valueOf(day));
        audit.logAs(actor, "TRAINING_CALENDAR", "Non-working days", OBJECT_ID, "TRAINING_NON_WORKING_DAY_REMOVED", day.toString(), null, name + ". " + reason.trim());
        return list(actor, day.getYear());
    }

    /** How many working days lie after `from` up to and including `to`: Monday to Friday, minus the days the site does not work. */
    public int workingDaysAfter(LocalDate from, LocalDate to) {
        if (!to.isAfter(from)) return 0;
        Set<LocalDate> off = new HashSet<>();
        for (Date d : jdbc.queryForList("select day from training_non_working_days where day > ? and day <= ?", Date.class, Date.valueOf(from), Date.valueOf(to))) off.add(d.toLocalDate());
        int working = 0;
        for (LocalDate d = from.plusDays(1); !d.isAfter(to); d = d.plusDays(1)) {
            if (d.getDayOfWeek() != DayOfWeek.SATURDAY && d.getDayOfWeek() != DayOfWeek.SUNDAY && !off.contains(d)) working++;
        }
        return working;
    }
}
