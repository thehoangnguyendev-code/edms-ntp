package com.eqms.service;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.UserAccountRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Reminds the holder and Document Control that a printed controlled copy that was recalled has not been destroyed: seven days after the recall
 * ({@link #DAYS_UNTIL_OVERDUE}) and then every seven days until the destruction is recorded (decision of 2026-11-12: the system had no state or reminder for it).
 * The notice is the registry event {@code controlled_copy.recall_overdue}; the people are its recipient rules (the holder as the recipient the module names, and
 * the holders of the recall permission). A copy is claimed (recall_overdue_notified_at) before it is notified, so a copy is reminded once for each week.
 */
@Service
public class ControlledCopyRecallOverdueScheduler {
    private static final Logger log = LoggerFactory.getLogger(ControlledCopyRecallOverdueScheduler.class);
    static final int DAYS_UNTIL_OVERDUE = 7;

    private final JdbcTemplate jdbc;
    private final UserAccountRepository users;
    private final NotificationDispatcher dispatcher;
    private final DistributedSchedulerLockService lockService;

    public ControlledCopyRecallOverdueScheduler(JdbcTemplate jdbc, UserAccountRepository users, NotificationDispatcher dispatcher, DistributedSchedulerLockService lockService) {
        this.jdbc = jdbc;
        this.users = users;
        this.dispatcher = dispatcher;
        this.lockService = lockService;
    }

    @Scheduled(cron = "0 45 6 * * *", zone = "Asia/Ho_Chi_Minh")
    public void remind() {
        try (var lease = lockService.tryAcquire("controlled-copy-recall-overdue", Duration.ofMinutes(10))) {
            if (!lease.acquired()) return;
            run();
        } catch (Exception failure) {
            log.warn("Overdue recalls were not reminded this time: {}", failure.getMessage());
        }
    }

    /** One pass; returns how many copies were reminded. */
    int run() {
        List<Map<String, Object>> overdue = jdbc.queryForList("""
                select id, controlled_copy_number, document_number, document_title, recipient_user_id, recalled_at
                from controlled_copies
                where recalled_at is not null and destroyed_at is null and print_count > 0
                  and recalled_at < now() - make_interval(days => ?)
                  and (recall_overdue_notified_at is null or recall_overdue_notified_at < now() - make_interval(days => ?))
                order by recalled_at limit 500
                """, DAYS_UNTIL_OVERDUE, DAYS_UNTIL_OVERDUE);
        int reminded = 0;
        for (Map<String, Object> row : overdue) {
            UUID id = (UUID) row.get("id");
            int claimed = jdbc.update("""
                    update controlled_copies set recall_overdue_notified_at = now() where id = ?
                      and (recall_overdue_notified_at is null or recall_overdue_notified_at < now() - make_interval(days => ?))
                    """, id, DAYS_UNTIL_OVERDUE);
            if (claimed != 1) continue;
            try {
                UUID holderId = (UUID) row.get("recipient_user_id");
                UserAccount holder = holderId == null ? null : users.findById(holderId).filter(u -> u.getStatus() == UserStatus.Active).orElse(null);
                String number = String.valueOf(row.get("controlled_copy_number"));
                String document = row.get("document_number") == null ? "" : " (" + row.get("document_number") + ")";
                Map<String, String> variables = NotificationDispatcher.noticeVariables("Recalled copy not returned: " + number,
                        "The controlled copy " + number + document + " was recalled on " + com.eqms.util.DateTimeFormatUtils.formatDate(row.get("recalled_at"))
                                + " and its destruction is not recorded. Return the printed copy to Document Control.", "/controlled-copies");
                variables.put("controlledCopyNumber", number);
                dispatcher.dispatchIndependently(OperationalNotificationEvents.RECALL_OVERDUE, holder == null ? List.of() : List.of(holder), variables);
                reminded++;
            } catch (RuntimeException failure) {
                log.warn("The overdue recall of the copy {} could not be notified: {}", id, failure.getMessage());
            }
        }
        return reminded;
    }
}
