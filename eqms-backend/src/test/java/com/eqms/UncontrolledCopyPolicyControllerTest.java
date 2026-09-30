package com.eqms;

import com.eqms.auth.CurrentUserService;
import com.eqms.controller.UncontrolledCopyPolicyController;
import com.eqms.dto.uncontrolledcopy.UncontrolledCopyEligibilityRuleRequest;
import com.eqms.entity.UserAccount;
import com.eqms.service.PermissionEvaluationService;
import com.eqms.service.UncontrolledCopyMarkingPreviewService;
import com.eqms.service.UncontrolledCopyPolicyService;
import com.eqms.service.UncontrolledCopyService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UncontrolledCopyPolicyControllerTest {
    @Mock private CurrentUserService currentUserService;
    @Mock private PermissionEvaluationService permissionEvaluationService;
    @Mock private UncontrolledCopyPolicyService service;
    @Mock private UncontrolledCopyMarkingPreviewService markingPreviewService;
    @Mock private UncontrolledCopyService uncontrolledCopyService;
    @InjectMocks private UncontrolledCopyPolicyController controller;

    @Test void unauthorizedRuleChangesNeverReachService() {
        when(currentUserService.requireCurrentUser()).thenReturn(new UserAccount());
        var id = UUID.randomUUID();
        var request = new UncontrolledCopyEligibilityRuleRequest(null, true, false, null);
        assertThrows(AccessDeniedException.class, () -> controller.updateEligibilityRule(id, request));
        assertThrows(AccessDeniedException.class, () -> controller.deleteEligibilityRule(id, null));
        verifyNoInteractions(uncontrolledCopyService);
    }

    @Test void configuredManagementPermissionAllowsAllRuleMutations() {
        var actor = new UserAccount();
        when(currentUserService.requireCurrentUser()).thenReturn(actor);
        when(permissionEvaluationService.hasAnyPermission(actor,
                "documents.admin.uncontrolled_copies_policy.manage", "settings.configuration.manage")).thenReturn(true);
        var id = UUID.randomUUID();
        var request = new UncontrolledCopyEligibilityRuleRequest(null, true, false, null);
        controller.updateEligibilityRule(id, request);
        controller.deleteEligibilityRule(id, "reason");
        verify(uncontrolledCopyService).updateEligibilityRule(id, request);
        verify(uncontrolledCopyService).deleteEligibilityRule(id, "reason");
    }
}
