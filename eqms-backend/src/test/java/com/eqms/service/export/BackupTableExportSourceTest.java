package com.eqms.service.export;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.eqms.auth.CurrentUserService;
import com.eqms.entity.UserAccount;
import com.eqms.service.BackupAgentClient;
import com.eqms.service.PermissionEvaluationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.util.MultiValueMap;

/** REPORT-BACKUP-RUNS-2026-11-15: the export of the backup registers reads every page of the agent's answer, passes only the filters it knows, and needs the permission of the screens. */
class BackupTableExportSourceTest {
    private final ObjectMapper json = new ObjectMapper();
    private final BackupAgentClient agent = mock(BackupAgentClient.class);
    private final CurrentUserService current = mock(CurrentUserService.class);
    private final PermissionEvaluationService permissions = mock(PermissionEvaluationService.class);
    private final BackupTableExportSource source = new BackupTableExportSource(agent, current, permissions);

    @Test
    void everyPageOfTheFilteredListIsWrittenAndOnlyKnownFiltersTravelOn() throws Exception {
        var actor = new UserAccount();
        when(current.requireCurrentUser()).thenReturn(actor);
        when(permissions.hasAnyPermission(actor, "backup.module.view")).thenReturn(true);
        when(agent.get(eq("/internal/backups"), any())).thenAnswer(call -> {
            MultiValueMap<String, String> q = call.getArgument(1);
            int page = Integer.parseInt(q.getFirst("page"));
            return json.readTree("{\"data\":[{\"id\":\"BK-" + page + "\",\"status\":\"COMPLETED\",\"sizeBytes\":10,\"components\":[{\"key\":\"DATABASE\",\"status\":\"COMPLETED\"}]}],\"pagination\":{\"totalPages\":2}}");
        });
        try (var writer = new TableExcelWriter()) {
            source.writeBackups(Map.of("status", "COMPLETED", "password", "must-not-travel", "sortDirection", "asc"), writer);
            assertEquals(2, writer.recordCount());
        }
        var captured = org.mockito.ArgumentCaptor.forClass(MultiValueMap.class);
        verify(agent, times(2)).get(eq("/internal/backups"), captured.capture());
        MultiValueMap<String, String> last = captured.getValue();
        assertEquals("COMPLETED", last.getFirst("status"));
        assertEquals("asc", last.getFirst("sortDirection"));
        assertNull(last.getFirst("password"));
    }

    @Test
    void withoutTheViewPermissionNothingIsRead() throws Exception {
        var actor = new UserAccount();
        when(current.requireCurrentUser()).thenReturn(actor);
        when(permissions.hasAnyPermission(actor, "backup.module.view")).thenReturn(false);
        try (var writer = new TableExcelWriter()) {
            assertThrows(AccessDeniedException.class, () -> source.writeProductionRestores(Map.of(), writer));
        }
        verifyNoInteractions(agent);
    }
}
