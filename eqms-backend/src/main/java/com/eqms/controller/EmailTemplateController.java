package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.email.EmailTemplatePreviewResponse;
import com.eqms.dto.email.EmailTemplatePreviewDraftRequest;
import com.eqms.dto.email.EmailTemplateRequest;
import com.eqms.dto.email.EmailTemplateResponse;
import com.eqms.dto.email.EmailTemplatePublishRequest;
import com.eqms.dto.email.EmailTemplateRestoreVersionRequest;
import com.eqms.dto.email.EmailTemplateTestSendRequest;
import com.eqms.dto.email.EmailTemplateTestSendResponse;
import com.eqms.dto.email.EmailTemplateVersionResponse;
import com.eqms.dto.user.PageResponse;
import com.eqms.entity.EmailTemplate;
import com.eqms.service.EmailService;
import com.eqms.service.EmailTemplateService;
import com.eqms.service.PermissionEvaluationService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/settings/email-templates")
public class EmailTemplateController {

    private final EmailTemplateService service;
    private final EmailService emailService;
    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissionEvaluationService;

    public EmailTemplateController(
            EmailTemplateService service,
            EmailService emailService,
            CurrentUserService currentUserService,
            PermissionEvaluationService permissionEvaluationService
    ) {
        this.service = service;
        this.emailService = emailService;
        this.currentUserService = currentUserService;
        this.permissionEvaluationService = permissionEvaluationService;
    }

    @GetMapping
    public ResponseEntity<PageResponse<EmailTemplateResponse>> getAllTemplates(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String createdFrom,
            @RequestParam(required = false) String createdTo,
            @RequestParam(required = false) String updatedFrom,
            @RequestParam(required = false) String updatedTo,
            @RequestParam(required = false, defaultValue = "createdDate") String sortBy,
            @RequestParam(required = false, defaultValue = "desc") String sortDirection,
            @RequestParam(required = false, defaultValue = "1") int page,
            @RequestParam(required = false, defaultValue = "10") int limit
    ) {
        requireViewPermission();
        return ResponseEntity.ok(service.listTemplates(search, type, status, createdFrom, createdTo, updatedFrom, updatedTo, sortBy, sortDirection, page, limit));
    }

    @GetMapping("/export")
    public ResponseEntity<List<EmailTemplateResponse>> exportTemplates(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String createdFrom,
            @RequestParam(required = false) String createdTo,
            @RequestParam(required = false) String updatedFrom,
            @RequestParam(required = false) String updatedTo,
            @RequestParam(required = false, defaultValue = "createdDate") String sortBy,
            @RequestParam(required = false, defaultValue = "desc") String sortDirection
    ) {
        requireViewPermission();
        return ResponseEntity.ok(service.exportTemplates(search, type, status, createdFrom, createdTo, updatedFrom, updatedTo, sortBy, sortDirection));
    }

    @GetMapping("/{id}")
    public ResponseEntity<EmailTemplateResponse> getTemplateById(@PathVariable UUID id) {
        requireViewPermission();
        return ResponseEntity.ok(service.getTemplateById(id));
    }

    @PostMapping
    public ResponseEntity<EmailTemplateResponse> createTemplate(@Valid @RequestBody EmailTemplateRequest request) {
        requireEditPermission();
        return ResponseEntity.ok(service.createTemplate(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<EmailTemplateResponse> updateTemplate(@PathVariable UUID id, @Valid @RequestBody EmailTemplateRequest request) {
        requireEditPermission();
        return ResponseEntity.ok(service.updateTemplate(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTemplate(@PathVariable UUID id) {
        requireEditPermission();
        service.deleteTemplate(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/duplicate")
    public ResponseEntity<EmailTemplateResponse> duplicateTemplate(@PathVariable UUID id) {
        requireEditPermission();
        return ResponseEntity.ok(service.duplicateTemplate(id));
    }

    @PostMapping("/{id}/toggle-status")
    public ResponseEntity<EmailTemplateResponse> toggleStatus(@PathVariable UUID id) {
        requireEditPermission();
        return ResponseEntity.ok(service.toggleStatus(id));
    }

    @GetMapping("/{id}/versions")
    public ResponseEntity<List<EmailTemplateVersionResponse>> getVersionHistory(@PathVariable UUID id) {
        requireViewPermission();
        return ResponseEntity.ok(service.getVersionHistory(id));
    }

    @PostMapping("/{id}/publish")
    public ResponseEntity<EmailTemplateResponse> publishTemplate(
            @PathVariable UUID id,
            @RequestBody(required = false) EmailTemplatePublishRequest request
    ) {
        requireEditPermission();
        return ResponseEntity.ok(service.publishTemplate(id, request));
    }

    @PostMapping("/{id}/versions/{versionId}/restore")
    public ResponseEntity<EmailTemplateResponse> restoreTemplateVersion(
            @PathVariable UUID id,
            @PathVariable UUID versionId,
            @RequestBody(required = false) EmailTemplateRestoreVersionRequest request
    ) {
        requireEditPermission();
        return ResponseEntity.ok(service.restoreVersion(id, versionId, request));
    }

    @PostMapping("/{id}/preview")
    public ResponseEntity<EmailTemplatePreviewResponse> previewTemplate(
            @PathVariable UUID id,
            @RequestBody(required = false) java.util.Map<String, String> variables
    ) {
        requireViewPermission();
        return ResponseEntity.ok(service.previewTemplate(id, variables == null ? java.util.Collections.emptyMap() : variables));
    }

    @PostMapping("/preview-draft")
    public ResponseEntity<EmailTemplatePreviewResponse> previewDraftTemplate(
            @Valid @RequestBody EmailTemplatePreviewDraftRequest request
    ) {
        requireViewPermission();
        return ResponseEntity.ok(service.previewDraft(request));
    }

    @PostMapping("/{id}/test-send")
    public ResponseEntity<EmailTemplateTestSendResponse> testSendTemplate(
            @PathVariable UUID id,
            @Valid @RequestBody EmailTemplateTestSendRequest request
    ) {
        requireEditPermission();
        EmailTemplate template = service.getTemplateEntityById(id);
        try {
            boolean sent = emailService.sendTemplateEmail(request.to(), template, request.variables(), false, true);
            if (!sent) {
                throw new IllegalStateException("Test email could not be sent because email notifications or SMTP settings are disabled.");
            }
            return ResponseEntity.ok(service.recordTestSend(id, request.to()));
        } catch (Exception e) {
            throw new IllegalArgumentException("TEST_EMAIL_SEND_FAILED: unable to send test email", e);
        }
    }

    private void requireViewPermission() {
        var user = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.hasPermission(user, "settings.configuration.view")) {
            throw new org.springframework.security.access.AccessDeniedException("Current user is not allowed to view email templates");
        }
    }

    private void requireEditPermission() {
        var user = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.hasPermission(user, "settings.configuration.edit")) {
            throw new org.springframework.security.access.AccessDeniedException("Current user is not allowed to edit email templates");
        }
    }
}
