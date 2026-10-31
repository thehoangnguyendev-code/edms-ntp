package com.eqms.service;

import com.eqms.entity.EmailTemplate;
import com.eqms.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ControlledCopyDeliveryScopeTest {
    EmailService smtp=mock(EmailService.class);
    EmailTemplateRepository templates=mock(EmailTemplateRepository.class);
    EmailTemplateService renderer=mock(EmailTemplateService.class);
    NotificationEmailOutbox outbox=mock(NotificationEmailOutbox.class);
    EmailNotificationService service;
    EmailTemplate template;

    @SuppressWarnings("unchecked") <T> ObjectProvider<T> provider(T value){var provider=mock(ObjectProvider.class);when(provider.getObject()).thenReturn(value);when(provider.getIfAvailable()).thenReturn(value);return provider;}
    @BeforeEach void setup(){
        service=new EmailNotificationService(provider(smtp),templates,provider(null),mock(NotificationService.class),mock(UserAccountRepository.class),new ObjectMapper());
        ReflectionTestUtils.setField(service,"emailOutboxProvider",provider(outbox));
        ReflectionTestUtils.setField(service,"emailTemplateServiceProvider",provider(renderer));
        template=new EmailTemplate();template.setId(UUID.randomUUID());template.setType("controlled-copy-distributed");template.setSubject("Subject");
        when(templates.findTopByTypeIgnoreCaseAndStatusIgnoreCaseOrderByUpdatedDateDesc(anyString(),eq("Active"))).thenReturn(Optional.of(template));
        when(renderer.renderTemplateText(any(),any())).thenReturn("rendered subject");when(renderer.renderTemplateContent(any(),any())).thenReturn("rendered body");
        TransactionSynchronizationManager.setActualTransactionActive(true);
    }
    @AfterEach void cleanup(){TransactionSynchronizationManager.clear();}
    @Test void fencedDeliveryQueuesOnceWithoutSmtpAndRestoresScope(){
        try(var scope=ControlledCopyDeliveryScope.enter()){
            service.sendControlledCopyNotificationToEmails(template.getType(),List.of("recipient@example.invalid"),Map.of());
            assertTrue(ControlledCopyDeliveryScope.active());
        }
        assertFalse(ControlledCopyDeliveryScope.active());
        verify(outbox).enqueue(eq("recipient@example.invalid"),eq("rendered subject"),eq("rendered body"),eq(template.getType()),eq("CONTROLLED_COPY"),argThat(payload->template.getId().toString().equals(payload.get("outboxLegacyTemplateId"))),eq(true));
        verifyNoInteractions(smtp);verify(renderer,never()).incrementUsage(any());
    }
    @Test void renderFailurePropagatesSoCopyTransactionCannotCommitWithoutDelivery(){
        when(renderer.renderTemplateContent(any(),any())).thenThrow(new IllegalArgumentException("render failure"));
        try(var scope=ControlledCopyDeliveryScope.enter()){
            assertThrows(IllegalStateException.class,()->service.sendControlledCopyNotificationToEmails(template.getType(),List.of("recipient@example.invalid"),Map.of()));
        }
        assertFalse(ControlledCopyDeliveryScope.active());verifyNoInteractions(smtp,outbox);
    }
    @Test void scopeCannotQueueOutsideAnActualTransaction(){
        TransactionSynchronizationManager.setActualTransactionActive(false);
        try(var scope=ControlledCopyDeliveryScope.enter()){assertFalse(ControlledCopyDeliveryScope.active());}
    }
}
