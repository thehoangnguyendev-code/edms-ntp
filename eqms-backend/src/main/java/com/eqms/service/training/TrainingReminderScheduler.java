package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.DistributedSchedulerLockService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDate;
import java.time.temporal.IsoFields;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Daily reminders of Training Management: people invited to a training that is due within three days, the organizer of a training that is overdue, and the
 * person who has a step waiting for more than three days. A reminder has a key (the day or the week), so a second run on the same day or a retry never sends it
 * again. Runs under a lock so that only one instance sends.
 */
@Service
public class TrainingReminderScheduler {
    private static final Logger log = LoggerFactory.getLogger(TrainingReminderScheduler.class);

    private final JdbcTemplate jdbc;
    private final UserAccountRepository users;
    private final TrainingNotifier notifier;
    private final DistributedSchedulerLockService locks;
    private final TrainingRecipients recipients;
    private final TrainingImpactService impacts;
    private final TrainingApprovalService approvals;

    public TrainingReminderScheduler(JdbcTemplate jdbc, UserAccountRepository users, TrainingNotifier notifier, DistributedSchedulerLockService locks, TrainingRecipients recipients, TrainingImpactService impacts, TrainingApprovalService approvals) {
        this.jdbc = jdbc;
        this.users = users;
        this.notifier = notifier;
        this.locks = locks;
        this.recipients = recipients;
        this.impacts = impacts;
        this.approvals = approvals;
    }

    @Scheduled(cron = "0 30 6 * * *", zone = "Asia/Ho_Chi_Minh")
    public void run() {
        try (var lease = locks.tryAcquire("training-reminders", Duration.ofMinutes(15))) {
            if (!lease.acquired()) {
                log.warn("Skipping the Training reminders because another instance owns the lease or Redis is unavailable");
                return;
            }
            sendAll(LocalDate.now(TrainingNumberService.ZONE));
        } catch (Exception failure) {
            log.error("Training reminder run failed", failure);
        }
    }

    /** One pass of every reminder for a given day; public so that it can be run by hand and tested. */
    public int sendAll(LocalDate today) {
        int sent = 0;
        sent += dueSoon(today);
        sent += overdue(today);
        sent += waitingSteps(today);
        sent += qaListReminders(today);
        sent += annualRequirementReminders(today);
        sent += periodicRequirementReminders(today);
        sent += impactReminders(today);
        sent += reviewReminders(today);
        sent += resultsReminders(today);
        sent += confirmationReminders(today);
        return sent;
    }

    private int dueSoon(LocalDate today) {
        int count = 0;
        List<Map<String, Object>> rows = jdbc.queryForList("""
            select distinct a.id, a.training_number, training_activity_topics(a.id) as training_topics, a.due_date, p.person_user_id
              from training_activities a join training_participants p on p.activity_id = a.id
             where a.status in ('NOTIFIED','IN_PROGRESS') and a.due_date between ? and ? and p.person_user_id is not null and p.state = 'INVITED'
            """, today, today.plusDays(3));
        for (Map<String, Object> row : rows) {
            UserAccount person = users.findById((UUID) row.get("person_user_id")).orElse(null);
            if (person == null) continue;
            notifier.send("TRAINING_DUE_SOON", person, null, "Training: due soon",
                    "The training " + row.get("training_number") + " (" + row.get("training_topics") + ") is due on " + com.eqms.util.DateTimeFormatUtils.display(row.get("due_date")) + ".", "TRAINING_ACTIVITY", (UUID) row.get("id"), "due-soon:" + today);
            count++;
        }
        return count;
    }

    private int overdue(LocalDate today) {
        int count = 0;
        String week = today.get(IsoFields.WEEK_BASED_YEAR) + "-W" + today.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR);
        List<Map<String, Object>> rows = jdbc.queryForList("""
            select id, training_number, training_activity_topics(id) as training_topics, due_date, created_by from training_activities
             where status in ('PLANNED','NOTIFIED','IN_PROGRESS','PENDING_QA_CONFIRMATION') and due_date < ? and created_by is not null
            """, today);
        for (Map<String, Object> row : rows) {
            UserAccount organizer = users.findById((UUID) row.get("created_by")).orElse(null);
            if (organizer == null) continue;
            notifier.send("TRAINING_OVERDUE", organizer, null, "Training: overdue",
                    "The training " + row.get("training_number") + " (" + row.get("training_topics") + ") was due on " + com.eqms.util.DateTimeFormatUtils.display(row.get("due_date")) + " and is not completed.", "TRAINING_ACTIVITY", (UUID) row.get("id"), "overdue:" + week);
            count++;
        }
        return count;
    }

    /**
     * SOP.0003 5.3.6: for a new or revised document the attendance list goes to QA on the day of the training. The morning of the day, the organizer is reminded; the day after, if the list
     * has not been sent, once a week while it stays late.
     */
    private int qaListReminders(LocalDate today) {
        int count = 0;
        String week = today.get(IsoFields.WEEK_BASED_YEAR) + "-W" + today.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR);
        for (Map<String, Object> row : jdbc.queryForList("""
            select distinct a.id, a.training_number, training_activity_topics(a.id) as training_topics, a.created_by from training_activities a join training_sessions s on s.activity_id = a.id
             where a.status in ('NOTIFIED','IN_PROGRESS') and a.document_id is not null and a.kind_reason in ('NEW_SOP','SOP_VERSION') and a.created_by is not null
               and s.status = 'PLANNED' and s.held_on is null and s.scheduled_on = ?
            """, today)) {
            UserAccount organizer = users.findById((UUID) row.get("created_by")).orElse(null);
            if (organizer == null) continue;
            notifier.send("TRAINING_QA_LIST_TODAY", organizer, null, "Training today: send the list to QA today",
                    "Today is the training " + row.get("training_number") + " (" + row.get("training_topics") + ") on a new or revised document. Send the attendance list to QA today (SOP.0003 5.3.6).", "TRAINING_ACTIVITY", (UUID) row.get("id"), "qa-list-today:" + today);
            count++;
        }
        for (Map<String, Object> row : jdbc.queryForList("""
            select a.id, a.training_number, training_activity_topics(a.id) as training_topics, a.created_by, max(s.held_on) as held_on from training_activities a join training_sessions s on s.activity_id = a.id and s.status = 'PLANNED' and s.held_on is not null
             where a.status = 'IN_PROGRESS' and a.attendance_sent_at is null and a.document_id is not null and a.kind_reason in ('NEW_SOP','SOP_VERSION') and a.created_by is not null
             group by a.id, a.training_number, training_activity_topics(a.id), a.created_by having max(s.held_on) < ?
            """, java.sql.Date.valueOf(today))) {
            UserAccount organizer = users.findById((UUID) row.get("created_by")).orElse(null);
            if (organizer == null) continue;
            notifier.send("TRAINING_QA_LIST_LATE", organizer, null, "Training: the list for QA is late",
                    "The attendance list of " + row.get("training_number") + " (" + row.get("training_topics") + ") was due to QA on " + com.eqms.util.DateTimeFormatUtils.display(row.get("held_on")) + " and has not been sent.", "TRAINING_ACTIVITY", (UUID) row.get("id"), "qa-list-late:" + week);
            count++;
        }
        return count;
    }

    private int waitingSteps(LocalDate today) {
        int count = 0;
        String week = today.get(IsoFields.WEEK_BASED_YEAR) + "-W" + today.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR);
        List<Map<String, Object>> rows = jdbc.queryForList("""
            select id, object_type, object_id, step_code, assignee_user_id from training_approval_assignments
             where status = 'PENDING' and assigned_at < now() - interval '3 days'
            """);
        for (Map<String, Object> row : rows) {
            UserAccount assignee = users.findById((UUID) row.get("assignee_user_id")).orElse(null);
            if (assignee == null) continue;
            notifier.send("TRAINING_STEP_WAITING", assignee, null, "Training: a step is waiting for you",
                    "You still have to " + TrainingNotifier.stepText(String.valueOf(row.get("step_code"))) + ". It has been waiting for more than three days.",
                    String.valueOf(row.get("object_type")), (UUID) row.get("object_id"), "waiting:" + row.get("id") + ":" + week);
            count++;
        }
        return count;
    }

    private static String weekOf(LocalDate day) {
        return day.get(IsoFields.WEEK_BASED_YEAR) + "-W" + day.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR);
    }

    /**
     * SOP.0003 5.3.2 (TR-07): the requirement of the next year is prepared and approved before the due date set in the settings (31 December by default). From thirty days before it,
     * once a week, the people who prepare requirements in a department that uses the matrix and has no approved annual requirement for the year are reminded.
     */
    private int annualRequirementReminders(LocalDate today) {
        Map<String, Object> s = jdbc.queryForMap("select annual_requirement_due_month as m, annual_requirement_due_day as d from training_settings where id = 1");
        int month = ((Number) s.get("m")).intValue();
        LocalDate due = LocalDate.of(today.getYear(), month, Math.min(((Number) s.get("d")).intValue(), java.time.YearMonth.of(today.getYear(), month).lengthOfMonth()));
        if (today.isAfter(due) || today.isBefore(due.minusDays(30))) return 0;
        int year = due.getYear() + 1;
        int count = 0;
        for (Map<String, Object> row : jdbc.queryForList("""
            select d.id, d.name from departments d
             where exists (select 1 from training_matrices m where m.department_id = d.id)
               and not exists (select 1 from training_requirements q where q.department_id = d.id and q.year = ? and q.kind = 'ANNUAL' and q.status = 'APPROVED')
            """, year)) {
            for (UserAccount person : recipients.holders("training.requirement.prepare", (UUID) row.get("id"))) {
                notifier.send("TRAINING_REQUIREMENT_DUE", person, null, "Training: the requirement for " + year + " is not approved yet",
                        "The annual training requirement of " + row.get("name") + " for " + year + " must be prepared and approved by " + due + " (SOP.0003 5.3.2).",
                        "TRAINING_REQUIREMENT_LIST", (UUID) row.get("id"), "req-year:" + row.get("id") + ":" + year + ":" + weekOf(today));
                count++;
            }
        }
        return count;
    }

    /**
     * SOP.0003 5.3.2 (TR-08): the periodic training of the documents whose review is done is requested, prepared and approved by the last day of the month. The software has no event
     * for "the review is done", so the documents whose review date (valid until) falls in the month are taken. In the last three days of the month, those of a department that are in no
     * approved periodic requirement of the year are named to the people who prepare requirements there.
     */
    private int periodicRequirementReminders(LocalDate today) {
        LocalDate last = today.withDayOfMonth(today.lengthOfMonth());
        if (today.isBefore(last.minusDays(2))) return 0;
        LocalDate first = today.withDayOfMonth(1);
        int count = 0;
        for (Map<String, Object> row : jdbc.queryForList("""
            select x.department_id, d.name, count(distinct x.id) as n, string_agg(distinct x.document_number, ', ') as numbers
              from documents x join document_revisions r on r.document_id = x.id and r.status_code = 'EFFECTIVE' join departments d on d.id = x.department_id
             where r.valid_until between ? and ? and r.requires_training
               and not exists (select 1 from training_requirement_lines l join training_requirements q on q.id = l.requirement_id
                                where l.document_id = x.id and q.kind = 'SOP_PERIODIC' and q.year = ? and q.status = 'APPROVED')
             group by x.department_id, d.name
            """, java.sql.Date.valueOf(first), java.sql.Date.valueOf(last), today.getYear())) {
            String stage = today.equals(last) ? "last" : "soon";
            for (UserAccount person : recipients.holders("training.requirement.prepare", (UUID) row.get("department_id"))) {
                notifier.send("TRAINING_PERIODIC_REQUIREMENT_DUE", person, null, "Training: periodic training of reviewed documents is not requested",
                        row.get("n") + " document(s) of " + row.get("name") + " reach their review date this month and are in no approved periodic training requirement: " + row.get("numbers")
                                + ". The requirement is due by " + last + " (SOP.0003 5.3.2).",
                        "TRAINING_REQUIREMENT_LIST", (UUID) row.get("department_id"), "req-periodic:" + row.get("department_id") + ":" + first.getYear() + "-" + first.getMonthValue() + ":" + stage);
                count++;
            }
        }
        return count;
    }

    /** SOP.0003 5.3.1 (TR-28): once a week, the people who manage the matrix of a department are reminded of the documents whose impact on the matrix is not assessed or not yet in the matrix. */
    private int impactReminders(LocalDate today) {
        if (today.getDayOfWeek() != java.time.DayOfWeek.MONDAY) return 0;
        int count = 0;
        for (Map<String, Object> row : impacts.waitingByDepartment()) {
            for (UserAccount person : recipients.holders("training.matrix.manage", (UUID) row.get("department_id"))) {
                notifier.send("TRAINING_IMPACT_WAITING", person, null, "Training: documents wait for the matrix to be updated",
                        row.get("pending") + " new or revised document(s) of " + row.get("name") + " have no impact assessment and " + row.get("update_pending")
                                + " need the matrix to be updated (SOP.0003 5.3.1).", "TRAINING_DOCUMENT_TRAININGS", (UUID) row.get("department_id"), "impact:" + row.get("department_id") + ":" + weekOf(today));
                count++;
            }
        }
        return count;
    }

    /**
     * Training reviews (SOP.0003 5.3.11). A review whose items are all settled waits for the person chosen to close it: once it has waited as many days as Training Properties says,
     * that person is reminded every week (a review opened before the choice existed reminds the people of the department who may close it). A review that still has items to do after
     * the other number of days reminds the person who opened it. Only the people concerned are reminded.
     */
    private int reviewReminders(LocalDate today) {
        Map<String, Object> settings = jdbc.queryForMap("select review_ready_reminder_days as ready, review_open_reminder_days as open from training_settings where id = 1");
        int readyDays = ((Number) settings.get("ready")).intValue();
        int openDays = ((Number) settings.get("open")).intValue();
        int count = 0;
        for (Map<String, Object> row : jdbc.queryForList("""
            select r.id, r.review_no, u.id as person_id, u.full_name, a.assignee_user_id,
                   (select d.id from departments d where lower(trim(d.name)) = lower(trim(u.department)) limit 1) as department_id
              from training_personnel_reviews r join app_users u on u.id = r.person_user_id
              left join training_approval_assignments a on a.object_type = 'TRAINING_PERSONNEL_REVIEW' and a.object_id = r.id and a.step_code = 'REVIEW_CLOSE' and a.status = 'PENDING'
             where r.status = 'OPEN'
               and not exists (select 1 from training_personnel_review_items i where i.review_id = r.id and i.status = 'PENDING')
               and coalesce((select max(i.done_at) from training_personnel_review_items i where i.review_id = r.id), r.created_at) < now() - make_interval(days => ?)
            """, readyDays)) {
            List<UserAccount> who = new java.util.ArrayList<>();
            if (row.get("assignee_user_id") != null) users.findById((UUID) row.get("assignee_user_id")).ifPresent(who::add);
            else for (UserAccount holder : recipients.holders("training.job_assignment.manage", (UUID) row.get("department_id"))) if (!holder.getId().equals(row.get("person_id"))) who.add(holder);
            for (UserAccount person : who) {
                notifier.send("TRAINING_REVIEW_CLOSE_DUE", person, null, "Training: a review is waiting for you to close it",
                        "Every item of the training review " + row.get("review_no") + " of " + row.get("full_name") + " is settled and it has been waiting for more than " + readyDays + " day(s). Please check it and sign to close it.",
                        "TRAINING_PERSONNEL_REVIEW", (UUID) row.get("id"), "review-ready-due:" + row.get("id") + ":" + person.getId() + ":" + weekOf(today));
                count++;
            }
        }
        for (Map<String, Object> row : jdbc.queryForList("""
            select r.id, r.review_no, r.created_by, u.full_name from training_personnel_reviews r join app_users u on u.id = r.person_user_id
             where r.status = 'OPEN' and r.created_at < now() - make_interval(days => ?)
               and exists (select 1 from training_personnel_review_items i where i.review_id = r.id and i.status = 'PENDING')
            """, openDays)) {
            UserAccount opener = row.get("created_by") == null ? null : users.findById((UUID) row.get("created_by")).orElse(null);
            if (opener == null) continue;
            notifier.send("TRAINING_REVIEW_OPEN_DUE", opener, null, "Training: a review still has items to do",
                    "The training review " + row.get("review_no") + " of " + row.get("full_name") + " has been open for more than " + openDays + " day(s) and still has items to do.",
                    "TRAINING_PERSONNEL_REVIEW", (UUID) row.get("id"), "review-open-due:" + row.get("id") + ":" + weekOf(today));
            count++;
        }
        return count;
    }

    /**
     * SOP.0003 5.3.7: the results go to QA within the days of Training Properties, counted from the day the last session was held. The morning of the last day the organizer is reminded;
     * after it, once a week while the results have not been sent.
     */
    private int resultsReminders(LocalDate today) {
        Map<String, Object> limit = jdbc.queryForMap("select results_due_days, results_due_day_type from training_settings where id = 1");
        int days = ((Number) limit.get("results_due_days")).intValue();
        String dayType = String.valueOf(limit.get("results_due_day_type"));
        String week = today.get(IsoFields.WEEK_BASED_YEAR) + "-W" + today.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR);
        int count = 0;
        for (Map<String, Object> row : jdbc.queryForList("""
            select a.id, a.training_number, training_activity_topics(a.id) as training_topics, a.created_by, max(s.held_on) as held_on
              from training_activities a join training_sessions s on s.activity_id = a.id and s.status = 'PLANNED' and s.held_on is not null
             where a.status = 'IN_PROGRESS' and a.created_by is not null
             group by a.id, a.training_number, training_activity_topics(a.id), a.created_by
            """)) {
            // the due day counts only the working days of the setting (SOP.0003 5.3.7)
            LocalDate dueOn = TrainingWorkingDays.add(((java.sql.Date) row.get("held_on")).toLocalDate(), days, dayType);
            if (dueOn.isAfter(today)) continue;
            row.put("due_on", java.sql.Date.valueOf(dueOn));
            UserAccount organizer = users.findById((UUID) row.get("created_by")).orElse(null);
            if (organizer == null) continue;
            boolean dueToday = today.equals(dueOn);
            notifier.send(dueToday ? "TRAINING_RESULTS_DUE_TODAY" : "TRAINING_RESULTS_LATE", organizer, null,
                    dueToday ? "Training: send the results to QA today" : "Training: the results for QA are late",
                    "The results of " + row.get("training_number") + " (" + row.get("training_topics") + ") " + (dueToday ? "are due to QA today" : "were due to QA on " + com.eqms.util.DateTimeFormatUtils.display(row.get("due_on")) + " and have not been sent")
                            + " (SOP.0003 5.3.7).",
                    "TRAINING_ACTIVITY", (UUID) row.get("id"), dueToday ? "results-due:" + row.get("id") + ":" + today : "results-late:" + row.get("id") + ":" + week);
            count++;
        }
        return count;
    }

    /** A training whose results have waited for QA for more than three days: the people who may confirm it are reminded once a week (the step has no named person). */
    private int confirmationReminders(LocalDate today) {
        int count = 0;
        for (Map<String, Object> row : jdbc.queryForList("""
            select a.id, a.training_number, training_activity_topics(a.id) as training_topics, a.organizer_department_id, a.list_prepared_by
              from training_activities a
             where a.status = 'PENDING_QA_CONFIRMATION'
               and (select max(e.occurred_at) from training_events e where e.activity_id = a.id and e.event_type = 'PENDING_QA_CONFIRMATION') < now() - interval '3 days'
            """)) {
            Set<UUID> apart = row.get("list_prepared_by") == null ? Set.of() : Set.of((UUID) row.get("list_prepared_by"));
            for (UserAccount confirmer : approvals.eligibleUsers("ACTIVITY_COMPLETE", (UUID) row.get("organizer_department_id"), apart)) {
                notifier.send("TRAINING_QA_CONFIRM_WAITING", confirmer, null, "Training: results are waiting for QA",
                        "The results of " + row.get("training_number") + " (" + row.get("training_topics") + ") have been waiting for QA to confirm for more than three days.",
                        "TRAINING_ACTIVITY", (UUID) row.get("id"), "qa-confirm-waiting:" + row.get("id") + ":" + confirmer.getId() + ":" + weekOf(today));
                count++;
            }
        }
        return count;
    }
}
