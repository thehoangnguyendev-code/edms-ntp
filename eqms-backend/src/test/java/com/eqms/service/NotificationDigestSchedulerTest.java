package com.eqms.service;

import com.eqms.entity.NotificationDispatchQueue;
import com.eqms.entity.UserAccount;
import com.eqms.repository.NotificationDispatchQueueRepository;
import com.eqms.service.DistributedSchedulerLockService.SchedulerLease;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * NOTIFICATION_SYSTEM_REMEDIATION_PLAN.md Phase 2: consumer side of the digest/quiet-hours
 * deferral queue. See {@code NotificationDispatcherDigestDeferralTest} for the producer side
 * (deciding whether to queue at all).
 */
@ExtendWith(MockitoExtension.class)
class NotificationDigestSchedulerTest {

    @Mock private NotificationDispatchQueueRepository queueRepository;
    @Mock private EmailNotificationService emailNotificationService;
    @Mock private DistributedSchedulerLockService schedulerLockService;

    private NotificationDigestScheduler scheduler;
    private UserAccount recipient;

    @BeforeEach
    void setUp() {
        scheduler = new NotificationDigestScheduler(queueRepository, emailNotificationService, schedulerLockService);
        recipient = new UserAccount();
        recipient.setId(UUID.randomUUID());
        recipient.setEmail("a@example.local");
        recipient.setEmailNotificationsEnabled(true);

        SchedulerLease lease = mock(SchedulerLease.class);
        org.mockito.Mockito.lenient().when(lease.acquired()).thenReturn(true);
        org.mockito.Mockito.lenient().when(schedulerLockService.tryAcquire(eq("notification-digest"), any())).thenReturn(lease);
    }

    private NotificationDispatchQueue queuedItem(String subject, String body) {
        NotificationDispatchQueue item = new NotificationDispatchQueue();
        item.setRecipient(recipient);
        item.setChannel("EMAIL");
        item.setEventCode("test.event");
        item.setRenderedSubject(subject);
        item.setRenderedBody(body);
        item.setScheduledFor(Instant.now().minusSeconds(60));
        item.setStatus(NotificationDispatchQueue.STATUS_PENDING);
        return item;
    }

    @Test
    void singleQueuedItem_sendsWithOriginalSubject() {
        NotificationDispatchQueue item = queuedItem("Original subject", "Body content");
        when(queueRepository.findAllByStatusAndScheduledForLessThanEqualOrderByScheduledForAsc(
                eq(NotificationDispatchQueue.STATUS_PENDING), any())).thenReturn(List.of(item));
        when(emailNotificationService.sendRenderedEmailWithTracking(
                eq("a@example.local"), eq("Original subject"), any(), any(), any(), any())).thenReturn(true);

        scheduler.sendDueDigests();

        verify(emailNotificationService).sendRenderedEmailWithTracking(
                eq("a@example.local"), eq("Original subject"), any(), any(), any(), any());
        assertThat(item.getStatus()).isEqualTo(NotificationDispatchQueue.STATUS_SENT);
    }

    @Test
    void multipleQueuedItemsSameRecipient_combinedIntoOneEmail() {
        NotificationDispatchQueue item1 = queuedItem("Subject 1", "Body 1");
        NotificationDispatchQueue item2 = queuedItem("Subject 2", "Body 2");
        when(queueRepository.findAllByStatusAndScheduledForLessThanEqualOrderByScheduledForAsc(
                eq(NotificationDispatchQueue.STATUS_PENDING), any())).thenReturn(List.of(item1, item2));
        when(emailNotificationService.sendRenderedEmailWithTracking(
                any(), any(), any(), any(), any(), any())).thenReturn(true);

        scheduler.sendDueDigests();

        ArgumentCaptor<String> subjectCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> bodyCaptor = ArgumentCaptor.forClass(String.class);
        verify(emailNotificationService).sendRenderedEmailWithTracking(
                eq("a@example.local"), subjectCaptor.capture(), bodyCaptor.capture(), any(), any(), any());
        assertThat(subjectCaptor.getValue()).contains("2");
        assertThat(bodyCaptor.getValue()).contains("Body 1").contains("Body 2");
        assertThat(item1.getStatus()).isEqualTo(NotificationDispatchQueue.STATUS_SENT);
        assertThat(item2.getStatus()).isEqualTo(NotificationDispatchQueue.STATUS_SENT);
    }

    @Test
    void sendFails_marksItemsFailedNotSent() {
        NotificationDispatchQueue item = queuedItem("Subject", "Body");
        when(queueRepository.findAllByStatusAndScheduledForLessThanEqualOrderByScheduledForAsc(
                eq(NotificationDispatchQueue.STATUS_PENDING), any())).thenReturn(List.of(item));
        when(emailNotificationService.sendRenderedEmailWithTracking(
                any(), any(), any(), any(), any(), any())).thenReturn(false);

        scheduler.sendDueDigests();

        assertThat(item.getStatus()).isEqualTo(NotificationDispatchQueue.STATUS_FAILED);
    }

    @Test
    void noQueuedItems_doesNothing() {
        when(queueRepository.findAllByStatusAndScheduledForLessThanEqualOrderByScheduledForAsc(
                eq(NotificationDispatchQueue.STATUS_PENDING), any())).thenReturn(List.of());

        scheduler.sendDueDigests();

        verify(emailNotificationService, never()).sendRenderedEmailWithTracking(any(), any(), any(), any(), any(), any());
    }

    @Test
    void lockNotAcquired_skipsWithoutQuerying() {
        SchedulerLease lease = mock(SchedulerLease.class);
        when(lease.acquired()).thenReturn(false);
        when(schedulerLockService.tryAcquire(eq("notification-digest"), any())).thenReturn(lease);

        scheduler.sendDueDigests();

        verify(queueRepository, never()).findAllByStatusAndScheduledForLessThanEqualOrderByScheduledForAsc(any(), any());
    }
}
