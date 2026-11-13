package com.eqms.service;

import com.eqms.entity.UserAccount;
import com.eqms.repository.EmailTemplateRepository;
import com.eqms.repository.UserAccountRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * NOTIFICATION-ADMIN-2026-11-12: a message of a type that is also a registry event goes through the event (its policy and wording apply); a type without an event,
 * an event that is not in the registry yet, and a sender that already names a registry event keep the way they were sent.
 */
class EmailNotificationServiceRegistryRoutingTest {

    private EmailTemplateRepository templates;
    private NotificationDispatcher dispatcher;
    private NotificationService inbox;
    private EmailNotificationService service;
    private UserAccount reviewer;

    @SuppressWarnings("unchecked")
    @BeforeEach
    void setUp() {
        templates = mock(EmailTemplateRepository.class);
        inbox = mock(NotificationService.class);
        dispatcher = mock(NotificationDispatcher.class);
        service = new EmailNotificationService(mock(ObjectProvider.class), templates, mock(ObjectProvider.class), inbox, mock(UserAccountRepository.class), new ObjectMapper());
        ObjectProvider<NotificationDispatcher> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(dispatcher);
        ReflectionTestUtils.setField(service, "notificationDispatcherProvider", provider);
        reviewer = new UserAccount();
        reviewer.setId(UUID.randomUUID());
        reviewer.setFullName("Nguyen Van A");
        reviewer.setEmail("a@example.test");
    }

    private Map<String, String> values() {
        return Map.of("documentNumber", "SOP.0001", "documentUrl", "https://eqms.example/documents/1");
    }

    @Test
    void aMessageOfATypeThatIsAnEventGoesThroughTheEventWithTheValuesAndTheAddressItOpens() {
        when(dispatcher.dispatch(anyString(), any(), any())).thenReturn(new NotificationDispatcher.Outcome(null, true, true, true, true));

        service.sendDocumentWorkflowNotification("document-review", List.of(reviewer), values());

        ArgumentCaptor<Map<String, String>> payload = ArgumentCaptor.forClass(Map.class);
        verify(dispatcher).dispatch(eq("document.review_request"), eq(List.of(reviewer)), payload.capture());
        assertThat(payload.getValue()).containsEntry("documentNumber", "SOP.0001").containsEntry("recipientName", "Nguyen Van A")
                .containsEntry("actionUrl", "https://eqms.example/documents/1");
        verify(templates, never()).findTopByTypeIgnoreCaseAndStatusIgnoreCaseOrderByUpdatedDateDesc(anyString(), anyString());
    }

    @Test
    void anEventThatIsSwitchedOffSendsNothingAndDoesNotFallBackToTheMessage() {
        when(dispatcher.dispatch(anyString(), any(), any())).thenReturn(new NotificationDispatcher.Outcome("POLICY_OFF", false, false, false, false));

        service.sendDocumentWorkflowNotification("document-review", List.of(reviewer), values());

        verify(templates, never()).findTopByTypeIgnoreCaseAndStatusIgnoreCaseOrderByUpdatedDateDesc(anyString(), anyString());
    }

    @Test
    void anEventThatIsNotInTheRegistryYetFallsBackToTheMessageAsBefore() {
        when(dispatcher.dispatch(anyString(), any(), any())).thenReturn(new NotificationDispatcher.Outcome("NOT_REGISTERED", false, false, false, false));
        when(templates.findTopByTypeIgnoreCaseAndStatusIgnoreCaseOrderByUpdatedDateDesc(anyString(), anyString())).thenReturn(Optional.empty());

        service.sendDocumentWorkflowNotification("document-review", List.of(reviewer), values());

        verify(templates).findTopByTypeIgnoreCaseAndStatusIgnoreCaseOrderByUpdatedDateDesc("document-review", "Active");
    }

    @Test
    void aSenderThatAlreadyNamesARegistryEventKeepsItsWay() {
        when(templates.findTopByTypeIgnoreCaseAndStatusIgnoreCaseOrderByUpdatedDateDesc(anyString(), anyString())).thenReturn(Optional.empty());

        service.sendDocumentWorkflowNotification("document-review", List.of(reviewer), Map.of("notificationEventCode", "document.submitted_for_review", "documentNumber", "SOP.0001"));

        verify(dispatcher, never()).dispatch(eq("document.review_request"), any(), any());
    }

    @Test
    void aTypeWithoutAnEventIsNotSentThroughTheRegistry() {
        when(templates.findTopByTypeIgnoreCaseAndStatusIgnoreCaseOrderByUpdatedDateDesc(anyString(), anyString())).thenReturn(Optional.empty());

        service.sendByTypeToRecipients("password-reset", List.of(reviewer), values());

        verify(dispatcher, never()).dispatch(anyString(), any(), any());
    }
}
