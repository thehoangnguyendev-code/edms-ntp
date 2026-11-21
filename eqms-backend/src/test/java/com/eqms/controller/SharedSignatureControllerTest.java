package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.entity.UserAccount;
import com.eqms.service.ElectronicSignatureService;
import com.eqms.service.PermissionEvaluationService;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** The generic signature lookup is audit evidence: a person without the Audit Trail view permission is refused before any read. */
class SharedSignatureControllerTest {

    private final ElectronicSignatureService signatures = mock(ElectronicSignatureService.class);
    private final CurrentUserService users = mock(CurrentUserService.class);
    private final PermissionEvaluationService permissions = mock(PermissionEvaluationService.class);
    private final UserAccount user = mock(UserAccount.class);
    private final SharedSignatureController controller = new SharedSignatureController(signatures, users, permissions);

    @Test
    void personWithoutAuditViewIsRefusedAndNothingIsRead() {
        when(users.requireCurrentUser()).thenReturn(user);
        when(permissions.hasPermission(user, "audit.view")).thenReturn(false);

        assertThrows(AccessDeniedException.class, () -> controller.getSharedSignatures("documents", UUID.randomUUID()));

        verify(signatures, never()).getEntitySignatures(anyString(), any());
    }

    @Test
    void personWithAuditViewReadsTheSignatures() {
        UUID id = UUID.randomUUID();
        when(users.requireCurrentUser()).thenReturn(user);
        when(permissions.hasPermission(user, "audit.view")).thenReturn(true);
        when(signatures.getEntitySignatures("documents", id)).thenReturn(List.of());

        assertEquals(200, controller.getSharedSignatures("documents", id).getStatusCode().value());
        verify(signatures).getEntitySignatures("documents", id);
    }
}
