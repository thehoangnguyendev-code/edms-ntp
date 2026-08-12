package com.eqms.service;

import com.eqms.entity.NotificationDispatchQueue;
import com.eqms.entity.NotificationEventDefinition;
import com.eqms.entity.NotificationPolicy;
import com.eqms.entity.NotificationTemplateVersion;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.NotificationDispatchQueueRepository;
import com.eqms.repository.NotificationEventDefinitionRepository;
import com.eqms.repository.NotificationPolicyRepository;
import com.eqms.repository.NotificationTemplateVersionRepository;
import com.eqms.repository.UserAccountRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalTime;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * NOTIFICATION_SYSTEM_REMEDIATION_PLAN.md Phase 2: DAILY_DIGEST/WEEKLY_DIGEST/quiet-hours were
 * schema+API-complete but had zero execution logic before this -- an admin's setting had no
 * observable effect. Covers {@link NotificationDispatcher}'s deferral decision (queue vs send
 * now); {@code NotificationDigestSchedulerTest} covers the consumer side.
 */
@ExtendWith(MockitoExtension.class)
class NotificationDispatcherDigestDeferralTest {

    @Mock private NotificationEventDefinitionRepository eventRepository;
    @Mock private NotificationPolicyRepository policyRepository;
    @Mock private NotificationTemplateVersionRepository templateVersionRepository;
    @Mock private NotificationService notificationService;
    @Mock private UserAccountRepository userAccountRepository;
    @Mock private PermissionEvaluationService permissionEvaluationService;
    @Mock private EmailNotificationService emailNotificationService;
    @Mock private NotificationDispatchQueueRepository dispatchQueueRepository;

    private NotificationDispatcher dispatcher;
    private UserAccount recipient;
    private NotificationPolicy policy;

    @BeforeEach
    void setUp() {
        dispatcher = new NotificationDispatcher(
                eventRepository, policyRepository, templateVersionRepository, notificationService,
                userAccountRepository, permissionEvaluationService, new ObjectMapper(), emailNotificationService,
                dispatchQueueRepository);

        recipient = new UserAccount();
        recipient.setId(UUID.randomUUID());
        recipient.setFullName("Nguyen Van A");
        recipient.setEmail("a@example.local");
        recipient.setEmailNotificationsEnabled(true);
        recipient.setStatus(UserStatus.Active);

        policy = new NotificationPolicy();
        policy.setId(UUID.randomUUID());
        policy.setEventCode("test.event");
        policy.setStatus(NotificationPolicy.STATUS_ACTIVE);
        policy.setEnabledChannels("EMAIL");
        ArrayNode rules = new ObjectMapper().createArrayNode();
        rules.addObject().put("type", "AFFECTED_USERS");
        policy.setRecipientRules(rules);
    }

    private NotificationEventDefinition event(boolean mandatory) {
        NotificationEventDefinition event = new NotificationEventDefinition();
        event.setCode("test.event");
        event.setModule("Security");
        event.setMandatory(mandatory);
        event.setActive(true);
        return event;
    }

    private NotificationTemplateVersion emailVersion() {
        NotificationTemplateVersion version = new NotificationTemplateVersion();
        version.setChannel(NotificationTemplateVersion.CHANNEL_EMAIL);
        version.setStatus(NotificationTemplateVersion.STATUS_ACTIVE);
        version.setSubject("Subject");
        version.setBody("Body");
        return version;
    }

    private void stubTemplates() {
        when(templateVersionRepository.findFirstByPolicy_IdAndChannelAndStatusOrderByVersionNumberDesc(
                policy.getId(), NotificationTemplateVersion.CHANNEL_EMAIL, NotificationTemplateVersion.STATUS_ACTIVE))
                .thenReturn(Optional.of(emailVersion()));
        when(eventRepository.findByCode("test.event")).thenReturn(Optional.of(event(false)));
        when(policyRepository.findByEventCode("test.event")).thenReturn(Optional.of(policy));
    }

    @Test
    void immediateDigest_noQuietHours_sendsNow() {
        policy.setDigestMode(NotificationPolicy.DIGEST_IMMEDIATE);
        stubTemplates();

        dispatcher.dispatch("test.event", List.of(recipient), Map.of());

        verify(emailNotificationService).sendRenderedEmailWithTracking(
                eq("a@example.local"), any(), any(), eq("test.event"), any(), any());
        verify(dispatchQueueRepository, never()).save(any());
    }

    @Test
    void dailyDigest_queuesInsteadOfSendingNow() {
        policy.setDigestMode(NotificationPolicy.DIGEST_DAILY);
        stubTemplates();

        dispatcher.dispatch("test.event", List.of(recipient), Map.of());

        verify(emailNotificationService, never()).sendRenderedEmailWithTracking(
                any(), any(), any(), any(), any(), any());
        ArgumentCaptor<NotificationDispatchQueue> captor = ArgumentCaptor.forClass(NotificationDispatchQueue.class);
        verify(dispatchQueueRepository).save(captor.capture());
        NotificationDispatchQueue queued = captor.getValue();
        assertThat(queued.getChannel()).isEqualTo(NotificationTemplateVersion.CHANNEL_EMAIL);
        assertThat(queued.getRecipient()).isEqualTo(recipient);
        assertThat(queued.getScheduledFor()).isAfter(java.time.Instant.now());
    }

    @Test
    void weeklyDigest_queuesForNextMonday() {
        policy.setDigestMode(NotificationPolicy.DIGEST_WEEKLY);
        stubTemplates();

        dispatcher.dispatch("test.event", List.of(recipient), Map.of());

        ArgumentCaptor<NotificationDispatchQueue> captor = ArgumentCaptor.forClass(NotificationDispatchQueue.class);
        verify(dispatchQueueRepository).save(captor.capture());
        ZonedDateTime scheduled = captor.getValue().getScheduledFor().atZone(java.time.ZoneId.systemDefault());
        assertThat(scheduled.getDayOfWeek()).isEqualTo(java.time.DayOfWeek.MONDAY);
        assertThat(scheduled.toLocalTime()).isEqualTo(LocalTime.of(8, 0));
    }

    @Test
    void quietHoursCoveringAllDay_queuesForEndOfWindow() {
        policy.setDigestMode(NotificationPolicy.DIGEST_IMMEDIATE);
        policy.setQuietHoursStart("00:00");
        policy.setQuietHoursEnd("23:59");
        stubTemplates();

        dispatcher.dispatch("test.event", List.of(recipient), Map.of());

        verify(emailNotificationService, never()).sendRenderedEmailWithTracking(
                any(), any(), any(), any(), any(), any());
        verify(dispatchQueueRepository).save(any(NotificationDispatchQueue.class));
    }

    @Test
    void mandatoryEvent_ignoresDigestMode_sendsImmediately() {
        policy.setDigestMode(NotificationPolicy.DIGEST_DAILY);
        when(templateVersionRepository.findFirstByPolicy_IdAndChannelAndStatusOrderByVersionNumberDesc(
                policy.getId(), NotificationTemplateVersion.CHANNEL_EMAIL, NotificationTemplateVersion.STATUS_ACTIVE))
                .thenReturn(Optional.of(emailVersion()));
        when(eventRepository.findByCode("test.event")).thenReturn(Optional.of(event(true)));
        when(policyRepository.findByEventCode("test.event")).thenReturn(Optional.of(policy));

        dispatcher.dispatch("test.event", List.of(recipient), Map.of());

        verify(emailNotificationService).sendRenderedEmailWithTracking(
                eq("a@example.local"), any(), any(), eq("test.event"), any(), any());
        verify(dispatchQueueRepository, never()).save(any());
    }
}
