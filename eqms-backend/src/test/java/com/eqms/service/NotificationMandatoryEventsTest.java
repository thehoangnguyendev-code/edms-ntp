package com.eqms.service;

import com.eqms.dto.notification.UpdateNotificationPolicyRequest;
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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * NOTIFICATION-ACCOUNT-EMAILS-2026-11-17: the account e-mails that carry a secret (a sign-in code, a reset link, a temporary password) are registry events that are
 * e-mail only and always sent. An administrator edits their wording and who gets them, but cannot switch them off, move them to another channel, hold them back
 * in a digest or quiet hours, or escalate them; and the dispatcher sends them at once whatever a policy that was saved earlier says.
 */
class NotificationMandatoryEventsTest {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String CODE = NotificationMandatoryEvents.MFA_LOGIN_CODE;

    private NotificationPolicyRepository policies;
    private NotificationTemplateVersionRepository versions;
    private NotificationEventDefinitionRepository events;
    private NotificationService inApp;
    private NotificationEmailOutbox outbox;
    private NotificationDispatchQueueRepository queue;
    private NotificationPolicy policy;
    private NotificationPolicyService policyService;
    private NotificationDispatcher dispatcher;
    private UserAccount person;

    @BeforeEach
    void setUp() {
        policies = mock(NotificationPolicyRepository.class);
        versions = mock(NotificationTemplateVersionRepository.class);
        events = mock(NotificationEventDefinitionRepository.class);
        inApp = mock(NotificationService.class);
        outbox = mock(NotificationEmailOutbox.class);
        queue = mock(NotificationDispatchQueueRepository.class);

        var event = new NotificationEventDefinition();
        event.setCode(CODE);
        event.setName("MFA Sign-in Code");
        event.setModule("SECURITY");
        event.setActive(true);
        event.setSupportedChannels("EMAIL");
        event.setAvailableVariables("recipientName,systemName,otpCode,expiresIn");
        policy = new NotificationPolicy();
        policy.setId(UUID.randomUUID());
        policy.setEventCode(CODE);
        policy.setStatus(NotificationPolicy.STATUS_ACTIVE);
        policy.setEnabledChannels("EMAIL");
        policy.setDigestMode(NotificationPolicy.DIGEST_IMMEDIATE);
        policy.setRecipientRules(JSON.createArrayNode().add(JSON.createObjectNode().put("type", "AFFECTED_USERS")));
        when(events.findByCode(CODE)).thenReturn(Optional.of(event));
        when(policies.findByEventCode(CODE)).thenReturn(Optional.of(policy));
        when(policies.lockByEventCode(CODE)).thenReturn(Optional.of(policy));

        var email = new NotificationTemplateVersion();
        email.setChannel(NotificationTemplateVersion.CHANNEL_EMAIL);
        email.setId(UUID.randomUUID());
        email.setStatus(NotificationTemplateVersion.STATUS_ACTIVE);
        email.setSubject("Your code {{otpCode}}");
        email.setBody("Code {{otpCode}} for {{recipientName}}");
        when(versions.findFirstByPolicy_IdAndChannelAndStatusOrderByVersionNumberDesc(policy.getId(), "EMAIL", "ACTIVE")).thenReturn(Optional.of(email));

        var users = mock(com.eqms.auth.CurrentUserService.class);
        when(users.requireCurrentUser()).thenReturn(new UserAccount());
        policyService = new NotificationPolicyService(events, policies, versions, users, mock(AuditTrailService.class), JSON);
        dispatcher = new NotificationDispatcher(events, policies, versions, inApp, mock(UserAccountRepository.class), mock(PermissionEvaluationService.class), JSON, outbox, queue);

        person = new UserAccount();
        person.setId(UUID.randomUUID());
        person.setFullName("Nguyen Van A");
        person.setEmail("a@example.local");
        person.setStatus(UserStatus.Pending);
    }

    private UpdateNotificationPolicyRequest change(String status, String digest, String quietStart, String quietEnd, Boolean escalate, List<String> channels) {
        return new UpdateNotificationPolicyRequest(status, null, digest, quietStart, quietEnd, escalate, null, null, channels);
    }

    @Test
    void theAccountEmailsAreTheFiveThatCarryASecretOrCannotBeDoneWithout() {
        assertThat(NotificationMandatoryEvents.all()).containsExactlyInAnyOrder(
                "security.mfa_login_code", "security.password_reset_link", "security.account_unlocked", "security.account_password_reset", "security.mfa_requirement_removed");
        assertThat(NotificationMandatoryEvents.isMandatory("document.approved")).isFalse();
        assertThat(NotificationMandatoryEvents.isMandatory(null)).isFalse();
    }

    @Test
    void anAdministratorCannotSwitchOffMoveHoldBackOrEscalateAMandatoryEmail() {
        assertThatThrownBy(() -> policyService.updatePolicy(CODE, change("DISABLED", null, null, null, null, null))).hasMessageContaining("cannot be switched off");
        assertThatThrownBy(() -> policyService.updatePolicy(CODE, change("DRAFT", null, null, null, null, null))).hasMessageContaining("cannot be switched off");
        assertThatThrownBy(() -> policyService.updatePolicy(CODE, change(null, "DAILY_DIGEST", null, null, null, null))).hasMessageContaining("digest");
        assertThatThrownBy(() -> policyService.updatePolicy(CODE, change(null, null, "22:00", "06:00", null, null))).hasMessageContaining("quiet hours");
        assertThatThrownBy(() -> policyService.updatePolicy(CODE, change(null, null, null, null, true, null))).hasMessageContaining("escalated");
        assertThatThrownBy(() -> policyService.updatePolicy(CODE, change(null, null, null, null, null, List.of("IN_APP")))).hasMessageContaining("cannot be sent on the channel IN_APP");
        verify(policies, never()).save(any());
    }

    @Test
    void theRecipientsOfAMandatoryEmailCanStillBeChanged() {
        var request = new UpdateNotificationPolicyRequest("ACTIVE", JSON.createArrayNode().add(JSON.createObjectNode().put("type", "AFFECTED_USERS")),
                "IMMEDIATE", null, null, null, null, null, List.of("EMAIL"));

        policyService.updatePolicy(CODE, request);

        // nothing was refused: the same values were sent back, so nothing needed to be saved, and no error was raised
        verify(policies, never()).save(any());
    }

    @Test
    void aMandatoryEmailIsSentAtOnceEvenWhenAnOlderPolicyHasItSwitchedOffHeldInADigestOrOnInApp() {
        policy.setStatus(NotificationPolicy.STATUS_DISABLED);
        policy.setDigestMode(NotificationPolicy.DIGEST_DAILY);
        policy.setQuietHoursStart("00:00");
        policy.setQuietHoursEnd("23:59");
        policy.setEnabledChannels("IN_APP");

        var outcome = dispatcher.dispatch(CODE, List.of(person), Map.of("otpCode", "482913", "expiresIn", "10"));

        assertThat(outcome.blocked()).isNull();
        verify(outbox).enqueue(eq("a@example.local"), eq("Your code 482913"), anyString(), eq(CODE), any(), anyMap());
        verify(queue, never()).save(any());
        verify(inApp, never()).recordNotification(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void theSecretIsNeverKeptAsAnInAppNotification() {
        var inAppVersion = new NotificationTemplateVersion();
        inAppVersion.setChannel("IN_APP");
        inAppVersion.setStatus("ACTIVE");
        inAppVersion.setTitle("Code {{otpCode}}");
        inAppVersion.setSummary("Code {{otpCode}}");
        when(versions.findFirstByPolicy_IdAndChannelAndStatusOrderByVersionNumberDesc(policy.getId(), "IN_APP", "ACTIVE")).thenReturn(Optional.of(inAppVersion));
        policy.setEnabledChannels("IN_APP,EMAIL");

        dispatcher.dispatch(CODE, List.of(person), Map.of("otpCode", "482913"));

        verify(inApp, never()).recordNotification(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
    }
}
