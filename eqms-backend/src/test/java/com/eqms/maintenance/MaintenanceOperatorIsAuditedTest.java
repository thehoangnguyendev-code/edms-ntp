package com.eqms.maintenance;

import com.eqms.service.AuditTrailService;
import com.eqms.service.BackupAgentClient;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.HttpMethod;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** What the person who operates the maintenance window does is written to the Audit Trail, and a failure to write never keeps the window from being reopened. */
class MaintenanceOperatorIsAuditedTest {

    private final BackupAgentClient agent = Mockito.mock(BackupAgentClient.class);
    private final MaintenancePassService passes = Mockito.mock(MaintenancePassService.class);
    private final AuditTrailService audit = Mockito.mock(AuditTrailService.class);
    private final MaintenanceController controller = new MaintenanceController(agent, passes, Mockito.mock(MaintenanceGateFilter.class),
            Mockito.mock(MaintenanceAnnouncements.class), null, null, null, null, audit);

    @Test
    void unlockIsRecordedWithTheNameOfTheOperator() {
        when(passes.verify("token")).thenReturn(Optional.of("super.admin"));
        when(agent.exchange(eq(HttpMethod.POST), eq("/internal/maintenance/unlock"), anyMap()))
                .thenReturn(new BackupAgentClient.Reply(200, new ObjectMapper().createObjectNode().put("requestId", "r1")));

        controller.unlock("token", null);

        verify(audit).logMaintenanceOperator(eq("super.admin"), eq("BACKUP_RESTORE"), eq("Maintenance window"), any(), eq("MAINTENANCE_UNLOCKED"), isNull(), isNull(), contains("reopened"));
    }

    @Test
    void aRefusedAttemptWithoutAPassChangesNothingAndRecordsNothing() {
        when(passes.verify(any())).thenReturn(Optional.empty());

        controller.unlock("bad", null);

        verify(audit, never()).logMaintenanceOperator(any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void aFailureToWriteTheAuditNeverKeepsTheOperatorFromReopening() {
        when(passes.verify("token")).thenReturn(Optional.of("super.admin"));
        when(agent.exchange(eq(HttpMethod.POST), eq("/internal/maintenance/unlock"), anyMap()))
                .thenReturn(new BackupAgentClient.Reply(200, new ObjectMapper().createObjectNode().put("requestId", "r1")));
        Mockito.doThrow(new IllegalStateException("database is being restored")).when(audit)
                .logMaintenanceOperator(any(), any(), any(), any(), any(), any(), any(), any());

        var answer = controller.unlock("token", null);

        org.junit.jupiter.api.Assertions.assertEquals(200, answer.getStatusCode().value());
    }
}
