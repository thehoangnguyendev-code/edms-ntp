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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Regression test for a real bug found while wiring {@code user.account_suspended}/{@code
 * user.account_terminated} (NOTIFICATION_SYSTEM_REMEDIATION_PLAN.md Phase 1): the caller sets
 * the target user's in-memory status to Suspended/Terminated *before* calling {@code dispatch()},
 * so the generic "contextual recipients must be Active" filter silently dropped the one person
 * the notification exists to reach. AFFECTED_USERS must bypass that filter; OWNER/REVIEWER/etc
 * (workflow participants who must currently be able to act) must not.
 */
@ExtendWith(MockitoExtension.class)
class NotificationDispatcherAffectedUserTest {

    @Mock private NotificationEventDefinitionRepository eventRepository;
    @Mock private NotificationPolicyRepository policyRepository;
    @Mock private NotificationTemplateVersionRepository templateVersionRepository;
    @Mock private NotificationService notificationService;
    @Mock private UserAccountRepository userAccountRepository;
    @Mock private PermissionEvaluationService permissionEvaluationService;
    @Mock private EmailNotificationService emailNotificationService;
    @Mock private com.eqms.repository.NotificationDispatchQueueRepository dispatchQueueRepository;

    private NotificationDispatcher dispatcher;

    @BeforeEach
    void setUp() {
        dispatcher = new NotificationDispatcher(
                eventRepository, policyRepository, templateVersionRepository, notificationService,
                userAccountRepository, permissionEvaluationService, new ObjectMapper(), emailNotificationService,
                dispatchQueueRepository);
    }

    private NotificationPolicy policyWithRule(String type) {
        NotificationPolicy policy = new NotificationPolicy();
        policy.setId(UUID.randomUUID());
        policy.setEventCode("user.account_suspended");
        policy.setStatus(NotificationPolicy.STATUS_ACTIVE);
        policy.setEnabledChannels("IN_APP");
        ArrayNode rules = new ObjectMapper().createArrayNode();
        rules.addObject().put("type", type);
        policy.setRecipientRules(rules);
        return policy;
    }

    private NotificationEventDefinition event() {
        NotificationEventDefinition event = new NotificationEventDefinition();
        event.setCode("user.account_suspended");
        event.setModule("Security");
        event.setActive(true);
        event.setMandatory(false);
        return event;
    }

    private NotificationTemplateVersion inAppVersion() {
        NotificationTemplateVersion version = new NotificationTemplateVersion();
        version.setChannel(NotificationTemplateVersion.CHANNEL_IN_APP);
        version.setStatus(NotificationTemplateVersion.STATUS_ACTIVE);
        version.setTitle("Account suspended");
        version.setSummary("Your account was suspended.");
        return version;
    }

    @Test
    void affectedUsers_alreadyInactive_stillReceivesNotification() {
        UserAccount target = new UserAccount();
        target.setId(UUID.randomUUID());
        target.setFullName("Target User");
        target.setStatus(UserStatus.Suspended); // already flipped by the caller before dispatch()

        NotificationPolicy policy = policyWithRule("AFFECTED_USERS");
        when(eventRepository.findByCode("user.account_suspended")).thenReturn(Optional.of(event()));
        when(policyRepository.findByEventCode("user.account_suspended")).thenReturn(Optional.of(policy));
        when(templateVersionRepository.findFirstByPolicy_IdAndChannelAndStatusOrderByVersionNumberDesc(
                policy.getId(), NotificationTemplateVersion.CHANNEL_IN_APP, NotificationTemplateVersion.STATUS_ACTIVE))
                .thenReturn(Optional.of(inAppVersion()));

        dispatcher.dispatch("user.account_suspended", List.of(target), Map.of());

        verify(notificationService).recordNotification(
                eq(target), eq(null), eq("personal"), eq("Security"), eq("user.account_suspended"),
                eq("Account suspended"), eq("Your account was suspended."), any(), any(), any(), any(), any(),
                any(), any(), eq(false));
    }

    @Test
    void ownerType_inactiveWorkflowParticipant_isStillExcluded() {
        UserAccount inactiveReviewer = new UserAccount();
        inactiveReviewer.setId(UUID.randomUUID());
        inactiveReviewer.setFullName("Former Reviewer");
        inactiveReviewer.setStatus(UserStatus.Terminated);

        NotificationPolicy policy = policyWithRule("OWNER");
        when(eventRepository.findByCode("user.account_suspended")).thenReturn(Optional.of(event()));
        when(policyRepository.findByEventCode("user.account_suspended")).thenReturn(Optional.of(policy));

        dispatcher.dispatch("user.account_suspended", List.of(inactiveReviewer), Map.of());

        verify(notificationService, org.mockito.Mockito.never()).recordNotification(
                any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(),
                org.mockito.ArgumentMatchers.anyBoolean());
    }
}
