package com.eqms.service;

import com.eqms.entity.ControlledCopyRecord;
import com.eqms.entity.UserAccount;
import com.eqms.repository.ControlledCopyDistributionBatchRepository;
import com.eqms.repository.ControlledCopyRepository;
import com.eqms.repository.ControlledCopyStatusDefinitionRepository;
import com.eqms.repository.UserAccountRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Regression: auto-obsoleting a Controlled Copy because it expired previously wrote only an
 * audit trail entry -- the holder had no notice their copy was no longer valid (the only one of
 * the three Obsolete sources -- Recall, Revision/Document cascade, Expiry -- that never notified
 * anyone). Also covers the external-recipient expiry-reminder gap fixed alongside it.
 */
@ExtendWith(MockitoExtension.class)
class ControlledCopyExpiryProcessingServiceTest {

    @Mock private ControlledCopyRepository controlledCopyRepository;
    @Mock private ControlledCopyDistributionBatchRepository controlledCopyDistributionBatchRepository;
    @Mock private ControlledCopyStatusDefinitionRepository controlledCopyStatusDefinitionRepository;
    @Mock private UserAccountRepository userAccountRepository;
    @Mock private PermissionEvaluationService permissionEvaluationService;
    @Mock private EmailNotificationService emailNotificationService;
    @Mock private AuditTrailService auditTrailService;
    @Mock private ApplicationEventPublisher eventPublisher;
    @Mock private SystemActorProvider systemActorProvider;

    private ControlledCopyExpiryProcessingService service;
    private UUID copyId;
    private ControlledCopyRecord copy;

    @BeforeEach
    void setUp() {
        service = new ControlledCopyExpiryProcessingService(
                controlledCopyRepository, controlledCopyDistributionBatchRepository, controlledCopyStatusDefinitionRepository,
                userAccountRepository, permissionEvaluationService, emailNotificationService, auditTrailService, eventPublisher,
                systemActorProvider);
        copyId = UUID.randomUUID();
        copy = new ControlledCopyRecord();
        copy.setId(copyId);
        copy.setControlledCopyNumber("CC-EXP-001");
        copy.setStatusCode("DISTRIBUTED");
        copy.setStatus("Distributed");
        copy.setExpiryDate(Instant.now().minusSeconds(3600));
        UserAccount systemActor = new UserAccount();
        systemActor.setId(SystemActorProvider.SYSTEM_ACTOR_ID);
        systemActor.setUsername("system");
        systemActor.setFullName("System (Automated)");
        org.mockito.Mockito.lenient().when(systemActorProvider.get()).thenReturn(systemActor);
        org.mockito.Mockito.lenient().when(controlledCopyStatusDefinitionRepository.findById(any())).thenReturn(Optional.empty());
    }

    @Test
    void obsoleteExpiredCopy_publishesNotificationEvent() {
        when(controlledCopyRepository.findById(copyId)).thenReturn(Optional.of(copy));

        service.obsoleteExpiredCopy(copyId);

        org.mockito.ArgumentCaptor<ControlledCopyActionNotificationEvent> captor =
                org.mockito.ArgumentCaptor.forClass(ControlledCopyActionNotificationEvent.class);
        verify(eventPublisher).publishEvent(captor.capture());
        org.junit.jupiter.api.Assertions.assertEquals(copyId, captor.getValue().copyId());
        org.junit.jupiter.api.Assertions.assertEquals("OBSOLETE", captor.getValue().action());
        org.junit.jupiter.api.Assertions.assertEquals("OBSOLETED", copy.getStatusCode());
    }

    @Test
    void obsoleteExpiredCopy_alreadyObsoleted_isNoOpAndNeverNotifies() {
        copy.setStatusCode("OBSOLETED");
        when(controlledCopyRepository.findById(copyId)).thenReturn(Optional.of(copy));

        service.obsoleteExpiredCopy(copyId);

        verify(eventPublisher, never()).publishEvent(any());
        verify(controlledCopyRepository, never()).saveAndFlush(any());
    }

    @Test
    void sendReminderForCopy_externalRecipient_sendsToEmailAddress() {
        copy.setRecipientName("external.recipient@example.com");
        when(controlledCopyRepository.findById(copyId)).thenReturn(Optional.of(copy));
        when(userAccountRepository.findAllByStatus(any())).thenReturn(List.of());
        when(emailNotificationService.buildControlledCopyVariables(any(), any(), any(), any(), any(), any()))
                .thenReturn(new java.util.HashMap<>());

        service.sendReminderForCopy(copyId);

        verify(emailNotificationService).sendControlledCopyNotificationToEmails(
                eq("controlled-copy-expiry-notification"), eq(List.of("external.recipient@example.com")), any());
        org.junit.jupiter.api.Assertions.assertEquals(true, copy.getExpiryReminderSentAt() != null);
    }

    @Test
    void sendReminderForCopy_alreadySent_isNoOp() {
        copy.setExpiryReminderSentAt(Instant.now());
        when(controlledCopyRepository.findById(copyId)).thenReturn(Optional.of(copy));

        service.sendReminderForCopy(copyId);

        verify(emailNotificationService, never()).sendControlledCopyNotificationToEmails(any(), any(), any());
        verify(emailNotificationService, never()).sendControlledCopyNotification(any(), any(), any());
    }
}
