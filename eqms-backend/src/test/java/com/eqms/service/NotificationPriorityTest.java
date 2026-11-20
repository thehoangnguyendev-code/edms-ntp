package com.eqms.service;

import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.dto.notification.UpdateNotificationPolicyRequest;
import com.eqms.entity.NotificationEventDefinition;
import com.eqms.entity.NotificationPolicy;
import com.eqms.entity.NotificationTemplateVersion;
import com.eqms.entity.UserAccount;
import com.eqms.repository.NotificationEventDefinitionRepository;
import com.eqms.repository.NotificationPolicyRepository;
import com.eqms.repository.NotificationTemplateVersionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * NOTIFICATION-PRIORITY-2026-11-20: an administrator sets the priority of a notification (Low, Medium or High). Nothing chosen keeps the default of the catalog event;
 * the choice is validated, kept only when it differs from the default, audited with the value before and after, and is what a notification is sent with.
 */
class NotificationPriorityTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    private NotificationPolicyRepository policies;
    private AuditTrailService audit;
    private NotificationPolicyService service;
    private NotificationPolicy policy;
    private NotificationEventDefinition event;

    @BeforeEach
    void setUp() {
        policies = mock(NotificationPolicyRepository.class);
        var versions = mock(NotificationTemplateVersionRepository.class);
        audit = mock(AuditTrailService.class);
        var events = mock(NotificationEventDefinitionRepository.class);
        var users = mock(com.eqms.auth.CurrentUserService.class);
        when(users.requireCurrentUser()).thenReturn(new UserAccount());
        event = new NotificationEventDefinition();
        event.setCode("document.approved");
        event.setName("Document Approved");
        event.setPriority(NotificationEventDefinition.PRIORITY_MEDIUM);
        event.setSupportedChannels("IN_APP,EMAIL");
        event.setAvailableVariables("recipientName,documentNumber,actionUrl");
        policy = new NotificationPolicy();
        policy.setId(UUID.randomUUID());
        policy.setEventCode("document.approved");
        policy.setStatus("ACTIVE");
        policy.setEnabledChannels("IN_APP");
        policy.setRecipientRules(JSON.createArrayNode().add(JSON.createObjectNode().put("type", "AUTHOR")));
        when(events.findByCode("document.approved")).thenReturn(Optional.of(event));
        when(policies.findByEventCode("document.approved")).thenReturn(Optional.of(policy));
        when(policies.lockByEventCode("document.approved")).thenReturn(Optional.of(policy));
        var inApp = new NotificationTemplateVersion();
        inApp.setId(UUID.randomUUID());
        inApp.setChannel("IN_APP");
        inApp.setTitle("Document approved");
        inApp.setSummary("{{documentNumber}} has been approved.");
        when(versions.findFirstByPolicy_IdAndChannelAndStatusOrderByVersionNumberDesc(any(), any(), any())).thenReturn(Optional.empty());
        when(versions.findFirstByPolicy_IdAndChannelAndStatusOrderByVersionNumberDesc(policy.getId(), "IN_APP", "ACTIVE")).thenReturn(Optional.of(inApp));
        service = new NotificationPolicyService(events, policies, versions, users, audit, JSON);
    }

    private static UpdateNotificationPolicyRequest priority(String value) {
        return new UpdateNotificationPolicyRequest(null, null, null, null, null, null, null, null, null, null, value);
    }

    @SuppressWarnings("unchecked")
    private List<AuditTrailChangeResponse> auditedChanges() {
        ArgumentCaptor<List<AuditTrailChangeResponse>> changes = ArgumentCaptor.forClass(List.class);
        verify(audit).logAs(any(), eq("NOTIFICATION_POLICY"), any(), any(), eq("UPDATE"), any(), any(), any(), changes.capture());
        return changes.getValue();
    }

    @Test
    void aNotificationKeepsTheCatalogPriorityUntilAnAdministratorChoosesAnother() {
        assertThat(policy.effectivePriority(event)).isEqualTo("MEDIUM");
        policy.setPriority("LOW");
        assertThat(policy.effectivePriority(event)).isEqualTo("LOW");
        policy.setPriority(" ");
        assertThat(policy.effectivePriority(event)).isEqualTo("MEDIUM");
    }

    @Test
    void choosingAPriorityIsStoredAndAuditedWithTheValueBeforeAndAfter() {
        service.updatePolicy("document.approved", priority("high"));

        assertThat(policy.getPriority()).isEqualTo("HIGH");
        verify(policies).save(policy);
        assertThat(auditedChanges()).singleElement().satisfies(change -> {
            assertThat(change.field()).isEqualTo("Priority");
            assertThat(change.oldValue()).isEqualTo("MEDIUM");
            assertThat(change.newValue()).isEqualTo("HIGH");
        });
    }

    @Test
    void choosingTheCatalogPriorityPutsTheNotificationBackToItsDefault() {
        policy.setPriority("HIGH");

        service.updatePolicy("document.approved", priority("MEDIUM"));

        assertThat(policy.getPriority()).isNull();
        assertThat(auditedChanges()).singleElement().satisfies(change -> {
            assertThat(change.oldValue()).isEqualTo("HIGH");
            assertThat(change.newValue()).isEqualTo("MEDIUM");
        });
    }

    @Test
    void choosingThePriorityItAlreadyHasChangesAndAuditsNothing() {
        service.updatePolicy("document.approved", priority("Medium"));

        verify(policies, never()).save(any());
        verify(audit, never()).logAs(any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void aPriorityOutsideLowMediumHighIsRefusedAndNothingIsSaved() {
        assertThatThrownBy(() -> service.updatePolicy("document.approved", priority("URGENT"))).hasMessageContaining("Invalid priority");
        assertThatThrownBy(() -> service.updatePolicy("document.approved", priority("critical"))).hasMessageContaining("Choose Low, Medium or High");
        verify(policies, never()).save(any());
        assertThat(policy.getPriority()).isNull();
    }

    @Test
    void criticalIsOnlyKeptOnAnEventTheCatalogMarksCritical() {
        event.setPriority(NotificationEventDefinition.PRIORITY_CRITICAL);
        policy.setPriority("HIGH");

        service.updatePolicy("document.approved", priority("critical"));

        assertThat(policy.getPriority()).isNull();
        assertThat(policy.effectivePriority(event)).isEqualTo("CRITICAL");
    }

    @Test
    void importanceIsSortedLowToCriticalNotByTheLettersOfTheWord() {
        assertThat(List.of("MEDIUM", "CRITICAL", "LOW", "HIGH").stream().sorted(java.util.Comparator.comparingInt(NotificationPolicyService::priorityRank)).toList())
                .containsExactly("LOW", "MEDIUM", "HIGH", "CRITICAL");
        assertThat(NotificationPolicyService.priorityRank(null)).isEqualTo(NotificationPolicyService.priorityRank("MEDIUM"));
    }

    @Test
    void theRequestedPriorityIsNullWhenNoChangeIsAsked() {
        assertThat(NotificationPolicyService.requestedPriority(null, event)).isNull();
        assertThat(NotificationPolicyService.requestedPriority(" low ", event)).isEqualTo("LOW");
    }
}
