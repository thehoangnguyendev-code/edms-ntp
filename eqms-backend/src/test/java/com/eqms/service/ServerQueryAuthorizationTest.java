package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.entity.UserAccount;
import com.eqms.repository.*;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class ServerQueryAuthorizationTest {
    @Test void authorizationPageRefusesAnotherUsersSummaryBeforeReadingAssignmentsOrCatalog() {
        var current = mock(CurrentUserService.class); var permissions = mock(PermissionEvaluationService.class);
        var assignments = mock(UserAccessProfileRepository.class); var roles = mock(WorkflowRoleRepository.class);
        var users = mock(UserAccountRepository.class);
        var actor = new UserAccount(); actor.setId(UUID.randomUUID());
        when(current.requireCurrentUser()).thenReturn(actor);
        var service = new UserAuthorizationSummaryService(current, permissions, mock(EffectivePermissionService.class), users,
                assignments, mock(AccessProfilePermissionSetRepository.class), mock(AccessProfileWorkflowRoleRepository.class), mock(PermissionSetRepository.class), roles);
        assertThatThrownBy(() -> service.querySummary(UUID.randomUUID(), "search", 1, 10)).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(users, assignments, roles);
    }
}
