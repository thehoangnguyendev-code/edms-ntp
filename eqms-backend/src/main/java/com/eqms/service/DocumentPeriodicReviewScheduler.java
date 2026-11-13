package com.eqms.service;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.UserAccountRepository;
import com.eqms.util.DateTimeFormatUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Reminds the author and the owner of an effective document that its periodic review is due. A document carries its review date and the number of days before it that the
 * people are to be told (Periodic Review Notification, in Document Properties). Two reminders are sent for each review date: when the days before it are reached, and once more
 * when the date has passed without the review. A reminder is claimed (the review date it was sent for is kept on the document) before it is sent, so two servers or two passes never
 * send it twice, and moving the review date to the next cycle starts the reminders again. The notice is the registry event {@code document.periodic_review_due}.
 */
@Service
public class DocumentPeriodicReviewScheduler {
    private static final Logger log = LoggerFactory.getLogger(DocumentPeriodicReviewScheduler.class);
    static final String EVENT = "document.periodic_review_due";

    private final JdbcTemplate jdbc;
    private final UserAccountRepository users;
    private final NotificationDispatcher dispatcher;
    private final DistributedSchedulerLockService lockService;

    public DocumentPeriodicReviewScheduler(JdbcTemplate jdbc, UserAccountRepository users, NotificationDispatcher dispatcher, DistributedSchedulerLockService lockService) {
        this.jdbc = jdbc;
        this.users = users;
        this.dispatcher = dispatcher;
        this.lockService = lockService;
    }

    @Scheduled(cron = "0 55 6 * * *", zone = "Asia/Ho_Chi_Minh")
    public void remind() {
        try (var lease = lockService.tryAcquire("document-periodic-review-reminders", Duration.ofMinutes(10))) {
            if (!lease.acquired()) return;
            run(LocalDate.now(DateTimeFormatUtils.ZONE));
        } catch (Exception failure) {
            log.warn("Periodic review reminders were not sent this time: {}", failure.getMessage());
        }
    }

    /** One pass for the given day; returns how many documents were reminded. */
    int run(LocalDate today) {
        int reminded = 0;
        // the days before the review date are reached (and the date has not passed)
        reminded += remind(today, false, """
                select id, document_number, document_name, author_user_id, owner_user_id, review_date from documents
                where status_code = 'ACTIVE' and review_date is not null
                  and review_date >= ? and review_date - coalesce(periodic_review_notification, 0) <= ?
                  and periodic_review_notified_for is distinct from review_date
                order by review_date limit 500
                """, "periodic_review_notified_for");
        // the date has passed without the review
        reminded += remind(today, true, """
                select id, document_number, document_name, author_user_id, owner_user_id, review_date from documents
                where status_code = 'ACTIVE' and review_date is not null
                  and review_date < ? and review_date < ?
                  and periodic_review_overdue_notified_for is distinct from review_date
                order by review_date limit 500
                """, "periodic_review_overdue_notified_for");
        return reminded;
    }

    private int remind(LocalDate today, boolean overdue, String query, String claimColumn) {
        int reminded = 0;
        for (Map<String, Object> row : jdbc.queryForList(query, java.sql.Date.valueOf(today), java.sql.Date.valueOf(today))) {
            UUID id = (UUID) row.get("id");
            java.sql.Date reviewDate = (java.sql.Date) row.get("review_date");
            // claimed first: the review date this reminder is for is kept on the document
            if (jdbc.update("update documents set " + claimColumn + " = ? where id = ? and " + claimColumn + " is distinct from ?", reviewDate, id, reviewDate) != 1) continue;
            try {
                LinkedHashMap<UUID, UserAccount> people = new LinkedHashMap<>();
                for (String column : List.of("author_user_id", "owner_user_id")) {
                    UUID personId = (UUID) row.get(column);
                    if (personId == null) continue;
                    users.findById(personId).filter(u -> u.getStatus() == UserStatus.Active).ifPresent(u -> people.putIfAbsent(u.getId(), u));
                }
                if (people.isEmpty()) continue;
                Map<String, String> variables = new LinkedHashMap<>();
                variables.put("documentNumber", String.valueOf(row.get("document_number")));
                variables.put("documentTitle", String.valueOf(row.get("document_name")));
                variables.put("reviewDate", DateTimeFormatUtils.formatDate(reviewDate.toLocalDate()));
                variables.put("reviewStatus", overdue ? "is overdue for periodic review since" : "is due for periodic review on");
                variables.put("actionUrl", "/documents/" + id);
                variables.put("relatedEntityType", "document");
                variables.put("relatedEntityId", id.toString());
                dispatcher.dispatchIndependently(EVENT, new java.util.ArrayList<>(people.values()), variables);
                reminded++;
            } catch (RuntimeException failure) {
                log.warn("The periodic review reminder of the document {} could not be sent: {}", id, failure.getMessage());
            }
        }
        return reminded;
    }
}
