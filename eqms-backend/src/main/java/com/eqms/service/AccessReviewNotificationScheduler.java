package com.eqms.service;

import com.eqms.entity.AccessReviewCampaign;
import com.eqms.entity.UserAccount;
import com.eqms.repository.AccessReviewCampaignRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * NOTIFICATION_SYSTEM_REMEDIATION_PLAN.md Phase 1: {@code access_review.campaign_due} had no
 * scheduler at all before this -- an Access Review campaign's due date (`reviewPeriodEnd`) was
 * purely informational, nothing ever told the assigned reviewer it was approaching. Runs once
 * daily; matches on the exact reminder date rather than a "due within N days" range so a second
 * run on the same day (or a retry) never double-sends -- no separate "already notified" column
 * needed.
 */
@Service
public class AccessReviewNotificationScheduler {

    private static final Logger log = LoggerFactory.getLogger(AccessReviewNotificationScheduler.class);
    private static final String STATUS_IN_PROGRESS = "IN_PROGRESS";
    private static final int REMINDER_DAYS_BEFORE_DUE = 7;

    private final AccessReviewCampaignRepository campaignRepository;
    private final NotificationDispatcher notificationDispatcher;
    private final DistributedSchedulerLockService schedulerLockService;

    public AccessReviewNotificationScheduler(
            AccessReviewCampaignRepository campaignRepository,
            NotificationDispatcher notificationDispatcher,
            DistributedSchedulerLockService schedulerLockService
    ) {
        this.campaignRepository = campaignRepository;
        this.notificationDispatcher = notificationDispatcher;
        this.schedulerLockService = schedulerLockService;
    }

    @Scheduled(cron = "0 0 3 * * *")
    @Transactional
    public void notifyCampaignsDueSoon() {
        try (var lease = schedulerLockService.tryAcquire("access-review-campaign-due", Duration.ofMinutes(15))) {
            if (!lease.acquired()) {
                log.warn("Skipping access-review campaign-due scheduler because another instance owns the lease or Redis is unavailable");
                return;
            }
            LocalDate reminderTarget = LocalDate.now().plusDays(REMINDER_DAYS_BEFORE_DUE);
            List<AccessReviewCampaign> dueSoon = campaignRepository.findAllByStatusAndReviewPeriodEnd(STATUS_IN_PROGRESS, reminderTarget);
            for (AccessReviewCampaign campaign : dueSoon) {
                UserAccount reviewer = campaign.getReviewer();
                if (reviewer == null) {
                    log.warn("Access review campaign '{}' ({}) has no assigned reviewer -- skipping due-soon notification.",
                            campaign.getName(), campaign.getId());
                    continue;
                }
                notificationDispatcher.dispatch(
                        "access_review.campaign_due",
                        List.of(reviewer),
                        Map.of(
                                "campaignName", campaign.getName() == null ? "" : campaign.getName(),
                                "dueDate", campaign.getReviewPeriodEnd() == null ? "" : campaign.getReviewPeriodEnd().toString()
                        )
                );
            }
        } catch (Exception e) {
            log.error("Access review campaign due-soon notification run failed", e);
        }
    }
}
