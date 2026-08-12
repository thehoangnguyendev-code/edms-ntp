package com.eqms.controller;

import com.eqms.dto.security.*;
import com.eqms.entity.UserAccount;
import com.eqms.auth.CurrentUserService;
import com.eqms.service.PermissionEvaluationService;
import com.eqms.service.WorkflowActionPolicyService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping({"/security/workflow-action-policies", "/settings/workflow-action-policies"})
public class WorkflowActionPolicyController {

    private final WorkflowActionPolicyService policyService;
    private final PermissionEvaluationService permissionEvaluationService;
    private final CurrentUserService currentUserService;

    public WorkflowActionPolicyController(
            WorkflowActionPolicyService policyService,
            PermissionEvaluationService permissionEvaluationService,
            CurrentUserService currentUserService
    ) {
        this.policyService = policyService;
        this.permissionEvaluationService = permissionEvaluationService;
        this.currentUserService = currentUserService;
    }

    // ── Read ──────────────────────────────────────────────────────────────────

    @GetMapping("/paged")
    public ResponseEntity<com.eqms.dto.user.PageResponse<WorkflowActionPolicyResponse>> listPaged(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String workflow,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String fromStatus,
            @RequestParam(required = false) String documentType,
            @RequestParam(required = false) String active,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String createdFrom,
            @RequestParam(required = false) String createdTo,
            @RequestParam(required = false) String updatedFrom,
            @RequestParam(required = false) String updatedTo,
            @RequestParam(defaultValue = "action") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDir) {
        requireView();
        return ResponseEntity.ok(policyService.listPaged(page, limit, search, workflow, action, fromStatus, documentType, active, type,
                createdFrom, createdTo, updatedFrom, updatedTo, sortBy, sortDir));
    }

    @GetMapping
    public ResponseEntity<List<WorkflowActionPolicyResponse>> listAll() {
        requireView();
        return ResponseEntity.ok(policyService.listAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<WorkflowActionPolicyResponse> getById(@PathVariable UUID id) {
        requireView();
        return ResponseEntity.ok(policyService.getById(id));
    }

    @GetMapping("/defaults/document-revision")
    public ResponseEntity<List<WorkflowActionPolicyResponse>> getSystemDefaults() {
        requireView();
        return ResponseEntity.ok(policyService.getDefaultDocumentRevisionPolicies());
    }

    @GetMapping("/effective")
    public ResponseEntity<WorkflowActionPolicyEffectiveResponse> getEffective(
            @RequestParam String moduleKey,
            @RequestParam String workflowKey,
            @RequestParam String objectType,
            @RequestParam String actionCode,
            @RequestParam String fromStatus,
            @RequestParam(required = false) UUID documentTypeId
    ) {
        requireView();
        return ResponseEntity.ok(policyService.getEffectivePolicy(
                moduleKey, workflowKey, objectType, actionCode, fromStatus, documentTypeId));
    }

    @GetMapping("/options")
    public ResponseEntity<WorkflowActionPolicyOptionsResponse> getOptions() {
        requireView();
        return ResponseEntity.ok(policyService.getOptions());
    }

    // ── Mutations ─────────────────────────────────────────────────────────────

    @PostMapping
    public ResponseEntity<WorkflowActionPolicyResponse> createPolicy(
            @Valid @RequestBody WorkflowActionPolicyCreateRequest request
    ) {
        UserAccount actor = requireManage();
        return ResponseEntity.status(HttpStatus.CREATED).body(policyService.createPolicy(request, actor));
    }

    @PutMapping("/{id}")
    public ResponseEntity<WorkflowActionPolicyResponse> updatePolicy(
            @PathVariable UUID id,
            @Valid @RequestBody WorkflowActionPolicyRequest request
    ) {
        UserAccount actor = requireManage();
        return ResponseEntity.ok(policyService.updatePolicy(id, request, actor));
    }

    @PostMapping("/{id}/create-document-type-override")
    public ResponseEntity<WorkflowActionPolicyResponse> createDocumentTypeOverride(
            @PathVariable UUID id,
            @Valid @RequestBody WorkflowActionPolicyOverrideRequest request
    ) {
        UserAccount actor = requireManage();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(policyService.createDocumentTypeOverride(id, request, actor));
    }

    @PostMapping("/{id}/duplicate")
    public ResponseEntity<WorkflowActionPolicyResponse> duplicatePolicy(
            @PathVariable UUID id,
            @RequestBody(required = false) WorkflowActionPolicyDuplicateRequest request
    ) {
        UserAccount actor = requireManage();
        WorkflowActionPolicyDuplicateRequest req = request != null ? request
                : new WorkflowActionPolicyDuplicateRequest(null, null, null, false, null, null);
        return ResponseEntity.status(HttpStatus.CREATED).body(policyService.duplicatePolicy(id, req, actor));
    }

    @PostMapping("/{id}/preview-update")
    public ResponseEntity<WorkflowActionPolicyPreviewResponse> previewUpdate(
            @PathVariable UUID id,
            @Valid @RequestBody WorkflowActionPolicyRequest request
    ) {
        requireView();
        return ResponseEntity.ok(policyService.previewUpdate(id, request));
    }

    @PostMapping("/{id}/activate")
    public ResponseEntity<WorkflowActionPolicyResponse> activate(@PathVariable UUID id,
            @RequestBody(required = false) com.eqms.dto.settings.SecurityChangeRequest sig) {
        UserAccount actor = requireManage();
        return ResponseEntity.ok(policyService.activatePolicy(
                id, actor, com.eqms.dto.settings.SecurityChangeRequest.orEmpty(sig)));
    }

    @PostMapping("/{id}/deactivate")
    public ResponseEntity<WorkflowActionPolicyResponse> deactivate(@PathVariable UUID id,
            @RequestBody(required = false) com.eqms.dto.settings.SecurityChangeRequest sig) {
        UserAccount actor = requireManage();
        return ResponseEntity.ok(policyService.deactivatePolicy(
                id, actor, com.eqms.dto.settings.SecurityChangeRequest.orEmpty(sig)));
    }

    @PostMapping("/{id}/reset-default")
    public ResponseEntity<WorkflowActionPolicyResponse> resetToDefault(@PathVariable UUID id,
            @RequestBody(required = false) com.eqms.dto.settings.SecurityChangeRequest sig) {
        UserAccount actor = requireManage();
        com.eqms.dto.settings.SecurityChangeRequest safe = com.eqms.dto.settings.SecurityChangeRequest.orEmpty(sig);
        return ResponseEntity.ok(policyService.resetToSystemDefault(id, actor, safe.signatureToken(), safe.reason()));
    }

    // ── Permission guards ─────────────────────────────────────────────────────

    private void requireView() {
        UserAccount user = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.hasPermission(user, "security.workflow_authorization.view")) {
            throw new AccessDeniedException(
                    "You do not have permission to view workflow action policies.");
        }
    }

    private UserAccount requireManage() {
        UserAccount user = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.hasPermission(user, "security.workflow_authorization.manage")) {
            throw new AccessDeniedException(
                    "You do not have permission to manage workflow action policies.");
        }
        return user;
    }
}
