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
import com.fasterxml.jackson.databind.JsonNode;
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

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** A recipient rule may name its own channels: who gets the in-app notification and who the e-mail is decided rule by rule. */
@ExtendWith(MockitoExtension.class)
@org.mockito.junit.jupiter.MockitoSettings(strictness = org.mockito.quality.Strictness.LENIENT)
class NotificationDispatcherRuleChannelsTest {
    private static final ObjectMapper JSON = new ObjectMapper();

    @Mock private NotificationEventDefinitionRepository eventRepository;
    @Mock private NotificationPolicyRepository policyRepository;
    @Mock private NotificationTemplateVersionRepository templateVersionRepository;
    @Mock private NotificationService notificationService;
    @Mock private UserAccountRepository userAccountRepository;
    @Mock private PermissionEvaluationService permissionEvaluationService;
    @Mock private NotificationEmailOutbox emailOutbox;
    @Mock private com.eqms.repository.NotificationDispatchQueueRepository dispatchQueueRepository;

    private NotificationDispatcher dispatcher;
    private UserAccount author;
    private UserAccount approver;
    private NotificationPolicy policy;

    private static UserAccount person(String name, String email) {
        UserAccount user = new UserAccount();
        user.setId(UUID.randomUUID());
        user.setStatus(UserStatus.Active);
        user.setFullName(name);
        user.setEmail(email);
        return user;
    }

    @BeforeEach
    void setUp() {
        dispatcher = new NotificationDispatcher(eventRepository, policyRepository, templateVersionRepository, notificationService, userAccountRepository,
                permissionEvaluationService, JSON, emailOutbox, dispatchQueueRepository);
        author = person("Author", "author@example.local");
        approver = person("Approver", "approver@example.local");
        policy = new NotificationPolicy();
        policy.setId(UUID.randomUUID());
        policy.setEventCode("test.event");
        policy.setStatus(NotificationPolicy.STATUS_ACTIVE);
        policy.setEnabledChannels("IN_APP,EMAIL");

        NotificationEventDefinition event = new NotificationEventDefinition();
        event.setCode("test.event");
        event.setModule("Documents");
        event.setPriority("MEDIUM");
        event.setActive(true);
        when(eventRepository.findByCode("test.event")).thenReturn(Optional.of(event));
        when(policyRepository.findByEventCode("test.event")).thenReturn(Optional.of(policy));
        NotificationTemplateVersion inApp = new NotificationTemplateVersion();
        inApp.setChannel(NotificationTemplateVersion.CHANNEL_IN_APP);
        inApp.setStatus(NotificationTemplateVersion.STATUS_ACTIVE);
        inApp.setTitle("Reviewed");
        inApp.setSummary("The document was reviewed.");
        NotificationTemplateVersion email = new NotificationTemplateVersion();
        email.setChannel(NotificationTemplateVersion.CHANNEL_EMAIL);
        email.setStatus(NotificationTemplateVersion.STATUS_ACTIVE);
        email.setSubject("Reviewed");
        email.setBody("<p>The document was reviewed.</p>");
        when(templateVersionRepository.findFirstByPolicy_IdAndChannelAndStatusOrderByVersionNumberDesc(policy.getId(), NotificationTemplateVersion.CHANNEL_IN_APP, NotificationTemplateVersion.STATUS_ACTIVE)).thenReturn(Optional.of(inApp));
        when(templateVersionRepository.findFirstByPolicy_IdAndChannelAndStatusOrderByVersionNumberDesc(policy.getId(), NotificationTemplateVersion.CHANNEL_EMAIL, NotificationTemplateVersion.STATUS_ACTIVE)).thenReturn(Optional.of(email));
        when(userAccountRepository.findAllByStatus(UserStatus.Active)).thenReturn(List.of(approver));
        when(permissionEvaluationService.hasPermission(approver, "documents.approve")).thenReturn(true);
    }

    /** The channels are given as a comma list, empty for a rule that names none. */
    private ArrayNode rules(String authorChannels, String approverChannels) {
        ArrayNode rules = JSON.createArrayNode();
        var a = rules.addObject().put("type", "AUTHOR");
        if (!authorChannels.isEmpty()) for (String c : authorChannels.split(",")) a.withArray("channels").add(c);
        var b = rules.addObject().put("type", "PERMISSION").put("value", "documents.approve");
        if (!approverChannels.isEmpty()) for (String c : approverChannels.split(",")) b.withArray("channels").add(c);
        return rules;
    }

    @Test
    void eachRuleReachesItsPeopleOnlyOnItsOwnChannels() {
        policy.setRecipientRules(rules("IN_APP,EMAIL", "IN_APP"));
        dispatcher.dispatch("test.event", List.of(author), Map.of());
        verify(notificationService, times(2)).recordNotification(any(), any(), any(), any(), eq("test.event"), any(), any(), any(), any(), any(), any(), any(), any(), any());
        verify(emailOutbox).enqueue(eq("author@example.local"), anyString(), anyString(), eq("test.event"), anyString(), any());
        verify(emailOutbox, never()).enqueue(eq("approver@example.local"), anyString(), anyString(), anyString(), anyString(), any());
    }

    @Test
    void aRuleThatNamesNoChannelReachesEveryChannelOfTheEvent_asBefore() {
        policy.setRecipientRules(rules("", ""));
        dispatcher.dispatch("test.event", List.of(author), Map.of());
        verify(emailOutbox).enqueue(eq("author@example.local"), anyString(), anyString(), eq("test.event"), anyString(), any());
        verify(emailOutbox).enqueue(eq("approver@example.local"), anyString(), anyString(), eq("test.event"), anyString(), any());
    }

    @Test
    void aRuleOnlyForEmailSendsNoInAppNotification() {
        policy.setRecipientRules(rules("EMAIL", "EMAIL"));
        dispatcher.dispatch("test.event", List.of(author), Map.of());
        verify(notificationService, never()).recordNotification(any(), any(), any(), any(), anyString(), any(), any(), any(), any(), any(), any(), any(), any(), any());
        verify(emailOutbox, times(2)).enqueue(anyString(), anyString(), anyString(), eq("test.event"), anyString(), any());
    }

    @Test
    void theChannelsOfARuleAreChecked() throws Exception {
        assertDoesNotThrow(() -> NotificationRecipientRules.validate(rules("IN_APP", "EMAIL")));
        JsonNode empty = JSON.readTree("[{\"type\":\"AUTHOR\",\"channels\":[]}]");
        JsonNode unknown = JSON.readTree("[{\"type\":\"AUTHOR\",\"channels\":[\"SMS\"]}]");
        JsonNode notAList = JSON.readTree("[{\"type\":\"AUTHOR\",\"channels\":\"EMAIL\"}]");
        for (JsonNode bad : new JsonNode[] {empty, unknown, notAList}) {
            assertThrows(IllegalArgumentException.class, () -> NotificationRecipientRules.validate(bad), bad.toString());
        }
        assertTrue(NotificationRecipientRules.appliesTo(JSON.readTree("{\"type\":\"AUTHOR\"}"), "EMAIL"));
        assertFalse(NotificationRecipientRules.appliesTo(JSON.readTree("{\"type\":\"AUTHOR\",\"channels\":[\"IN_APP\"]}"), "EMAIL"));
    }
}
