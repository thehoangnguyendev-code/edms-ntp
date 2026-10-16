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

    public TrainingReminderScheduler(JdbcTemplate jdbc, UserAccountRepository users, TrainingNotifier notifier, DistributedSchedulerLockService locks) {
        this.jdbc = jdbc;
        this.users = users;
        this.notifier = notifier;
        this.locks = locks;
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
        return sent;
    }

    private int dueSoon(LocalDate today) {
        int count = 0;
        List<Map<String, Object>> rows = jdbc.queryForList("""
            select distinct a.id, a.training_number, a.title, a.due_date, p.person_user_id
              from training_activities a join training_participants p on p.activity_id = a.id
             where a.status in ('NOTIFIED','IN_PROGRESS') and a.due_date between ? and ? and p.person_user_id is not null and p.state = 'INVITED'
            """, today, today.plusDays(3));
        for (Map<String, Object> row : rows) {
            UserAccount person = users.findById((UUID) row.get("person_user_id")).orElse(null);
            if (person == null) continue;
            notifier.send("TRAINING_DUE_SOON", person, null, "Training: due soon",
                    "The training " + row.get("training_number") + " (" + row.get("title") + ") is due on " + row.get("due_date") + ".", "TRAINING_ACTIVITY", (UUID) row.get("id"), "due-soon:" + today);
            count++;
        }
        return count;
    }

    private int overdue(LocalDate today) {
        int count = 0;
        String week = today.get(IsoFields.WEEK_BASED_YEAR) + "-W" + today.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR);
        List<Map<String, Object>> rows = jdbc.queryForList("""
            select id, training_number, title, due_date, created_by from training_activities
             where status in ('PLANNED','NOTIFIED','IN_PROGRESS','PENDING_QA_CONFIRMATION') and due_date < ? and created_by is not null
            """, today);
        for (Map<String, Object> row : rows) {
            UserAccount organizer = users.findById((UUID) row.get("created_by")).orElse(null);
            if (organizer == null) continue;
            notifier.send("TRAINING_OVERDUE", organizer, null, "Training: overdue",
                    "The training " + row.get("training_number") + " (" + row.get("title") + ") was due on " + row.get("due_date") + " and is not completed.", "TRAINING_ACTIVITY", (UUID) row.get("id"), "overdue:" + week);
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
}
