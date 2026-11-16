package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.notification.UpdateNotificationTemplateRequest;
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

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** NOTIFICATION-ADMIN-2026-11-12: every notification is edited without a signature and every change is written to the Audit Trail. */
class NotificationWordingAndChannelsTest {

    NotificationEventDefinitionRepository events = mock(NotificationEventDefinitionRepository.class);
    NotificationPolicyRepository policies = mock(NotificationPolicyRepository.class);
    NotificationTemplateVersionRepository versions = mock(NotificationTemplateVersionRepository.class);
    CurrentUserService users = mock(CurrentUserService.class);
    AuditTrailService audit = mock(AuditTrailService.class);
    NotificationPolicyService service;
    UserAccount admin = new UserAccount();
    NotificationEventDefinition event = new NotificationEventDefinition();
    NotificationPolicy policy = new NotificationPolicy();

    @BeforeEach
    void setUp() {
        service = new NotificationPolicyService(events, policies, versions, users, audit, new ObjectMapper());
        when(users.requireCurrentUser()).thenReturn(admin);
        event.setCode("controlled_copy.recalled");
        event.setName("Controlled Copy Recalled");
        event.setModule("CONTROLLED_COPIES");
        event.setSupportedChannels("IN_APP,EMAIL");
        event.setAvailableVariables("documentNumber,reason");
        policy.setId(UUID.randomUUID());
        policy.setEventCode(event.getCode());
        policy.setStatus("ACTIVE");
        policy.setEnabledChannels("IN_APP");
        when(events.findByCode(event.getCode())).thenReturn(Optional.of(event));
        when(policies.findByEventCode(event.getCode())).thenReturn(Optional.of(policy));
        when(policies.lockByEventCode(event.getCode())).thenReturn(Optional.of(policy));
        when(versions.countByPolicy_IdAndChannel(any(), anyString())).thenReturn(1);
        when(versions.save(any(NotificationTemplateVersion.class))).thenAnswer(i -> {
            NotificationTemplateVersion v = i.getArgument(0);
            if (v.getId() == null) v.setId(UUID.randomUUID());
            return v;
        });
    }

    private NotificationTemplateVersion emailVersion() {
        NotificationTemplateVersion v = new NotificationTemplateVersion();
        v.setId(UUID.randomUUID());
        v.setChannel("EMAIL");
        v.setPolicy(policy);
        return v;
    }

    private static UpdateNotificationTemplateRequest wording(String subject, String body) {
        return new UpdateNotificationTemplateRequest("Title {{documentNumber}}", "Summary {{reason}}", subject, body, null, "Clearer wording", "Open the recall");
    }

    // ------------------------------------------------------------------ the icon

    @Test
    void theIconOfAnotificationIsChosenFromTheKnownIconsAndTonesAndTheChangeIsAudited() {
        service.updateAppearance(event.getCode(), " tabler:IconShieldExclamation ", "red");
        assertThat(policy.getIcon()).isEqualTo("tabler:IconShieldExclamation");
        assertThat(policy.getIconTone()).isEqualTo("red");
        ArgumentCaptor<java.util.List<com.eqms.dto.audittrail.AuditTrailChangeResponse>> changes = ArgumentCaptor.forClass(java.util.List.class);
        verify(audit).logAs(eq(admin), eq("NOTIFICATION_POLICY"), anyString(), any(), eq("UPDATE_ICON"), any(), any(), anyString(), changes.capture());
        assertThat(changes.getValue()).extracting(com.eqms.dto.audittrail.AuditTrailChangeResponse::field).containsExactly("Icon", "Icon colour");
    }

    @Test
    void anUnchangedIconWritesNothingAndAnEmptyOneGoesBackToTheIconOfItsKind() {
        policy.setIcon("lucide:Lock");
        policy.setIconTone("amber");
        service.updateAppearance(event.getCode(), "lucide:Lock", " amber ");
        verify(policies, never()).save(any());
        verify(audit, never()).logAs(any(), anyString(), anyString(), any(), anyString(), any(), any(), anyString(), any());
        service.updateAppearance(event.getCode(), "", null);
        assertThat(policy.getIcon()).isNull();
        assertThat(policy.getIconTone()).isNull();
    }

    @Test
    void anIconOrToneThatIsNotKnownIsRefused() {
        for (String bad : new String[] {"skull", "lock", "fontawesome:Skull", "lucide:", "lucide:Bell Ring", "lucide:../Bell", "tabler:<script>"}) {
            assertThatThrownBy(() -> service.updateAppearance(event.getCode(), bad, "red")).hasMessageContaining("Lucide or the Tabler");
        }
        assertThatThrownBy(() -> service.updateAppearance(event.getCode(), "lucide:Bell", "pink"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("#RRGGBB");
        verify(policies, never()).save(any());
    }

    // ------------------------------------------------------------------ the wording

    @Test
    void anyNotificationIsEditedWithoutASignatureAndTheChangeOfTheContentIsAuditedWithTheValueBeforeAndAfter() {
        NotificationTemplateVersion current = new NotificationTemplateVersion();
        current.setId(UUID.randomUUID());
        current.setChannel("IN_APP");
        current.setPolicy(policy);
        current.setStatus(NotificationTemplateVersion.STATUS_ACTIVE);
        current.setTitle("Old title {{documentNumber}}");
        current.setSummary("Old summary {{reason}}");
        when(versions.findFirstByPolicy_IdAndChannelAndStatusOrderByVersionNumberDesc(any(), eq("IN_APP"), anyString())).thenReturn(Optional.of(current));

        service.updateTemplate(event.getCode(), "IN_APP", wording(null, null));

        verify(versions, org.mockito.Mockito.times(2)).save(any(NotificationTemplateVersion.class)); // the earlier version is archived, the new one is saved
        ArgumentCaptor<java.util.List<com.eqms.dto.audittrail.AuditTrailChangeResponse>> changes = ArgumentCaptor.forClass(java.util.List.class);
        ArgumentCaptor<String> message = ArgumentCaptor.forClass(String.class);
        verify(audit).logAs(eq(admin), eq("NOTIFICATION_POLICY"), anyString(), any(), eq("UPDATE_CONTENT"), any(), any(), message.capture(), changes.capture());
        assertThat(message.getValue()).isEqualTo("Clearer wording");
        assertThat(changes.getValue()).extracting(com.eqms.dto.audittrail.AuditTrailChangeResponse::field).contains("Title", "Summary");
        var title = changes.getValue().stream().filter(c -> c.field().equals("Title")).findFirst().orElseThrow();
        assertThat(title.oldValue()).isEqualTo("Old title {{documentNumber}}");
        assertThat(title.newValue()).isEqualTo("Title {{documentNumber}}");
    }

    @Test
    void anEmailNeedsASubjectAndAMessageAndOnlyAnEventThatHasAnEmail() {
        assertThatThrownBy(() -> service.updateTemplate(event.getCode(), "EMAIL", wording("", "text"))).hasMessageContaining("subject and a message");
        assertThatThrownBy(() -> service.updateTemplate(event.getCode(), "EMAIL", wording("Subject", " "))).hasMessageContaining("subject and a message");
        event.setSupportedChannels("IN_APP");
        assertThatThrownBy(() -> service.updateTemplate(event.getCode(), "EMAIL", wording("Subject", "Body"))).hasMessageContaining("no email");
        assertThatThrownBy(() -> service.updateTemplate(event.getCode(), "SMS", wording("Subject", "Body"))).hasMessageContaining("in-app and the email");
    }

    @Test
    void theEmailWordingIsSavedWithItsButtonLabelAndAVariableThatDoesNotExistIsRefused() {
        service.updateTemplate(event.getCode(), "EMAIL", wording("Return {{documentNumber}}", "Because {{reason}}"));
        ArgumentCaptor<NotificationTemplateVersion> saved = ArgumentCaptor.forClass(NotificationTemplateVersion.class);
        verify(versions).save(saved.capture());
        assertThat(saved.getValue().getChannel()).isEqualTo("EMAIL");
        assertThat(saved.getValue().getActionLabel()).isEqualTo("Open the recall");
        assertThatThrownBy(() -> service.updateTemplate(event.getCode(), "EMAIL", wording("Hello {{nonsense}}", "Body"))).hasMessageContaining("nonsense");
    }

    // ------------------------------------------------------------------ the placeholders

    @Test
    void theEventOffersItsPlaceholdersWithTheTokenToCopyAndAnExample() {
        event.setAvailableVariables("documentNumber, controlledCopyNumber,recallReason");
        var variables = service.variables(event.getCode());
        assertThat(variables).extracting("name").containsExactly("documentNumber", "controlledCopyNumber", "recallReason");
        assertThat(variables.get(0).token()).isEqualTo("{{documentNumber}}");
        assertThat(variables.get(1).label()).isEqualTo("Controlled copy number");
        assertThat(variables.get(1).sample()).isEqualTo("CC-0001");
        event.setAvailableVariables("somethingNew");
        assertThat(service.variables(event.getCode()).get(0).sample()).isEqualTo("(example)");
        event.setAvailableVariables(null);
        assertThat(service.variables(event.getCode())).isEmpty();
    }

    // ------------------------------------------------------------------ the channel filter and the test mail

    @Test
    void theChannelFilterSeparatesEventsWhoseEmailIsOnFromTheRest() {
        assertThat(NotificationPolicyService.matchesChannel(null, "IN_APP")).isTrue();
        assertThat(NotificationPolicyService.matchesChannel("EMAIL", "IN_APP,EMAIL")).isTrue();
        assertThat(NotificationPolicyService.matchesChannel("EMAIL", "IN_APP")).isFalse();
        assertThat(NotificationPolicyService.matchesChannel("in_app_only", "IN_APP")).isTrue();
        assertThat(NotificationPolicyService.matchesChannel("IN_APP_ONLY", "IN_APP,EMAIL")).isFalse();
        assertThat(NotificationPolicyService.matchesChannel("whatever", "IN_APP")).isTrue();
    }

    private EmailService mailer() {
        EmailService mail = mock(EmailService.class);
        org.springframework.test.util.ReflectionTestUtils.setField(service, "emailService", mail);
        return mail;
    }

    private void publishedEmail() {
        NotificationTemplateVersion v = emailVersion();
        v.setSubject("Return {{documentNumber}}");
        v.setBody("Please return {{documentNumber}}");
        v.setActionLabel("Open");
        v.setActionUrlTemplate("/x");
        when(versions.findFirstByPolicy_IdAndChannelAndStatusOrderByVersionNumberDesc(any(), eq("EMAIL"), anyString())).thenReturn(Optional.of(v));
        when(versions.findFirstByPolicy_IdAndChannelAndStatusOrderByVersionNumberDesc(any(), eq("IN_APP"), anyString())).thenReturn(Optional.empty());
    }

    @Test
    void aTestMailGoesToTheAddressGivenWithExampleValuesAndIsAudited() throws Exception {
        EmailService mail = mailer();
        publishedEmail();
        when(mail.sendRenderedEmail(anyString(), anyString(), anyString())).thenReturn(true);
        service.testSend(event.getCode(), " qa@example.test ");
        ArgumentCaptor<String> subject = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> html = ArgumentCaptor.forClass(String.class);
        verify(mail).sendRenderedEmail(eq("qa@example.test"), subject.capture(), html.capture());
        assertThat(subject.getValue()).isEqualTo("[Test] Return SOP.0001");
        assertThat(html.getValue()).contains("<!DOCTYPE html>").contains("Please return SOP.0001").contains("https://eqms.example.com/x");
        verify(audit).logAs(eq(admin), eq("NOTIFICATION_POLICY"), anyString(), any(), eq("TEST_SEND"), any(), any(), anyString(), any());
    }

    @Test
    void aTestMailNeedsAValidAddressAPublishedEmailAndAWorkingMailService() throws Exception {
        EmailService mail = mailer();
        assertThatThrownBy(() -> service.testSend(event.getCode(), "not-an-address")).hasMessageContaining("valid e-mail");
        when(versions.findFirstByPolicy_IdAndChannelAndStatusOrderByVersionNumberDesc(any(), eq("EMAIL"), anyString())).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.testSend(event.getCode(), "qa@example.test")).hasMessageContaining("no published email");
        publishedEmail();
        when(mail.sendRenderedEmail(anyString(), anyString(), anyString())).thenReturn(false);
        assertThatThrownBy(() -> service.testSend(event.getCode(), "qa@example.test")).hasMessageContaining("not sent");
        verify(audit, never()).logAs(any(), anyString(), anyString(), any(), eq("TEST_SEND"), any(), any(), anyString(), any());
    }
}
