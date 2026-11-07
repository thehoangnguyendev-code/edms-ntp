package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.publishing.PublishingWorkspaceRequest;
import com.eqms.dto.publishing.PublishingWorkspaceResponse;
import com.eqms.service.PermissionEvaluationService;
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
    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissionEvaluationService;
    private final com.eqms.service.PublishingCommandService commands;

    public PublishingWorkspaceController(
            PublishingWorkspaceService service,
            CurrentUserService currentUserService,
            PermissionEvaluationService permissionEvaluationService,
            com.eqms.service.PublishingCommandService commands
    ) {
        this.service = service;
        this.currentUserService = currentUserService;
        this.permissionEvaluationService = permissionEvaluationService;
        this.commands = commands;
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

    /** Related Documents that keep this revision from publishing together with them; asked before the person signs. */
    @GetMapping("/related-blockers")
    public ResponseEntity<java.util.List<com.eqms.dto.publishing.RelatedPublishBlockerResponse>> getRelatedBlockers(@PathVariable UUID id) {
        requirePublishPermission();
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.relatedPublishBlockers(id));
    }

    @GetMapping("/jobs/{jobId}")
    public ResponseEntity<com.eqms.dto.publishing.PublishingJobStatusResponse> getJobStatus(
            @PathVariable UUID id,@PathVariable UUID jobId) {
        requirePublishPermission();
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.getJobStatus(id,jobId));
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
        // Consumes the JWT once, atomically with the immutable command and its content binding.
        // The durable dispatcher, rather than an in-memory event, starts/resumes this job.
        var job=commands.acceptPublish(id, currentUser.getId(), request);
        return ResponseEntity.accepted().body(service.getAcceptedWorkspace(id,job.getId()));
    }

    private void requirePublishPermission() {
        var user = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.hasPermission(user, "documents.revision.publish")) {
            throw new org.springframework.security.access.AccessDeniedException("Current user is not allowed to publish revisions");
        }
    }
}
