package com.eqms.service;

import org.junit.jupiter.api.Test;
import org.springframework.core.task.TaskExecutor;
import org.springframework.core.task.TaskRejectedException;
import org.springframework.scheduling.TaskScheduler;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ReportJobWorkerTest {
    @Test
    void schedulerOnlyDispatchesOneBatchAndWorkerStopsClaimingAfterLeaseLoss() {
        var reports = mock(ReportPlatformService.class);
        var locks = mock(DistributedSchedulerLockService.class);
        var lease = mock(DistributedSchedulerLockService.SchedulerLease.class);
        var heartbeat = mock(TaskScheduler.class);
        AtomicReference<Runnable> work = new AtomicReference<>();
        TaskExecutor executor = work::set;
        when(locks.tryAcquire(anyString(),any())).thenReturn(lease);
        when(lease.acquired()).thenReturn(true,false);
        var worker = new ReportJobWorker(reports,locks,executor,heartbeat);
        worker.consume(); worker.consume();
        verifyNoInteractions(reports);
        work.get().run();
        verify(reports).recoverExpiredLeases();
        verify(reports,never()).processOneQueuedRun();
        verify(lease).close();
    }

    @Test
    void rejectedDispatchDoesNotClaimAnyJobAndAllowsNextTick() {
        var reports=mock(ReportPlatformService.class);
        var locks=mock(DistributedSchedulerLockService.class);
        var executor=mock(TaskExecutor.class);
        doThrow(new TaskRejectedException("busy")).doNothing().when(executor).execute(any());
        var worker=new ReportJobWorker(reports,locks,executor,mock(TaskScheduler.class));
        assertThrows(TaskRejectedException.class,worker::consume);
        worker.consume();
        verify(executor,times(2)).execute(any());
        verifyNoInteractions(reports,locks);
    }
}
