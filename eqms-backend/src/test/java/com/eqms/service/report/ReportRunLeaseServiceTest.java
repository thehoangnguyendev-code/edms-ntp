package com.eqms.service.report;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.TaskScheduler;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ReportRunLeaseServiceTest {
    @Test void lostAttemptNeverRecoversOwnershipEvenWhenALaterHeartbeatSucceeds() {
        var jdbc=mock(JdbcTemplate.class);
        var scheduler=mock(TaskScheduler.class);
        AtomicReference<Runnable> heartbeat=new AtomicReference<>();
        when(scheduler.scheduleAtFixedRate(any(Runnable.class),any(Instant.class),any(Duration.class)))
                .thenAnswer(call->{heartbeat.set(call.getArgument(0));return null;});
        var id=UUID.randomUUID();
        when(jdbc.update(anyString(),eq(id),eq(3))).thenReturn(0,1);
        var lease=new ReportRunLeaseService(jdbc,scheduler).maintain(id,3);
        lease.requireOwned();
        heartbeat.get().run();
        assertThrows(IllegalStateException.class,lease::requireOwned);
        heartbeat.get().run();
        assertThrows(IllegalStateException.class,lease::requireOwned);
        lease.close();
    }
}
