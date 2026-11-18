package com.eqms.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;

/** AUDIT-OBJECT-REGISTRY-2026-11-17: the format of a number, who may change it, and that a change is refused when it is stale or wrong. */
class ObjectNumberServiceTest {
    private static ObjectNumberService.Format format(boolean year, int digits) {
        return new ObjectNumberService.Format("SCHEDULED_REPORT", "Reports", "Scheduled Report Number", "SRP", "-", year, digits, 1);
    }

    @Test
    void aNumberIsPrefixYearAndPaddedSequence() {
        assertEquals("SRP-2026-00001", ObjectNumberService.compose(format(true, 5), 2026, 1));
        assertEquals("SRP-00042", ObjectNumberService.compose(format(false, 5), 2026, 42));
        assertEquals("SRP-2026-123456", ObjectNumberService.compose(format(true, 5), 2026, 123456), "a sequence longer than its digits is never cut");
    }

    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final EffectivePermissionService permissions = mock(EffectivePermissionService.class);
    private final AuditTrailService audit = mock(AuditTrailService.class);
    private final ObjectNumberService service = new ObjectNumberService(jdbc, permissions, audit);

    private UserAccount admin(String... codes) {
        UserAccount actor = mock(UserAccount.class);
        when(actor.getId()).thenReturn(UUID.randomUUID());
        when(actor.getStatus()).thenReturn(UserStatus.Active);
        when(permissions.getEffectivePermissionCodes(actor)).thenReturn(Set.of(codes));
        return actor;
    }

    @Test
    void aPersonWithoutThePermissionCannotChangeAFormat() {
        UserAccount viewer = admin("settings.object_numbering.view");
        assertThrows(SecurityException.class, () -> service.update(viewer, "SCHEDULED_REPORT",
                new ObjectNumberService.FormatWrite("SRP", "-", true, 5, 1, "reason")));
        verify(audit, never()).logAs(any(), anyString(), anyString(), any(), anyString(), any(), any(), any());
    }

    @Test
    void aPersonWhoMayChangeTheSystemConfigurationMayChangeAFormat() {
        UserAccount configurer = admin("settings.object_numbering.manage");
        when(jdbc.queryForList(anyString(), any(Object[].class))).thenReturn(List.of(Map.of("version", 3)));
        // it passes the permission and is stopped only by the stale version
        assertThrows(ResponseStatusException.class, () -> service.update(configurer, "SCHEDULED_REPORT",
                new ObjectNumberService.FormatWrite("SRP", "-", true, 5, 1, "reason")));
    }

    @Test
    void aChangeNeedsAReasonAndAValidFormat() {
        UserAccount manager = admin("settings.object_numbering.manage");
        assertThrows(IllegalArgumentException.class, () -> service.update(manager, "SCHEDULED_REPORT",
                new ObjectNumberService.FormatWrite("SRP", "-", true, 5, 1, " ")));
        when(jdbc.queryForList(anyString(), any(Object[].class))).thenReturn(List.of(Map.of("version", 1)));
        for (ObjectNumberService.FormatWrite bad : List.of(
                new ObjectNumberService.FormatWrite("1AB", "-", true, 5, 1, "r"),
                new ObjectNumberService.FormatWrite("A", "-", true, 5, 1, "r"),
                new ObjectNumberService.FormatWrite("SRP", "<", true, 5, 1, "r"),
                new ObjectNumberService.FormatWrite("SRP", "-- -", true, 5, 1, "r"),
                new ObjectNumberService.FormatWrite("SRP", "ABCD", true, 5, 1, "r"),
                new ObjectNumberService.FormatWrite("SRP", "-", true, 2, 1, "r"),
                new ObjectNumberService.FormatWrite("SRP", "-", true, 11, 1, "r"))) {
            assertThrows(RuntimeException.class, () -> service.update(manager, "SCHEDULED_REPORT", bad), bad.toString());
        }
    }

    @Test
    void aFormatReadBeforeSomeoneElseChangedItIsRefused() {
        UserAccount manager = admin("settings.object_numbering.manage");
        when(jdbc.queryForList(anyString(), any(Object[].class))).thenReturn(List.of(Map.of("version", 3)));
        assertThrows(ResponseStatusException.class, () -> service.update(manager, "SCHEDULED_REPORT",
                new ObjectNumberService.FormatWrite("SRP", "-", true, 5, 1, "reason")));
    }
}
