package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.security.WorkflowActionPolicyResponse;
import com.eqms.entity.UserAccount;
import com.eqms.service.PermissionEvaluationService;
import com.eqms.service.WorkflowActionPolicyService;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * Only surface of the Phase 4 Authorization Console that survived its rollback (see
 * SECURITY_AUTHORIZATION_HYBRID_REFACTOR_PLAN.md Mục 9): editing the hybrid engine's relation
 * set on a workflow policy, which has no legacy equivalent -- the old /security/workflow-action-
 * policies controller only edits {@code workflow_action_policy_actors}, which
 * {@code ResourceAuthorizationAdapter}s no longer read once a resource type's cutover flag is on.
 * The legacy UI now calls this endpoint directly (LifecyclePolicyFormView.tsx's "Relations (New
 * Engine)" section) instead of going through a separate Console. List/get/activate/deactivate
 * were removed here since the legacy /security/workflow-action-policies endpoints already cover
 * them and nothing calls this controller's versions anymore.
 */
@RestController
@RequestMapping("/authorization/workflow-policies")
public class AuthorizationWorkflowPolicyController {

    private final WorkflowActionPolicyService policyService;
    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissionEvaluationService;

    public AuthorizationWorkflowPolicyController(
            WorkflowActionPolicyService policyService,
            CurrentUserService currentUserService,
            PermissionEvaluationService permissionEvaluationService
    ) {
        this.policyService = policyService;
        this.currentUserService = currentUserService;
        this.permissionEvaluationService = permissionEvaluationService;
    }

    public record SetRelationsRequest(List<UUID> relationDefinitionIds, String relationMatchRule,
            String signatureToken, String reason) {}

    @PutMapping("/{id}/relations")
    public WorkflowActionPolicyResponse setRelations(@PathVariable UUID id, @RequestBody SetRelationsRequest request) {
        UserAccount actor = requireManage();
        return policyService.setPolicyRelations(
                id, request.relationDefinitionIds(), request.relationMatchRule(),
                request.signatureToken(), request.reason(), actor);
    }

    private UserAccount requireManage() {
        UserAccount user = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.hasPermission(user, "security.workflow_authorization.manage")) {
            throw new AccessDeniedException("You do not have permission to manage workflow action policies.");
        }
        return user;
    }
}
