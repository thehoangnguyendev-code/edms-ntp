package com.eqms.service;

import com.eqms.repository.*;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.mockito.Mockito.*;

class ControlledCopyFencedDispatchTest {
    ControlledCopyService processing=mock(ControlledCopyService.class);
    NotificationRealtimeService realtime=mock(NotificationRealtimeService.class);
    ControlledCopyDistributionJobRepository jobs=mock(ControlledCopyDistributionJobRepository.class);
    ControlledCopyDistributionJobItemRepository items=mock(ControlledCopyDistributionJobItemRepository.class);
    ControlledCopyDistributionWorkerStore store=mock(ControlledCopyDistributionWorkerStore.class);
    ControlledCopyBatchDistributionAsyncService service=new ControlledCopyBatchDistributionAsyncService(processing,realtime,jobs,items);
    ControlledCopyDistributionWorkerStore.Claim claim=new ControlledCopyDistributionWorkerStore.Claim(UUID.randomUUID(),UUID.randomUUID(),UUID.randomUUID(),UUID.randomUUID(),true);
    @Test void productionEventUsesFencedStoreAndLostClaimNeverRestoresCopy(){
        service.configureWorkerStore(store);when(store.claim(claim.jobId(),claim.actorId(),false)).thenReturn(claim);
        when(store.progress(claim)).thenReturn(new ControlledCopyDistributionWorkerStore.Progress(1,0,0,false));
        when(store.nextItem(claim)).thenThrow(new ControlledCopyDistributionWorkerStore.LostClaim());
        service.onBatchDistributed(new ControlledCopyBatchDistributedEvent(claim.batchId(),claim.jobId(),List.of(UUID.randomUUID()),claim.actorId()));
        verifyNoInteractions(processing,jobs,items);verify(store,never()).complete(any());verify(store,never()).failItem(any(),any(),any());
    }
    @Test void schedulerDefersClaimUntilExecutorRunsSoRejectedWorkDoesNotOwnLease(){
        service.configureWorkerStore(store);var executor=mock(org.springframework.core.task.TaskExecutor.class);service.configureBatchExecutor(executor);
        when(store.recoverable()).thenReturn(List.of(new ControlledCopyDistributionWorkerStore.Recovery(claim.jobId(),claim.batchId(),claim.actorId())));
        service.resumePendingJobs();var task=org.mockito.ArgumentCaptor.forClass(Runnable.class);verify(executor).execute(task.capture());
        verify(store,never()).claim(any(),any(),anyBoolean());task.getValue().run();verify(store).claim(claim.jobId(),claim.actorId(),false);
        verifyNoInteractions(jobs,items,processing);
    }
}
