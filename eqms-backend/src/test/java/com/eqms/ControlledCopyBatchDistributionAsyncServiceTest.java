package com.eqms;

import com.eqms.entity.ControlledCopyDistributionJob;
import com.eqms.entity.ControlledCopyDistributionJobItem;
import com.eqms.entity.ControlledCopyRecord;
import com.eqms.repository.ControlledCopyDistributionJobItemRepository;
import com.eqms.repository.ControlledCopyDistributionJobRepository;
import com.eqms.service.ControlledCopyBatchDistributedEvent;
import com.eqms.service.ControlledCopyBatchDistributionAsyncService;
import com.eqms.service.ControlledCopyFinalizationOutcome;
import com.eqms.service.ControlledCopyService;
import com.eqms.service.NotificationRealtimeService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ControlledCopyBatchDistributionAsyncServiceTest {

    @Mock private ControlledCopyService controlledCopyService;
    @Mock private NotificationRealtimeService notificationRealtimeService;
    @Mock private ControlledCopyDistributionJobRepository jobRepository;
    @Mock private ControlledCopyDistributionJobItemRepository itemRepository;

    @InjectMocks private ControlledCopyBatchDistributionAsyncService asyncService;

    @Test
    void onBatchDistributed_terminalCopyIsSkippedAndNotCountedAsSucceeded() {
        UUID batchId = UUID.randomUUID();
        UUID jobId = UUID.randomUUID();
        UUID copyId = UUID.randomUUID();
        UUID issuerId = UUID.randomUUID();
        ControlledCopyDistributionJob job = new ControlledCopyDistributionJob();
        job.setId(jobId);
        ControlledCopyRecord copy = new ControlledCopyRecord();
        copy.setId(copyId);
        ControlledCopyDistributionJobItem item = new ControlledCopyDistributionJobItem();
        item.setControlledCopy(copy);
        item.setStatus("PENDING");

        when(itemRepository.findAllByJob_IdOrderByIdAsc(jobId)).thenReturn(List.of(item));
        when(jobRepository.findById(jobId)).thenReturn(Optional.of(job));
        when(controlledCopyService.finalizeDistributedCopy(copyId, issuerId))
                .thenReturn(ControlledCopyFinalizationOutcome.SKIPPED_TERMINAL);

        asyncService.onBatchDistributed(new ControlledCopyBatchDistributedEvent(batchId, jobId, List.of(copyId), issuerId));

        assertEquals("SKIPPED", item.getStatus());
        assertEquals(0, job.getSucceededItems());
        assertEquals(0, job.getFailedItems());
        assertEquals("COMPLETED_WITH_ERRORS", job.getStatus());
        verify(controlledCopyService, never()).sendDcoBatchZipEmail(eq(batchId), any(), eq(issuerId));
    }
}
