package com.eqms.service;

import com.eqms.entity.NotificationEventDefinition;
import com.eqms.entity.NotificationPolicy;
import com.eqms.entity.NotificationTemplateVersion;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.NotificationEventDefinitionRepository;
import com.eqms.repository.NotificationPolicyRepository;
import com.eqms.repository.NotificationTemplateVersionRepository;
import com.eqms.repository.UserAccountRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Phase 0 of NOTIFICATION_SYSTEM_REMEDIATION_PLAN.md: {@link NotificationDispatcher} gained a
 * real EMAIL-channel branch (previously IN_APP only, per the V255/V257 "in-app only" descope).
 * These tests cover the new branch specifically -- IN_APP behavior is unchanged and already
 * implicitly exercised elsewhere (ControlledCopyService's two live dispatch() call sites).
 */
@ExtendWith(MockitoExtension.class)
class NotificationDispatcherEmailChannelTest {

    @Mock private NotificationEventDefinitionRepository eventRepository;
    @Mock private NotificationPolicyRepository policyRepository;
    @Mock private NotificationTemplateVersionRepository templateVersionRepository;
    @Mock private NotificationService notificationService;
    @Mock private UserAccountRepository userAccountRepository;
    @Mock private PermissionEvaluationService permissionEvaluationService;
    @Mock private EmailNotificationService emailNotificationService;
    @Mock private com.eqms.repository.NotificationDispatchQueueRepository dispatchQueueRepository;

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
        recipient.setStatus(UserStatus.Active);
        recipient.setFullName("Nguyen Van A");
        recipient.setEmail("a@example.local");
        recipient.setEmailNotificationsEnabled(true);

        policy = new NotificationPolicy();
        policy.setId(UUID.randomUUID());
        policy.setEventCode("test.event");
        policy.setStatus(NotificationPolicy.STATUS_ACTIVE);
        policy.setEnabledChannels("IN_APP,EMAIL");
        ArrayNode rules = new ObjectMapper().createArrayNode();
        rules.addObject().put("type", "AFFECTED_USERS");
        policy.setRecipientRules(rules);
    }

    private NotificationEventDefinition event(boolean mandatory) {
        NotificationEventDefinition event = new NotificationEventDefinition();
        event.setCode("test.event");
        event.setModule("Security");
        event.setPriority("HIGH");
        event.setMandatory(mandatory);
        event.setActive(true);
        return event;
    }

    private NotificationTemplateVersion emailVersion() {
        NotificationTemplateVersion version = new NotificationTemplateVersion();
        version.setChannel(NotificationTemplateVersion.CHANNEL_EMAIL);
        version.setStatus(NotificationTemplateVersion.STATUS_ACTIVE);
        version.setSubject("Hello {{recipientName}}");
        version.setBody("<p>Body for {{recipientName}}</p>");
        return version;
    }

    private void stubActiveVersions(NotificationTemplateVersion emailVersion) {
        when(templateVersionRepository.findFirstByPolicy_IdAndChannelAndStatusOrderByVersionNumberDesc(
                policy.getId(), NotificationTemplateVersion.CHANNEL_IN_APP, NotificationTemplateVersion.STATUS_ACTIVE))
                .thenReturn(Optional.empty());
        when(templateVersionRepository.findFirstByPolicy_IdAndChannelAndStatusOrderByVersionNumberDesc(
                policy.getId(), NotificationTemplateVersion.CHANNEL_EMAIL, NotificationTemplateVersion.STATUS_ACTIVE))
                .thenReturn(Optional.ofNullable(emailVersion));
    }

    @Test
    void optionalEvent_recipientEmailEnabled_sendsRenderedEmail() {
        when(eventRepository.findByCode("test.event")).thenReturn(Optional.of(event(false)));
        when(policyRepository.findByEventCode("test.event")).thenReturn(Optional.of(policy));
        stubActiveVersions(emailVersion());

        dispatcher.dispatch("test.event", List.of(recipient), Map.of());

        verify(emailNotificationService).sendRenderedEmailWithTracking(
                eq("a@example.local"), eq("Hello Nguyen Van A"), eq("<p>Body for Nguyen Van A</p>"),
                eq("test.event"), eq("Security"), any());
    }

    @Test
    void recipientEmailNotificationsDisabled_optionalEvent_doesNotSendEmail() {
        recipient.setEmailNotificationsEnabled(false);
        when(eventRepository.findByCode("test.event")).thenReturn(Optional.of(event(false)));
        when(policyRepository.findByEventCode("test.event")).thenReturn(Optional.of(policy));
        stubActiveVersions(emailVersion());

        dispatcher.dispatch("test.event", List.of(recipient), Map.of());

        verify(emailNotificationService, never()).sendRenderedEmailWithTracking(
                anyString(), anyString(), anyString(), anyString(), anyString(), any());
    }

    @Test
    void mandatoryEvent_bypassesEmailPreference() {
        recipient.setEmailNotificationsEnabled(true);
        when(eventRepository.findByCode("test.event")).thenReturn(Optional.of(event(true)));
        when(policyRepository.findByEventCode("test.event")).thenReturn(Optional.of(policy));
        stubActiveVersions(emailVersion());

        dispatcher.dispatch("test.event", List.of(recipient), Map.of());

        verify(emailNotificationService).sendRenderedEmailWithTracking(
                eq("a@example.local"), anyString(), anyString(), eq("test.event"), anyString(), any());
    }

    @Test
    void noActiveEmailVersion_noEmailSent() {
        when(eventRepository.findByCode("test.event")).thenReturn(Optional.of(event(false)));
        when(policyRepository.findByEventCode("test.event")).thenReturn(Optional.of(policy));
        stubActiveVersions(null);

        dispatcher.dispatch("test.event", List.of(recipient), Map.of());

        verify(emailNotificationService, never()).sendRenderedEmailWithTracking(
                anyString(), anyString(), anyString(), anyString(), anyString(), any());
    }

    @Test
    void channelNotEnabledInPolicy_noEmailSent() {
        policy.setEnabledChannels("IN_APP");
        when(eventRepository.findByCode("test.event")).thenReturn(Optional.of(event(false)));
        when(policyRepository.findByEventCode("test.event")).thenReturn(Optional.of(policy));

        dispatcher.dispatch("test.event", List.of(recipient), Map.of());

        verify(emailNotificationService, never()).sendRenderedEmailWithTracking(
                anyString(), anyString(), anyString(), anyString(), anyString(), any());
    }
}
