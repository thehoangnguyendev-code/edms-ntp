package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.controlledcopypolicy.ControlledCopyPolicyRequest;
import com.eqms.dto.controlledcopypolicy.ControlledCopyPolicyResponse;
import com.eqms.service.ControlledCopyPolicyService;
import com.eqms.service.PermissionEvaluationService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/settings/controlled-copy-policy")
public class ControlledCopyPolicyController {

    public record DcoEligibleUserResponse(String id, String fullName, String email) {}

    private final ControlledCopyPolicyService service;
    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissionEvaluationService;

    public ControlledCopyPolicyController(
            ControlledCopyPolicyService service,
            CurrentUserService currentUserService,
            PermissionEvaluationService permissionEvaluationService
    ) {
        this.service = service;
        this.currentUserService = currentUserService;
        this.permissionEvaluationService = permissionEvaluationService;
    }

    @GetMapping
    public ResponseEntity<ControlledCopyPolicyResponse> getPolicy() {
        requireAccess();
        return ResponseEntity.ok(service.getPolicy());
    }

    @PutMapping
    public ResponseEntity<ControlledCopyPolicyResponse> savePolicy(@RequestBody ControlledCopyPolicyRequest request) {
        requireManageAccess();
        return ResponseEntity.ok(service.savePolicy(request));
    }

    /**
     * Users eligible to be selected as the DCO delivery recipient -- restricted to those holding
     * {@link ControlledCopyPolicyService#DCO_RECIPIENT_PERMISSION}, not any hardcoded role name.
     */
    @GetMapping("/dco-eligible-users")
    public ResponseEntity<List<DcoEligibleUserResponse>> getDcoEligibleUsers() {
        requireManageAccess();
        return ResponseEntity.ok(service.listDcoEligibleUsers().stream()
                .map(u -> new DcoEligibleUserResponse(u.getId().toString(), u.getFullName(), u.getEmail()))
                .toList());
    }

    private void requireAccess() {
        var user = currentUserService.requireCurrentUser();
        boolean allowed = permissionEvaluationService.hasPermission(user, "settings.controlled_copy_policy.view")
                || permissionEvaluationService.hasPermission(user, "settings.controlled_copy_policy.manage")
                || permissionEvaluationService.isSuperAdmin(user);
        if (!allowed) throw new AccessDeniedException("Access denied");
    }

    private void requireManageAccess() {
        var user = currentUserService.requireCurrentUser();
        boolean allowed = permissionEvaluationService.hasPermission(user, "settings.controlled_copy_policy.manage")
                || permissionEvaluationService.isSuperAdmin(user);
        if (!allowed) throw new AccessDeniedException("Access denied");
    }
}
