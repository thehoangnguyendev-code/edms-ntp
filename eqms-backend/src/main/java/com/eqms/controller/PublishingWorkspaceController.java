package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.publishing.PublishingWorkspaceRequest;
import com.eqms.dto.publishing.PublishingWorkspaceResponse;
import com.eqms.service.PermissionEvaluationService;
import com.eqms.service.PublishingWorkspaceJobProcessorService;
import com.eqms.service.PublishingWorkspaceJobService;
import com.eqms.service.PublishingWorkspaceService;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/revisions/{id}/publishing-workspace")
public class PublishingWorkspaceController {

    private final PublishingWorkspaceService service;
    private final PublishingWorkspaceJobService jobService;
    private final PublishingWorkspaceJobProcessorService jobProcessorService;
    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissionEvaluationService;

    public PublishingWorkspaceController(
            PublishingWorkspaceService service,
            PublishingWorkspaceJobService jobService,
            PublishingWorkspaceJobProcessorService jobProcessorService,
            CurrentUserService currentUserService,
            PermissionEvaluationService permissionEvaluationService
    ) {
        this.service = service;
        this.jobService = jobService;
        this.jobProcessorService = jobProcessorService;
        this.currentUserService = currentUserService;
        this.permissionEvaluationService = permissionEvaluationService;
    }

    @GetMapping
    public ResponseEntity<PublishingWorkspaceResponse> getWorkspace(@PathVariable UUID id) {
        requirePublishPermission();
        return ResponseEntity.ok(service.getWorkspace(id));
    }

    @GetMapping("/preview")
    public ResponseEntity<byte[]> getPreview(@PathVariable UUID id) {
        requirePublishPermission();
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .body(service.getPreviewPdf(id));
    }

    @GetMapping("/component-preview/{templateId}/{componentType}")
    public ResponseEntity<byte[]> getComponentPreview(
            @PathVariable UUID id,
            @PathVariable UUID templateId,
            @PathVariable String componentType,
            @RequestParam(required = false) String layout
    ) throws Exception {
        requirePublishPermission();
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .cacheControl(CacheControl.noStore())
                .body(service.getComponentPreviewPdf(id, templateId, componentType, layout));
    }

    @PostMapping("/generate-preview")
    public ResponseEntity<PublishingWorkspaceResponse> generatePreview(
            @PathVariable UUID id,
            @Valid @RequestBody(required = false) PublishingWorkspaceRequest request
    ) {
        requirePublishPermission();
        return ResponseEntity.ok(service.generatePreview(id, request));
    }

    @PostMapping("/open")
    public ResponseEntity<PublishingWorkspaceResponse> openWorkspace(
            @PathVariable UUID id,
            @Valid @RequestBody(required = false) PublishingWorkspaceRequest request
    ) {
        requirePublishPermission();
        return ResponseEntity.ok(service.openWorkspace(id, request));
    }

    @PostMapping("/publish")
    public ResponseEntity<PublishingWorkspaceResponse> publish(
            @PathVariable UUID id,
            @Valid @RequestBody(required = false) PublishingWorkspaceRequest request
    ) {
        requirePublishPermission();
        var currentUser = currentUserService.requireCurrentUser();
        var job = jobService.createPublishJob(id, currentUser.getId(), request);
        jobProcessorService.processPublishJob(job.getId(), id, request, currentUser.getId());
        return ResponseEntity.accepted().body(service.getWorkspace(id));
    }

    private void requirePublishPermission() {
        var user = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.hasPermission(user, "documents.revision.publish")) {
            throw new org.springframework.security.access.AccessDeniedException("Current user is not allowed to publish revisions");
        }
    }
}
