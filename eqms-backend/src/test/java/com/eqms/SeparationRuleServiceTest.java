package com.eqms;

import com.eqms.entity.UserAccount;
import com.eqms.exception.WorkflowPolicyException;
import com.eqms.service.PermissionEvaluationService;
import com.eqms.service.SeparationRuleService;
import com.eqms.service.WorkflowActionPolicyService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** Who may see and switch the "a different person" rules; nothing is read or changed for a person who may not. */
@ExtendWith(MockitoExtension.class)
class SeparationRuleServiceTest {
    @Mock private JdbcTemplate jdbc;
    @Mock private WorkflowActionPolicyService policies;
    @Mock private PermissionEvaluationService permissions;

    private SeparationRuleService service;
    private UserAccount actor;

    @BeforeEach
    void setUp() {
        service = new SeparationRuleService(jdbc, policies, permissions);
        actor = new UserAccount();
        actor.setId(UUID.randomUUID());
    }

    @Test
    void aPersonWithoutTheViewOrManagePermissionCannotListTheRules() {
        when(permissions.hasAnyPermission(actor, "security.workflow_authorization.view", "security.workflow_authorization.manage")).thenReturn(false);
        assertThrows(AccessDeniedException.class, () -> service.list(actor));
        verifyNoInteractions(jdbc, policies);
    }

    @Test
    void aPersonWithoutTheManagePermissionCannotSwitchARule() {
        when(permissions.hasPermission(actor, "security.workflow_authorization.manage")).thenReturn(false);
        assertThrows(AccessDeniedException.class, () -> service.set(UUID.randomUUID(), true, "reason", "token", actor));
        verifyNoInteractions(jdbc, policies);
    }

    @Test
    void aSwitchWithoutAReasonIsRefusedBeforeAnythingIsChanged() {
        when(permissions.hasPermission(actor, "security.workflow_authorization.manage")).thenReturn(true);
        assertThrows(WorkflowPolicyException.class, () -> service.set(UUID.randomUUID(), true, "  ", "token", actor));
        verify(policies, never()).setForbiddenRelations(any(), any(), any(), any(), any());
        verifyNoInteractions(jdbc);
    }

    @Test
    void savingSeveralRulesIsRefusedWithoutThePermission() {
        when(permissions.hasPermission(actor, "security.workflow_authorization.manage")).thenReturn(false);
        assertThrows(AccessDeniedException.class, () -> service.setMany(java.util.List.of(new SeparationRuleService.Change(UUID.randomUUID(), true)), "reason", "token", actor));
        verifyNoInteractions(jdbc, policies);
    }

    @Test
    void savingSeveralRulesNeedsAReasonAndAtLeastOneChange() {
        when(permissions.hasPermission(actor, "security.workflow_authorization.manage")).thenReturn(true);
        assertThrows(WorkflowPolicyException.class, () -> service.setMany(java.util.List.of(new SeparationRuleService.Change(UUID.randomUUID(), true)), " ", "token", actor));
        assertThrows(WorkflowPolicyException.class, () -> service.setMany(java.util.List.of(), "reason", "token", actor));
        assertThrows(WorkflowPolicyException.class, () -> service.setMany(null, "reason", "token", actor));
        verify(policies, never()).setForbiddenRelationsMany(any(), any(), any(), any());
        verifyNoInteractions(jdbc);
    }
}
