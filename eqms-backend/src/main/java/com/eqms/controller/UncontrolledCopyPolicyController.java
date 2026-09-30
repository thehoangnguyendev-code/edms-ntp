package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.controlledcopypolicy.ControlledCopyMarkingPreviewResponse;
import com.eqms.dto.uncontrolledcopy.UncontrolledCopyEligibilityRuleRequest;
import com.eqms.dto.uncontrolledcopy.UncontrolledCopyEligibilityRuleResponse;
import com.eqms.dto.uncontrolledcopypolicy.UncontrolledCopyMarkingPreviewRequest;
import com.eqms.dto.uncontrolledcopypolicy.UncontrolledCopyPolicyRequest;
import com.eqms.dto.uncontrolledcopypolicy.UncontrolledCopyPolicyResponse;
import com.eqms.service.PermissionEvaluationService;
import com.eqms.service.UncontrolledCopyMarkingPreviewService;
import com.eqms.service.UncontrolledCopyPolicyService;
import com.eqms.service.UncontrolledCopyService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/documents/administration/uncontrolled-copies-policy")
public class UncontrolledCopyPolicyController {

    private final UncontrolledCopyPolicyService service;
    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissionEvaluationService;
    private final UncontrolledCopyMarkingPreviewService markingPreviewService;
    private final UncontrolledCopyService uncontrolledCopyService;

    public UncontrolledCopyPolicyController(
            UncontrolledCopyPolicyService service,
            CurrentUserService currentUserService,
            PermissionEvaluationService permissionEvaluationService,
            UncontrolledCopyMarkingPreviewService markingPreviewService,
            UncontrolledCopyService uncontrolledCopyService
    ) {
        this.markingPreviewService = markingPreviewService;
        this.service = service;
        this.currentUserService = currentUserService;
        this.permissionEvaluationService = permissionEvaluationService;
        this.uncontrolledCopyService = uncontrolledCopyService;
    }

    @GetMapping
    public ResponseEntity<UncontrolledCopyPolicyResponse> getPolicy() {
        requireAccess();
        return ResponseEntity.ok(service.getPolicy());
    }

    @PutMapping
    public ResponseEntity<UncontrolledCopyPolicyResponse> savePolicy(@RequestBody UncontrolledCopyPolicyRequest request) {
        requireManageAccess();
        return ResponseEntity.ok(service.savePolicy(request));
    }

    /**
     * A picture of a Publishing Template page with the DRAFT uncontrolled-copy watermark/stamp on it (nothing is saved), drawn
     * by the server with the same engine and lines as real generation. Same response shape as the Controlled Copy preview.
     * Gated like saving the policy (policy administrators only), mirroring the Controlled Copies Policy preview.
     */
    @PostMapping("/marking-preview")
    public ResponseEntity<ControlledCopyMarkingPreviewResponse> markingPreview(@RequestBody UncontrolledCopyMarkingPreviewRequest request) {
        requireManageAccess();
        return ResponseEntity.ok(markingPreviewService.preview(request));
    }

    // ------------------------------------------------------------------------------------------------------------
    // Eligibility rule matrix (V503 uncontrolled_copy_eligibility_rules) -- sibling resource under the same
    // path/permissions as the policy itself, per the design ("nothing exists for this yet" -> built here).
    // ------------------------------------------------------------------------------------------------------------

    @GetMapping("/eligibility-rules")
    public ResponseEntity<List<UncontrolledCopyEligibilityRuleResponse>> listEligibilityRules() {
        requireAccess();
        return ResponseEntity.ok(uncontrolledCopyService.listEligibilityRules());
    }

    @GetMapping("/eligibility-rules/page")
    public ResponseEntity<com.eqms.dto.user.PageResponse<UncontrolledCopyEligibilityRuleResponse>> listEligibilityRulesPaged(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "updatedAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDirection) {
        requireAccess();
        return ResponseEntity.ok(uncontrolledCopyService.listEligibilityRulesPaged(page, limit, search, status, sortBy, sortDirection));
    }

    @PostMapping("/eligibility-rules")
    public ResponseEntity<UncontrolledCopyEligibilityRuleResponse> createEligibilityRule(
            @RequestBody UncontrolledCopyEligibilityRuleRequest request) {
        requireManageAccess();
        return ResponseEntity.ok(uncontrolledCopyService.createEligibilityRule(request));
    }

    @PutMapping("/eligibility-rules/{id}")
    public ResponseEntity<UncontrolledCopyEligibilityRuleResponse> updateEligibilityRule(
            @PathVariable UUID id, @RequestBody UncontrolledCopyEligibilityRuleRequest request) {
        requireManageAccess();
        return ResponseEntity.ok(uncontrolledCopyService.updateEligibilityRule(id, request));
    }

    @DeleteMapping("/eligibility-rules/{id}")
    public ResponseEntity<Void> deleteEligibilityRule(@PathVariable UUID id, @RequestParam(required = false) String reason) {
        requireManageAccess();
        uncontrolledCopyService.deleteEligibilityRule(id, reason);
        return ResponseEntity.noContent().build();
    }

    private void requireAccess() {
        var user = currentUserService.requireCurrentUser();
        boolean allowed = permissionEvaluationService.hasAnyPermission(user,
                "documents.admin.uncontrolled_copies_policy.view", "documents.admin.uncontrolled_copies_policy.manage",
                "settings.configuration.view", "settings.configuration.manage");
        if (!allowed) throw new AccessDeniedException("Access denied");
    }

    private void requireManageAccess() {
        var user = currentUserService.requireCurrentUser();
        boolean allowed = permissionEvaluationService.hasAnyPermission(user,
                "documents.admin.uncontrolled_copies_policy.manage", "settings.configuration.manage");
        if (!allowed) throw new AccessDeniedException("Access denied");
    }
}
