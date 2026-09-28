package com.eqms.service;

import com.eqms.entity.ControlledCopyRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.UserAccount;
import com.eqms.repository.ControlledCopyRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Regression: a Controlled Copy auto-Obsoleted as a cascade of Document/Revision Obsolete (or a
 * new Revision publish superseding it) previously only wrote an audit trail entry -- the copy's
 * holder had no notice that their controlled copy is no longer valid. This must now call the same
 * notifyControlledCopyStakeholders(...) path used by every other lifecycle action (Recall/Cancel/
 * Distribute).
 */
@ExtendWith(MockitoExtension.class)
class ControlledCopyLifecycleObsolescenceServiceNotificationTest {

    @Mock private ControlledCopyRepository controlledCopyRepository;
    @Mock private AuditTrailService auditTrailService;
    @Mock private ControlledCopyBatchStatusService controlledCopyBatchStatusService;
    @Mock private ControlledCopyService controlledCopyService;

    private ControlledCopyLifecycleObsolescenceService service;
    private DocumentRevisionRecord revision;
    private ControlledCopyRecord readyCopy;
    private UserAccount actor;

    @BeforeEach
    void setUp() {
        service = new ControlledCopyLifecycleObsolescenceService(
                controlledCopyRepository, auditTrailService, controlledCopyBatchStatusService);
        ReflectionTestUtils.setField(service, "controlledCopyService", controlledCopyService);

        revision = new DocumentRevisionRecord();
        revision.setId(UUID.randomUUID());

        readyCopy = new ControlledCopyRecord();
        readyCopy.setId(UUID.randomUUID());
        readyCopy.setControlledCopyNumber("CC-READY-001");
        readyCopy.setStatusCode("READY_FOR_DISTRIBUTION");
        readyCopy.setCurrentStage("Ready for Distribution");

        actor = new UserAccount();
        actor.setId(UUID.randomUUID());

        when(controlledCopyRepository.findAllByRevision_IdOrderByCopyNumberAsc(revision.getId()))
                .thenReturn(List.of(readyCopy));
    }

    @Test
    void obsoleteControlledCopiesForRevision_notifiesHolderForEachObsoletedCopy() {
        service.obsoleteControlledCopiesForRevision(
                revision, actor, Instant.now(),
                ControlledCopyLifecycleObsolescenceService.REASON_REVISION_OBSOLETED,
                "Parent revision obsoleted", null);

        verify(controlledCopyService).notifyControlledCopyStakeholders(
                eq(readyCopy), eq(actor), eq("OBSOLETE"), any());
    }

    @Test
    void obsoleteControlledCopiesForRevision_skipsAlreadyTerminalCopy_noNotification() {
        ControlledCopyRecord cancelledCopy = new ControlledCopyRecord();
        cancelledCopy.setId(UUID.randomUUID());
        cancelledCopy.setStatusCode("CLOSED_CANCELLED");
        cancelledCopy.setCurrentStage("Closed - Cancelled");
        when(controlledCopyRepository.findAllByRevision_IdOrderByCopyNumberAsc(revision.getId()))
                .thenReturn(List.of(cancelledCopy));

        service.obsoleteControlledCopiesForRevision(
                revision, actor, Instant.now(),
                ControlledCopyLifecycleObsolescenceService.REASON_REVISION_OBSOLETED,
                "Parent revision obsoleted", null);

        verify(controlledCopyService, org.mockito.Mockito.never())
                .notifyControlledCopyStakeholders(any(), any(), any(), any());
    }
}
