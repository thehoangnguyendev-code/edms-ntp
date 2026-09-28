package com.eqms.service;

import com.eqms.entity.ControlledCopyRecord;
import com.eqms.entity.UserAccount;
import com.eqms.repository.ControlledCopyRepository;
import com.eqms.repository.UserAccountRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Regression coverage for ControlledCopyActionNotificationEvent's listener: notification for a
 * single-copy action must be dispatched from here (after the triggering transaction has already
 * committed), never eagerly inline inside that transaction -- see the event's own javadoc for the
 * blocking-SMTP/DB-connection-pool-exhaustion risk this replaces.
 */
@ExtendWith(MockitoExtension.class)
class ControlledCopyNotificationAsyncServiceTest {

    @Mock private ControlledCopyService controlledCopyService;
    @Mock private ControlledCopyRepository controlledCopyRepository;
    @Mock private UserAccountRepository userAccountRepository;

    @InjectMocks
    private ControlledCopyNotificationAsyncService service;

    private UUID copyId;
    private UUID actorId;
    private ControlledCopyRecord copy;
    private UserAccount actor;

    @BeforeEach
    void setUp() {
        copyId = UUID.randomUUID();
        actorId = UUID.randomUUID();
        copy = new ControlledCopyRecord();
        copy.setId(copyId);
        actor = new UserAccount();
        actor.setId(actorId);
    }

    @Test
    void onControlledCopyAction_dispatchesStakeholderNotification() {
        when(controlledCopyRepository.findByIdWithDistributionBatch(copyId)).thenReturn(Optional.of(copy));
        when(userAccountRepository.findById(actorId)).thenReturn(Optional.of(actor));

        service.onControlledCopyAction(new ControlledCopyActionNotificationEvent(copyId, actorId, "CANCEL", "No longer needed", null));

        verify(controlledCopyService).notifyControlledCopyStakeholders(copy, actor, "CANCEL", "No longer needed");
        verify(controlledCopyService, never()).sendControlledCopyDistributionNotification(any(), any(), any(), org.mockito.ArgumentMatchers.anyBoolean(), any());
    }

    /**
     * DISTRIBUTE carries a previewPassword -- the recipient-facing e-mail with the preview link +
     * credential is a second, separate call (different template/recipient rules) that must also
     * fire, alongside the generic stakeholder notification.
     */
    @Test
    void onControlledCopyAction_distributeWithPreviewPassword_alsoSendsDistributionNotification() {
        when(controlledCopyRepository.findByIdWithDistributionBatch(copyId)).thenReturn(Optional.of(copy));
        when(userAccountRepository.findById(actorId)).thenReturn(Optional.of(actor));

        service.onControlledCopyAction(new ControlledCopyActionNotificationEvent(copyId, actorId, "DISTRIBUTE", "Distributed", "s3cr3t-preview-pw"));

        verify(controlledCopyService).notifyControlledCopyStakeholders(copy, actor, "DISTRIBUTE", "Distributed");
        verify(controlledCopyService).sendControlledCopyDistributionNotification(copy, actor, "Distributed", false, "s3cr3t-preview-pw");
    }

    @Test
    void onControlledCopyAction_copyNoLongerExists_doesNothing() {
        when(controlledCopyRepository.findByIdWithDistributionBatch(copyId)).thenReturn(Optional.empty());

        service.onControlledCopyAction(new ControlledCopyActionNotificationEvent(copyId, actorId, "CANCEL", "No longer needed", null));

        verify(controlledCopyService, never()).notifyControlledCopyStakeholders(any(), any(), any(), any());
    }

    @Test
    void onControlledCopyAction_nullEvent_doesNotThrow() {
        service.onControlledCopyAction(null);

        verify(controlledCopyRepository, never()).findByIdWithDistributionBatch(any());
    }

    /**
     * The whole point of this async path is that a failure here (e.g. SMTP still down after
     * retries) must never propagate back and affect the already-committed business transaction --
     * there is nothing left to roll back, and no caller waiting synchronously on this result.
     */
    @Test
    void onControlledCopyAction_notifyThrows_isSwallowed() {
        when(controlledCopyRepository.findByIdWithDistributionBatch(copyId)).thenReturn(Optional.of(copy));
        when(userAccountRepository.findById(actorId)).thenReturn(Optional.of(actor));
        org.mockito.Mockito.doThrow(new RuntimeException("SMTP unavailable"))
                .when(controlledCopyService).notifyControlledCopyStakeholders(any(), any(), any(), any());

        service.onControlledCopyAction(new ControlledCopyActionNotificationEvent(copyId, actorId, "CANCEL", "No longer needed", null));
        // No assertion beyond "did not throw" -- reaching this line is the test.
    }
}
