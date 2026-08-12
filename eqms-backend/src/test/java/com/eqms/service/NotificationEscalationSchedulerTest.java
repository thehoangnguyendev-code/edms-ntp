package com.eqms.service;

import com.eqms.entity.NotificationPolicy;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserNotification;
import com.eqms.repository.NotificationPolicyRepository;
import com.eqms.repository.UserNotificationRepository;
import com.eqms.service.DistributedSchedulerLockService.SchedulerLease;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * NOTIFICATION_SYSTEM_REMEDIATION_PLAN.md Phase 2: escalation config was schema+API-complete
 * with zero execution logic before this scheduler existed.
 */
@ExtendWith(MockitoExtension.class)
class NotificationEscalationSchedulerTest {

    @Mock private UserNotificationRepository userNotificationRepository;
    @Mock private NotificationPolicyRepository policyRepository;
    @Mock private NotificationDispatcher notificationDispatcher;
    @Mock private DistributedSchedulerLockService schedulerLockService;

    private NotificationEscalationScheduler scheduler;
    private UserAccount escalationTarget;

    @BeforeEach
    void setUp() {
        scheduler = new NotificationEscalationScheduler(
                userNotificationRepository, policyRepository, notificationDispatcher, schedulerLockService);

        SchedulerLease lease = mock(SchedulerLease.class);
        lenient().when(lease.acquired()).thenReturn(true);
        lenient().when(schedulerLockService.tryAcquire(eq("notification-escalation"), any())).thenReturn(lease);

        escalationTarget = new UserAccount();
        escalationTarget.setId(UUID.randomUUID());
    }

    private UserNotification notification(String type, Instant createdAt) {
        UserNotification notification = new UserNotification();
        notification.setId(UUID.randomUUID());
        notification.setType(type);
        notification.setStatus(UserNotification.STATUS_UNREAD);
        notification.setMetadata(new ObjectMapper().createObjectNode().put("recipientName", "Nguyen Van A"));
        notification.setCreatedAt(createdAt);
        return notification;
    }

    private NotificationPolicy escalationEnabledPolicy(int afterMinutes) {
        NotificationPolicy policy = new NotificationPolicy();
        policy.setEventCode("test.event");
        policy.setEscalationEnabled(true);
        policy.setEscalationAfterMinutes(afterMinutes);
        policy.setEscalationRecipientRules(new ObjectMapper().createArrayNode().add(
                new ObjectMapper().createObjectNode().put("type", "ALL_USERS")));
        return policy;
    }

    @Test
    void overdueUnreadNotification_escalationEnabled_dispatchesToResolvedAudience() {
        UserNotification notification = notification("test.event", Instant.now().minusSeconds(3600));
        when(userNotificationRepository.findAllByStatusIgnoreCaseAndEscalatedAtIsNullAndDeletedAtIsNull(
                UserNotification.STATUS_UNREAD)).thenReturn(List.of(notification));
        when(policyRepository.findByEventCode("test.event")).thenReturn(Optional.of(escalationEnabledPolicy(30)));
        when(notificationDispatcher.resolveRecipients(any(), eq(List.of()))).thenReturn(List.of(escalationTarget));

        scheduler.escalateOverdueUnread();

        verify(notificationDispatcher).dispatch(eq("test.event"), eq(List.of(escalationTarget)), any());
        assertThat(notification.getEscalatedAt()).isNotNull();
    }

    @Test
    void notYetOverdue_doesNotEscalate() {
        UserNotification notification = notification("test.event", Instant.now().minusSeconds(60)); // 1 min old
        when(userNotificationRepository.findAllByStatusIgnoreCaseAndEscalatedAtIsNullAndDeletedAtIsNull(
                UserNotification.STATUS_UNREAD)).thenReturn(List.of(notification));
        when(policyRepository.findByEventCode("test.event")).thenReturn(Optional.of(escalationEnabledPolicy(30)));

        scheduler.escalateOverdueUnread();

        verify(notificationDispatcher, never()).dispatch(any(), any(), any());
        assertThat(notification.getEscalatedAt()).isNull();
    }

    @Test
    void escalationNotEnabledForPolicy_skipsWithoutDispatch() {
        UserNotification notification = notification("test.event", Instant.now().minusSeconds(3600));
        when(userNotificationRepository.findAllByStatusIgnoreCaseAndEscalatedAtIsNullAndDeletedAtIsNull(
                UserNotification.STATUS_UNREAD)).thenReturn(List.of(notification));
        NotificationPolicy policy = new NotificationPolicy();
        policy.setEventCode("test.event");
        policy.setEscalationEnabled(false);
        when(policyRepository.findByEventCode("test.event")).thenReturn(Optional.of(policy));

        scheduler.escalateOverdueUnread();

        verify(notificationDispatcher, never()).dispatch(any(), any(), any());
    }

    @Test
    void lockNotAcquired_skipsWithoutQuerying() {
        SchedulerLease lease = mock(SchedulerLease.class);
        when(lease.acquired()).thenReturn(false);
        when(schedulerLockService.tryAcquire(eq("notification-escalation"), any())).thenReturn(lease);

        scheduler.escalateOverdueUnread();

        verify(userNotificationRepository, never()).findAllByStatusIgnoreCaseAndEscalatedAtIsNullAndDeletedAtIsNull(any());
    }
}
