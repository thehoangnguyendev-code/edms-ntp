package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.publishing.PublishingTemplateRequest;
import com.eqms.dto.publishing.PublishingPlaceholderCatalogResponse;
import com.eqms.dto.publishing.PublishingPlaceholderStyleRequest;
import com.eqms.dto.publishing.PublishingPlaceholderStyleResponse;
import com.eqms.dto.publishing.PublishingTemplateResponse;
import com.eqms.dto.publishing.PublishingTemplateVersionResponse;
import com.eqms.dto.publishing.PublishingTemplateComponentInspectionResponse;
import com.eqms.dto.user.PageResponse;
import com.eqms.service.PermissionEvaluationService;
import com.eqms.service.PublishingPlaceholderCatalogService;
import com.eqms.service.PublishingPlaceholderStyleService;
import com.eqms.service.PublishingTemplateInspectionService;
import com.eqms.service.PublishingTemplatePreviewService;
import com.eqms.service.PublishingTemplateService;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/settings/publishing-templates")
public class PublishingTemplateController {

    private final PublishingTemplateService service;
    private final PublishingTemplatePreviewService previewService;
    private final PublishingTemplateInspectionService inspectionService;
    private final PublishingPlaceholderCatalogService placeholderCatalogService;
    private final PublishingPlaceholderStyleService placeholderStyleService;
    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissionEvaluationService;

    public PublishingTemplateController(
            PublishingTemplateService service,
            PublishingTemplatePreviewService previewService,
            PublishingTemplateInspectionService inspectionService,
            PublishingPlaceholderCatalogService placeholderCatalogService,
            PublishingPlaceholderStyleService placeholderStyleService,
            CurrentUserService currentUserService,
            PermissionEvaluationService permissionEvaluationService
    ) {
        this.service = service;
        this.previewService = previewService;
        this.inspectionService = inspectionService;
        this.placeholderCatalogService = placeholderCatalogService;
        this.placeholderStyleService = placeholderStyleService;
        this.currentUserService = currentUserService;
        this.permissionEvaluationService = permissionEvaluationService;
    }

    @GetMapping
    public ResponseEntity<PageResponse<PublishingTemplateResponse>> listTemplates(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String publishingMode,
            @RequestParam(required = false) String documentType,
            @RequestParam(required = false) String createdBy,
            @RequestParam(defaultValue = "updatedAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDirection,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit
    ) {
        requireViewPermission();
        return ResponseEntity.ok(service.listTemplates(search, status, publishingMode, documentType, createdBy, sortBy, sortDirection, page, limit));
    }

    @GetMapping("/{id}")
    public ResponseEntity<PublishingTemplateResponse> getTemplate(@PathVariable UUID id) {
        requireViewPermission();
        return ResponseEntity.ok(service.getTemplate(id));
    }

    @GetMapping("/{id}/versions")
    public ResponseEntity<List<PublishingTemplateVersionResponse>> getVersions(@PathVariable UUID id) {
        requireViewPermission();
        return ResponseEntity.ok(service.getVersionHistory(id));
    }

    @GetMapping("/placeholders")
    public ResponseEntity<PublishingPlaceholderCatalogResponse> getAvailablePlaceholders(
            @RequestParam(required = false) String search
    ) {
        requireViewPermission();
        return ResponseEntity.ok(placeholderCatalogService.getAvailablePlaceholders(search));
    }

    @GetMapping("/{id}/placeholder-styles")
    public ResponseEntity<List<PublishingPlaceholderStyleResponse>> listPlaceholderStyles(
            @PathVariable UUID id,
            @RequestParam(required = false) String componentType,
            @RequestParam(required = false) String layout
    ) {
        requireViewPermission();
        return ResponseEntity.ok(placeholderStyleService.listStyles(id, componentType, layout));
    }

    @PutMapping("/{id}/placeholder-styles")
    public ResponseEntity<List<PublishingPlaceholderStyleResponse>> savePlaceholderStyles(
            @PathVariable UUID id,
            @RequestBody List<PublishingPlaceholderStyleRequest> request
    ) {
        requireEditPermission();
        return ResponseEntity.ok(placeholderStyleService.upsertStyles(id, request));
    }

    @DeleteMapping("/{id}/placeholder-styles/{componentType}/{layout}/{placeholderKey}")
    public ResponseEntity<Void> deletePlaceholderStyle(
            @PathVariable UUID id,
            @PathVariable String componentType,
            @PathVariable String layout,
            @PathVariable String placeholderKey
    ) {
        requireEditPermission();
        placeholderStyleService.deleteStyle(id, componentType, layout, placeholderKey);
        return ResponseEntity.noContent().build();
    }

    @PostMapping
    public ResponseEntity<PublishingTemplateResponse> createTemplate(@Valid @RequestBody PublishingTemplateRequest request) {
        requireEditPermission();
        return ResponseEntity.ok(service.createTemplate(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<PublishingTemplateResponse> updateTemplate(@PathVariable UUID id, @Valid @RequestBody PublishingTemplateRequest request) {
        requireEditPermission();
        return ResponseEntity.ok(service.updateTemplate(id, request));
    }

    @PostMapping("/{id}/duplicate")
    public ResponseEntity<PublishingTemplateResponse> duplicateTemplate(@PathVariable UUID id) {
        requireEditPermission();
        return ResponseEntity.ok(service.duplicateTemplate(id));
    }

    @PostMapping("/{id}/toggle-status")
    public ResponseEntity<PublishingTemplateResponse> toggleStatus(@PathVariable UUID id) {
        requireEditPermission();
        return ResponseEntity.ok(service.toggleStatus(id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTemplate(@PathVariable UUID id) {
        requireEditPermission();
        service.deleteTemplate(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping(value = "/{id}/components/{componentType}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<PublishingTemplateResponse> uploadComponent(
            @PathVariable UUID id,
            @PathVariable String componentType,
            @RequestParam(required = false) String layout,
            @RequestPart("file") MultipartFile file
    ) {
        requireEditPermission();
        return ResponseEntity.ok(service.updateTemplateComponent(id, componentType, layout, file));
    }

    @DeleteMapping("/{id}/components/{componentType}")
    public ResponseEntity<PublishingTemplateResponse> deleteComponent(
            @PathVariable UUID id,
            @PathVariable String componentType,
            @RequestParam(required = false) String layout
    ) {
        requireEditPermission();
        return ResponseEntity.ok(service.deleteTemplateComponent(id, componentType, layout));
    }

    @GetMapping("/{id}/components/{componentType}/preview")
    public ResponseEntity<byte[]> previewComponent(
            @PathVariable UUID id,
            @PathVariable String componentType,
            @RequestParam(required = false) String layout,
            @RequestParam(required = false) UUID revisionId,
            @RequestParam(required = false) String previewPlaceholder,
            @RequestParam(required = false) String previewText,
            @RequestParam(required = false) Double previewFontSize,
            @RequestParam(defaultValue = "false") boolean exactPreview
    ) throws Exception {
        requireViewPermission();
        if ("logo".equalsIgnoreCase(componentType)) {
            var file = previewService.getLogoPreview(id);
            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(file.contentType()))
                    .body(file.bytes());
        }
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .body(previewService.getComponentPreviewPdf(id, componentType, layout, revisionId, previewPlaceholder, previewText, previewFontSize, exactPreview));
    }

    @GetMapping("/{id}/components/{componentType}/inspection")
    public ResponseEntity<PublishingTemplateComponentInspectionResponse> inspectComponent(
            @PathVariable UUID id,
            @PathVariable String componentType,
            @RequestParam(required = false) String layout,
            @RequestParam(required = false) UUID revisionId
    ) {
        requireViewPermission();
        return ResponseEntity.ok(inspectionService.inspectComponent(id, componentType, layout, revisionId));
    }

    @PostMapping("/{id}/publish")
    public ResponseEntity<PublishingTemplateResponse> publishTemplate(
            @PathVariable UUID id,
            @RequestBody(required = false) java.util.Map<String, String> request
    ) {
        requireEditPermission();
        return ResponseEntity.ok(service.publishTemplate(id, request == null ? null : request.get("changeSummary")));
    }

    private void requireViewPermission() {
        var user = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.hasAnyPermission(
                user,
                "settings.publishing_template.view",
                "settings.publishing_template.manage",
                "settings.configuration.view",
                "settings.configuration.edit"
        )) {
            throw new org.springframework.security.access.AccessDeniedException("Current user is not allowed to view publishing templates");
        }
    }

    private void requireEditPermission() {
        var user = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.hasAnyPermission(user, "settings.publishing_template.manage", "settings.configuration.edit")) {
            throw new org.springframework.security.access.AccessDeniedException("Current user is not allowed to edit publishing templates");
        }
    }
}
