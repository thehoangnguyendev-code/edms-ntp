package com.eqms.service;

import com.eqms.entity.AccessReviewCampaign;
import com.eqms.entity.UserAccount;
import com.eqms.repository.AccessReviewCampaignRepository;
import com.eqms.service.DistributedSchedulerLockService.SchedulerLease;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * NOTIFICATION_SYSTEM_REMEDIATION_PLAN.md Phase 1: {@code access_review.campaign_due} previously
 * had zero scheduler anywhere -- a campaign's due date was purely informational. Covers the new
 * {@link AccessReviewNotificationScheduler} in isolation (cluster-lock acquisition, exact-date
 * matching, missing-reviewer skip) since exercising it live requires a campaign whose due date
 * lands on the real current date.
 */
@ExtendWith(MockitoExtension.class)
class AccessReviewNotificationSchedulerTest {

    @Mock private AccessReviewCampaignRepository campaignRepository;
    @Mock private NotificationDispatcher notificationDispatcher;
    @Mock private DistributedSchedulerLockService schedulerLockService;

    private AccessReviewNotificationScheduler scheduler;

    private AccessReviewNotificationScheduler newScheduler() {
        return new AccessReviewNotificationScheduler(campaignRepository, notificationDispatcher, schedulerLockService);
    }

    private void stubAcquiredLease() {
        SchedulerLease lease = mock(SchedulerLease.class);
        when(lease.acquired()).thenReturn(true);
        when(schedulerLockService.tryAcquire(eq("access-review-campaign-due"), any())).thenReturn(lease);
    }

    @Test
    void campaignDueInSevenDays_withReviewer_dispatchesNotification() {
        stubAcquiredLease();
        UserAccount reviewer = new UserAccount();
        reviewer.setId(UUID.randomUUID());
        reviewer.setFullName("Reviewer One");

        AccessReviewCampaign campaign = new AccessReviewCampaign();
        campaign.setName("Q3 Access Review");
        campaign.setReviewPeriodEnd(LocalDate.now().plusDays(7));
        campaign.setReviewer(reviewer);

        when(campaignRepository.findAllByStatusAndReviewPeriodEnd(eq("IN_PROGRESS"), eq(LocalDate.now().plusDays(7))))
                .thenReturn(List.of(campaign));

        scheduler = newScheduler();
        scheduler.notifyCampaignsDueSoon();

        verify(notificationDispatcher).dispatch(eq("access_review.campaign_due"), eq(List.of(reviewer)), any(Map.class));
    }

    @Test
    void campaignWithoutReviewer_skipsWithoutError() {
        stubAcquiredLease();
        AccessReviewCampaign campaign = new AccessReviewCampaign();
        campaign.setName("Orphaned Campaign");
        campaign.setReviewPeriodEnd(LocalDate.now().plusDays(7));
        campaign.setReviewer(null);

        when(campaignRepository.findAllByStatusAndReviewPeriodEnd(eq("IN_PROGRESS"), eq(LocalDate.now().plusDays(7))))
                .thenReturn(List.of(campaign));

        scheduler = newScheduler();
        scheduler.notifyCampaignsDueSoon();

        verify(notificationDispatcher, never()).dispatch(any(), any(), any());
    }

    @Test
    void lockNotAcquired_skipsWithoutQuerying() {
        SchedulerLease lease = mock(SchedulerLease.class);
        when(lease.acquired()).thenReturn(false);
        when(schedulerLockService.tryAcquire(eq("access-review-campaign-due"), any())).thenReturn(lease);

        scheduler = newScheduler();
        scheduler.notifyCampaignsDueSoon();

        verify(campaignRepository, never()).findAllByStatusAndReviewPeriodEnd(any(), any());
    }
}
