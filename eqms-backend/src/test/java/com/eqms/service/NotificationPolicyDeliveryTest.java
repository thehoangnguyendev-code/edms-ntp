package com.eqms.service;

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
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * NOTIFICATION-ADMIN-2026-11-12, an administrator decides where a notification is sent: the channels are a subset of what the event supports, at least one,
 * and turning the e-mail on for a notification that never had one starts it from the in-app wording so that something is sent. Every change is audited.
 */
class NotificationPolicyDeliveryTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    private NotificationPolicyRepository policies;
    private NotificationTemplateVersionRepository versions;
    private AuditTrailService audit;
    private NotificationPolicyService service;
    private NotificationPolicy policy;

    @BeforeEach
    void setUp() {
        policies = mock(NotificationPolicyRepository.class);
        versions = mock(NotificationTemplateVersionRepository.class);
        audit = mock(AuditTrailService.class);
        var events = mock(NotificationEventDefinitionRepository.class);
        var users = mock(com.eqms.auth.CurrentUserService.class);
        when(users.requireCurrentUser()).thenReturn(new UserAccount());
        var event = new NotificationEventDefinition();
        event.setCode("document.approved");
        event.setName("Document Approved");
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
        inApp.setActionUrlTemplate("{{actionUrl}}");
        when(versions.findFirstByPolicy_IdAndChannelAndStatusOrderByVersionNumberDesc(policy.getId(), "IN_APP", "ACTIVE")).thenReturn(Optional.of(inApp));
        when(versions.findFirstByPolicy_IdAndChannelAndStatusOrderByVersionNumberDesc(policy.getId(), "EMAIL", "ACTIVE")).thenReturn(Optional.empty());
        service = new NotificationPolicyService(events, policies, versions, users, audit, JSON);
    }

    private UpdateNotificationPolicyRequest channels(String... channels) {
        return new UpdateNotificationPolicyRequest(null, null, null, null, null, null, null, null, List.of(channels));
    }

    @Test
    void aNotificationCannotBeGivenNoChannelOrOneTheEventDoesNotSupport() {
        assertThatThrownBy(() -> service.updatePolicy("document.approved", channels())).hasMessageContaining("at least one channel");
        assertThatThrownBy(() -> service.updatePolicy("document.approved", channels("SMS"))).hasMessageContaining("cannot be sent on the channel SMS");
        verify(policies, never()).save(any());
    }

    @Test
    void turningTheEmailOnStartsItsWordingFromTheInAppWordingAndIsAudited() {
        try {
            service.updatePolicy("document.approved", channels("in_app", "email"));
        } catch (RuntimeException afterTheChange) {
            // the detail is read back with mocks that know nothing of it; what matters is what was saved before
        }
        assertThat(policy.getEnabledChannels()).isEqualTo("IN_APP,EMAIL");
        ArgumentCaptor<NotificationTemplateVersion> saved = ArgumentCaptor.forClass(NotificationTemplateVersion.class);
        verify(versions).save(saved.capture());
        assertThat(saved.getValue().getChannel()).isEqualTo("EMAIL");
        assertThat(saved.getValue().getStatus()).isEqualTo("ACTIVE");
        assertThat(saved.getValue().getSubject()).isEqualTo("[EQMS] Document approved");
        assertThat(saved.getValue().getBody()).contains("{{documentNumber}} has been approved.");
        assertThat(saved.getValue().getActionLabel()).isEqualTo("Open in EQMS");
        ArgumentCaptor<List<com.eqms.dto.audittrail.AuditTrailChangeResponse>> changes = ArgumentCaptor.forClass(List.class);
        verify(audit).logAs(any(), eq("NOTIFICATION_POLICY"), anyString(), eq(policy.getId()), eq("UPDATE"), any(), any(), anyString(), changes.capture());
        assertThat(changes.getValue()).extracting(c -> c.field()).contains("Channels", "Email wording");
    }

    @Test
    void anEmailThatAlreadyHasWordingIsNotStartedAgain() {
        var existing = new NotificationTemplateVersion();
        existing.setChannel("EMAIL");
        when(versions.findFirstByPolicy_IdAndChannelAndStatusOrderByVersionNumberDesc(policy.getId(), "EMAIL", "ACTIVE")).thenReturn(Optional.of(existing));
        try {
            service.updatePolicy("document.approved", channels("IN_APP", "EMAIL"));
        } catch (RuntimeException afterTheChange) {
            // see above
        }
        verify(versions, never()).save(any());
        assertThat(policy.getEnabledChannels()).isEqualTo("IN_APP,EMAIL");
    }

    @Test
    void theWordingOfAChannelThatIsSwitchedOffIsStillShownSoItCanBeReadAndEdited() {
        var email = new NotificationTemplateVersion();
        email.setId(UUID.randomUUID());
        email.setChannel("EMAIL");
        email.setStatus("ACTIVE");
        email.setSubject("Kept subject");
        email.setBody("<p>Kept</p>");
        when(versions.findFirstByPolicy_IdAndChannelAndStatusOrderByVersionNumberDesc(policy.getId(), "EMAIL", "ACTIVE")).thenReturn(Optional.of(email));
        // the policy sends in-app only; the e-mail wording exists
        var detail = service.getDetail("document.approved");
        assertThat(detail.activeTemplates()).extracting(t -> t.channel()).containsExactly("IN_APP", "EMAIL");
        assertThat(detail.activeTemplates().get(1).subject()).isEqualTo("Kept subject");
    }

    @Test
    void anInAppTitleOver255CharactersIsRefusedWithAMessageNotADatabaseError() {
        var request = new com.eqms.dto.notification.UpdateNotificationTemplateRequest("x".repeat(300), "summary", null, null, null, null, null);
        assertThatThrownBy(() -> service.updateTemplate("document.approved", "IN_APP", request)).hasMessageContaining("255");
    }

    // ------------------------------------------------------------------ two administrators saving the same notification

    private static final java.time.Instant OPENED = java.time.Instant.parse("2026-11-12T10:03:19.845780Z");

    @Test
    void aChangeToANotificationThatSomeoneElseChangedAfterItWasOpenedIsRefusedWhateverIsBeingChanged() {
        policy.setUpdatedAt(OPENED.plusSeconds(60));   // saved by someone else after this person opened it
        var policyChange = new UpdateNotificationPolicyRequest("DISABLED", null, null, null, null, null, null, null, null, OPENED);
        assertThatThrownBy(() -> service.updatePolicy("document.approved", policyChange)).isInstanceOf(IllegalStateException.class).hasMessageContaining("changed by someone else");
        var wording = new com.eqms.dto.notification.UpdateNotificationTemplateRequest("T", "S", null, null, null, null, null, OPENED);
        assertThatThrownBy(() -> service.updateTemplate("document.approved", "IN_APP", wording)).isInstanceOf(IllegalStateException.class).hasMessageContaining("changed by someone else");
        assertThatThrownBy(() -> service.updateAppearance("document.approved", "lucide:Bell", "emerald", OPENED)).isInstanceOf(IllegalStateException.class).hasMessageContaining("changed by someone else");
        verify(policies, never()).save(any());
        verify(versions, never()).save(any());
        assertThat(policy.getStatus()).isEqualTo("ACTIVE");
    }

    @Test
    void theColourOfTheIconIsAnySixDigitColourKeptInCapitalsOrAnOldName_andNothingElse() {
        policy.setUpdatedAt(OPENED);
        service.updateAppearance("document.approved", "lucide:Bell", "#d946ef");
        assertThat(policy.getIconTone()).isEqualTo("#D946EF");
        service.updateAppearance("document.approved", "lucide:Bell", "Purple");
        assertThat(policy.getIconTone()).isEqualTo("purple");
        service.updateAppearance("document.approved", "lucide:Bell", null);
        assertThat(policy.getIconTone()).isNull();
        for (String bad : new String[] {"pink", "#fff", "#GGGGGG", "url(x)", "#d946ef; color: red", "123456"}) {
            assertThatThrownBy(() -> service.updateAppearance("document.approved", "lucide:Bell", bad)).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("#RRGGBB");
        }
    }

    @Test
    void aChangeToANotificationNobodyElseChangedIsAcceptedAndAChangeWithNoTokenSkipsTheCheck() {
        policy.setUpdatedAt(OPENED);
        service.updateAppearance("document.approved", "lucide:Bell", "emerald", OPENED);
        assertThat(policy.getIcon()).isEqualTo("lucide:Bell");
        // the time moved with that change, so the same token is now stale
        assertThat(policy.getUpdatedAt()).isAfter(OPENED);
        assertThatThrownBy(() -> service.updateAppearance("document.approved", "lucide:Mail", "blue", OPENED)).hasMessageContaining("changed by someone else");
        // a client that sends no token (an older client, a script) is not refused
        service.updateAppearance("document.approved", "lucide:Mail", "blue");
        assertThat(policy.getIcon()).isEqualTo("lucide:Mail");
    }

    @Test
    void theTokenIsComparedToTheMicrosecondSoAPreciseTimeThatTheBrowserKeptWholeStillMatches() {
        policy.setUpdatedAt(OPENED);
        NotificationPolicyService.requireFresh(policy, java.time.Instant.parse("2026-11-12T10:03:19.845780123Z"));   // nanoseconds are not kept by the database
        assertThatThrownBy(() -> NotificationPolicyService.requireFresh(policy, java.time.Instant.parse("2026-11-12T10:03:19.845Z"))).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void savingTheWordingMovesTheTimeOfTheNotificationAsAWholeSoItIsTheTimeOfTheLastChangeOfAnyKind() {
        policy.setUpdatedAt(OPENED);
        when(versions.save(any(NotificationTemplateVersion.class))).thenAnswer(invocation -> {
            NotificationTemplateVersion saved = invocation.getArgument(0);
            if (saved.getId() == null) saved.setId(UUID.randomUUID());
            return saved;
        });
        service.updateTemplate("document.approved", "IN_APP",
                new com.eqms.dto.notification.UpdateNotificationTemplateRequest("Approved", "{{documentNumber}} approved", null, null, null, null, null, OPENED));
        assertThat(policy.getUpdatedAt()).isAfter(OPENED);
        verify(policies).save(policy);
    }
}
