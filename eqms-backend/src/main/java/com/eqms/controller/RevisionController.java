package com.eqms.controller;

import com.eqms.dto.document.DocumentDraftCreateRequest;
import com.eqms.dto.document.DocumentFiltersResponse;
import com.eqms.dto.document.RevisionDetailResponse;
import com.eqms.dto.document.TemplateLineageResponse;
import com.eqms.dto.document.RevisionOfficeOnlineLinkResponse;
import com.eqms.dto.document.RevisionListItemResponse;
import com.eqms.dto.document.RevisionWorkingNoteRequest;
import com.eqms.dto.document.RevisionWorkingNoteResponse;
import com.eqms.dto.document.RevisionWorkflowActionRequest;
import com.eqms.dto.document.RevisionWorkspaceBatchRequest;
import com.eqms.dto.document.RevisionWorkspaceBatchResponse;
import com.eqms.dto.document.RevisionWorkspaceSnapshotRequest;
import com.eqms.dto.document.RevisionWorkspaceSnapshotResponse;
import com.eqms.dto.document.SignatureResponse;
import com.eqms.dto.security.RevisionActionCapabilitiesResponse;
import com.eqms.dto.user.PageResponse;
import com.eqms.service.RevisionActionCapabilityService;
import com.eqms.service.RevisionService;
import com.eqms.service.RevisionWorkspaceBatchService;
import com.eqms.service.RevisionWorkspaceSnapshotService;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.bind.annotation.DeleteMapping;

import java.util.UUID;

@RestController
@RequestMapping("/revisions")
public class RevisionController {

    private final RevisionService revisionService;
    private final RevisionActionCapabilityService revisionActionCapabilityService;
    private final RevisionWorkspaceSnapshotService revisionWorkspaceSnapshotService;
    private final RevisionWorkspaceBatchService revisionWorkspaceBatchService;

    public RevisionController(
            RevisionService revisionService,
            RevisionActionCapabilityService revisionActionCapabilityService,
            RevisionWorkspaceSnapshotService revisionWorkspaceSnapshotService,
            RevisionWorkspaceBatchService revisionWorkspaceBatchService
    ) {
        this.revisionService = revisionService;
        this.revisionActionCapabilityService = revisionActionCapabilityService;
        this.revisionWorkspaceSnapshotService = revisionWorkspaceSnapshotService;
        this.revisionWorkspaceBatchService = revisionWorkspaceBatchService;
    }

    @GetMapping("/filters")
    public ResponseEntity<DocumentFiltersResponse> getFilters() {
        return ResponseEntity.ok(revisionService.getFilters());
    }

    @GetMapping("/{id}/action-capabilities")
    public ResponseEntity<RevisionActionCapabilitiesResponse> getActionCapabilities(@PathVariable UUID id) {
        return ResponseEntity.ok(revisionActionCapabilityService.getCapabilities(id));
    }

    @GetMapping
    public ResponseEntity<PageResponse<RevisionListItemResponse>> listRevisions(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String ids,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String documentType,
            @RequestParam(required = false) String businessUnit,
            @RequestParam(required = false) String department,
            @RequestParam(required = false) String authorId,
            @RequestParam(required = false) String author,
            @RequestParam(required = false) String relatedDocument,
            @RequestParam(required = false) String correlatedDocument,
            @RequestParam(required = false) String isTemplate,
            @RequestParam(required = false) String createdFrom,
            @RequestParam(required = false) String createdTo,
            @RequestParam(required = false) String effectiveFrom,
            @RequestParam(required = false) String effectiveTo,
            @RequestParam(required = false) String validFrom,
            @RequestParam(required = false) String validTo,
            @RequestParam(defaultValue = "false") boolean ownedByMe,
            @RequestParam(defaultValue = "false") boolean pending,
            @RequestParam(defaultValue = "revisionName") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDirection,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit
    ) {
        return ResponseEntity.ok(revisionService.listRevisions(
                search, ids, status, documentType, businessUnit, department, authorId, author,
                relatedDocument, correlatedDocument, isTemplate,
                createdFrom, createdTo, effectiveFrom, effectiveTo, validFrom, validTo,
                ownedByMe, pending, sortBy, sortDirection, page, limit
        ));
    }

    @GetMapping("/export")
    public ResponseEntity<StreamingResponseBody> exportRevisions(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String ids,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String documentType,
            @RequestParam(required = false) String businessUnit,
            @RequestParam(required = false) String department,
            @RequestParam(required = false) String authorId,
            @RequestParam(required = false) String author,
            @RequestParam(required = false) String relatedDocument,
            @RequestParam(required = false) String correlatedDocument,
            @RequestParam(required = false) String isTemplate,
            @RequestParam(required = false) String createdFrom,
            @RequestParam(required = false) String createdTo,
            @RequestParam(required = false) String effectiveFrom,
            @RequestParam(required = false) String effectiveTo,
            @RequestParam(required = false) String validFrom,
            @RequestParam(required = false) String validTo,
            @RequestParam(defaultValue = "false") boolean ownedByMe,
            @RequestParam(defaultValue = "false") boolean pending,
            @RequestParam(defaultValue = "revisionName") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDirection
    ) {
        StreamingResponseBody csv = outputStream -> revisionService.writeRevisionsExport(
                search, ids, status, documentType, businessUnit, department, authorId, author,
                relatedDocument, correlatedDocument, isTemplate,
                createdFrom, createdTo, effectiveFrom, effectiveTo, validFrom, validTo,
                ownedByMe, pending, sortBy, sortDirection, outputStream
        );
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=revisions-export.csv")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(csv);
    }

    @GetMapping("/pending-counts")
    public ResponseEntity<java.util.Map<String, Long>> getPendingCounts() {
        return ResponseEntity.ok(revisionService.getPendingCounts());
    }

    @GetMapping("/{id}")
    public ResponseEntity<RevisionDetailResponse> getRevision(@PathVariable UUID id) {
        return ResponseEntity.ok(revisionService.getRevision(id));
    }

    @GetMapping("/{id}/template-lineage")
    public ResponseEntity<TemplateLineageResponse> getTemplateLineage(@PathVariable UUID id) {
        TemplateLineageResponse lineage = revisionService.getTemplateLineage(id);
        return lineage == null ? ResponseEntity.noContent().build() : ResponseEntity.ok(lineage);
    }

    @GetMapping("/{id}/snapshot")
    public ResponseEntity<RevisionDetailResponse> getRevisionSnapshot(@PathVariable UUID id) {
        return ResponseEntity.ok(revisionService.getRevisionForSnapshot(id));
    }

    @GetMapping("/{id}/signatures")
    public ResponseEntity<java.util.List<SignatureResponse>> getRevisionSignatures(@PathVariable UUID id) {
        return ResponseEntity.ok(revisionService.getRevisionSignatures(id));
    }

    @PostMapping("/{id}/regenerate-snapshot")
    public ResponseEntity<RevisionDetailResponse> regenerateSnapshot(@PathVariable UUID id) {
        return ResponseEntity.ok(revisionService.regenerateSnapshot(id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<RevisionDetailResponse> updateRevision(
            @PathVariable UUID id,
            @Valid @RequestBody DocumentDraftCreateRequest request
    ) {
        return ResponseEntity.ok(revisionService.updateRevision(id, request));
    }

    @PostMapping("/{id}/complete-editing")
    public ResponseEntity<RevisionDetailResponse> completeEditing(
            @PathVariable UUID id,
            @RequestBody(required = false) RevisionWorkflowActionRequest request
    ) {
        return ResponseEntity.ok(revisionService.completeEditing(id, request));
    }

    @PostMapping("/{id}/submit-review")
    public ResponseEntity<RevisionDetailResponse> submitForReview(
            @PathVariable UUID id,
            @RequestBody(required = false) RevisionWorkflowActionRequest request
    ) {
        return ResponseEntity.ok(revisionService.submitForReview(id, request));
    }

    @PostMapping("/{id}/review/complete")
    public ResponseEntity<RevisionDetailResponse> completeReview(
            @PathVariable UUID id,
            @RequestBody(required = false) RevisionWorkflowActionRequest request
    ) {
        return ResponseEntity.ok(revisionService.completeReview(id, request));
    }

    @PostMapping("/{id}/review/reject")
    public ResponseEntity<RevisionDetailResponse> rejectReview(
            @PathVariable UUID id,
            @RequestBody(required = false) RevisionWorkflowActionRequest request
    ) {
        return ResponseEntity.ok(revisionService.rejectReview(id, request));
    }

    @PostMapping("/{id}/approve/complete")
    public ResponseEntity<RevisionDetailResponse> completeApproval(
            @PathVariable UUID id,
            @RequestBody(required = false) RevisionWorkflowActionRequest request
    ) {
        return ResponseEntity.ok(revisionService.completeApproval(id, request));
    }

    @PostMapping("/{id}/approve/reject")
    public ResponseEntity<RevisionDetailResponse> rejectApproval(
            @PathVariable UUID id,
            @RequestBody(required = false) RevisionWorkflowActionRequest request
    ) {
        return ResponseEntity.ok(revisionService.rejectApproval(id, request));
    }

    @PostMapping("/{id}/training/complete")
    public ResponseEntity<RevisionDetailResponse> completeTraining(
            @PathVariable UUID id,
            @RequestBody(required = false) RevisionWorkflowActionRequest request
    ) {
        return ResponseEntity.ok(revisionService.completeTraining(id, request));
    }

    @PostMapping("/{id}/publish")
    public ResponseEntity<RevisionDetailResponse> publishRevision(
            @PathVariable UUID id,
            @RequestBody(required = false) RevisionWorkflowActionRequest request
    ) {
        return ResponseEntity.ok(revisionService.publishRevision(id, request));
    }

    @PostMapping("/{id}/upgrade")
    public ResponseEntity<RevisionDetailResponse> upgradeRevision(@PathVariable UUID id) {
        return ResponseEntity.ok(revisionService.upgradeRevision(id));
    }

    @GetMapping("/workspaces")
    public ResponseEntity<RevisionWorkspaceSnapshotResponse> getWorkspaceSnapshot(
            @RequestParam UUID sourceRevisionId,
            @RequestParam(defaultValue = "create") String workspaceMode
    ) {
        return ResponseEntity.ok(revisionWorkspaceSnapshotService.getSnapshot(sourceRevisionId, workspaceMode));
    }

    @PostMapping("/workspaces")
    public ResponseEntity<RevisionWorkspaceSnapshotResponse> saveWorkspaceSnapshot(
            @Valid @RequestBody RevisionWorkspaceSnapshotRequest request
    ) {
        return ResponseEntity.ok(revisionWorkspaceSnapshotService.saveSnapshot(request));
    }

    @PostMapping(value = "/workspaces/batch-save", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<RevisionWorkspaceBatchResponse> saveWorkspaceBatch(
            @RequestPart("request") @Valid RevisionWorkspaceBatchRequest request,
            @RequestPart(value = "files", required = false) java.util.List<MultipartFile> files
    ) {
        return ResponseEntity.ok(revisionWorkspaceBatchService.saveWorkspaceBatch(request, files));
    }

    @PostMapping(value = "/workspaces/batch-submit", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<RevisionWorkspaceBatchResponse> submitWorkspaceBatch(
            @RequestPart("request") @Valid RevisionWorkspaceBatchRequest request,
            @RequestPart(value = "files", required = false) java.util.List<MultipartFile> files
    ) {
        return ResponseEntity.ok(revisionWorkspaceBatchService.submitWorkspaceBatch(request, files));
    }

    @PostMapping(value = "/{id}/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<RevisionDetailResponse> uploadRevisionFile(
            @PathVariable UUID id,
            @RequestPart("file") MultipartFile file
    ) {
        return ResponseEntity.ok(revisionService.uploadRevisionFile(id, file));
    }

    @PostMapping("/{id}/office-online/sync")
    public ResponseEntity<RevisionDetailResponse> syncRevisionToOfficeOnline(@PathVariable UUID id) {
        return ResponseEntity.ok(revisionService.syncRevisionToOfficeOnline(id));
    }

    @PostMapping("/{id}/office-online/sync-back")
    public ResponseEntity<RevisionDetailResponse> syncEditedFileFromOfficeOnline(@PathVariable UUID id) {
        return ResponseEntity.ok(revisionService.syncEditedFileFromOfficeOnline(id));
    }

    @GetMapping("/{id}/office-online/edit-link")
    public ResponseEntity<RevisionOfficeOnlineLinkResponse> getOfficeOnlineEditLink(@PathVariable UUID id) {
        return ResponseEntity.ok(revisionService.getOfficeOnlineEditLink(id));
    }

    @GetMapping("/{id}/office-online/review-link")
    public ResponseEntity<RevisionOfficeOnlineLinkResponse> getOfficeOnlineReviewLink(@PathVariable UUID id) {
        return ResponseEntity.ok(revisionService.getOfficeOnlineReviewLink(id));
    }

    @GetMapping("/{id}/preview")
    public ResponseEntity<byte[]> previewRevisionFile(@PathVariable UUID id) {
        byte[] bytes = revisionService.previewRevisionFile(id);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline")
                .contentType(MediaType.APPLICATION_PDF)
                .body(bytes);
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<RevisionDetailResponse> cancelRevision(
            @PathVariable UUID id,
            @RequestBody RevisionWorkflowActionRequest request
    ) {
        return ResponseEntity.ok(revisionService.cancelRevision(id, request));
    }

    @GetMapping("/{id}/working-notes")
    public ResponseEntity<java.util.List<RevisionWorkingNoteResponse>> listWorkingNotes(@PathVariable UUID id) {
        return ResponseEntity.ok(revisionService.listWorkingNotes(id));
    }

    @PostMapping("/{id}/working-notes")
    public ResponseEntity<RevisionWorkingNoteResponse> addWorkingNote(
            @PathVariable UUID id,
            @Valid @RequestBody RevisionWorkingNoteRequest request
    ) {
        return ResponseEntity.ok(revisionService.addWorkingNote(id, request));
    }

    @DeleteMapping("/{id}/working-notes/{noteId}")
    public ResponseEntity<Void> deleteWorkingNote(
            @PathVariable UUID id,
            @PathVariable UUID noteId
    ) {
        revisionService.deleteWorkingNote(id, noteId);
        return ResponseEntity.ok().build();
    }
}
