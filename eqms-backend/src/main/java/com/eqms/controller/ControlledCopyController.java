package com.eqms.controller;

import com.eqms.dto.document.ControlledCopyApproveRequest;
import com.eqms.dto.document.ControlledCopyCancelRequest;
import com.eqms.dto.document.ControlledCopyDestroyRequest;
import com.eqms.dto.document.ControlledCopyDistributeRequest;
import com.eqms.dto.document.ControlledCopyDistributionBatchSummaryResponse;
import com.eqms.dto.document.ControlledCopyEvidenceResponse;
import com.eqms.dto.document.ControlledCopyFiltersResponse;
import com.eqms.dto.document.ControlledCopyListItemResponse;
import com.eqms.dto.document.ControlledCopyPrintRequest;
import com.eqms.dto.document.ControlledCopyRequestContextResponse;
import com.eqms.dto.document.ControlledCopyRecallRequest;
import com.eqms.dto.document.ControlledCopyReplaceRequest;
import com.eqms.dto.document.ControlledCopyRequestCreateRequest;
import com.eqms.dto.document.ControlledCopyPreviewCloseRequest;
import com.eqms.dto.document.ControlledCopyPreviewResponse;
import com.eqms.dto.document.SignatureResponse;
import com.eqms.dto.security.ControlledCopyActionCapabilitiesResponse;
import com.eqms.dto.user.PageResponse;
import com.eqms.entity.ControlledCopyDistributionJob;
import com.eqms.repository.ControlledCopyDistributionJobRepository;
import com.eqms.service.ControlledCopyAuthorizationService;
import com.eqms.service.ControlledCopyService;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/controlled-copies")
public class ControlledCopyController {

    private final ControlledCopyService controlledCopyService;
    private final ControlledCopyAuthorizationService controlledCopyAuthorizationService;
    private final ControlledCopyDistributionJobRepository controlledCopyDistributionJobRepository;
    private final com.eqms.repository.ControlledCopyDistributionJobItemRepository controlledCopyDistributionJobItemRepository;

    public ControlledCopyController(
            ControlledCopyService controlledCopyService,
            ControlledCopyAuthorizationService controlledCopyAuthorizationService,
            ControlledCopyDistributionJobRepository controlledCopyDistributionJobRepository,
            com.eqms.repository.ControlledCopyDistributionJobItemRepository controlledCopyDistributionJobItemRepository
    ) {
        this.controlledCopyService = controlledCopyService;
        this.controlledCopyAuthorizationService = controlledCopyAuthorizationService;
        this.controlledCopyDistributionJobRepository = controlledCopyDistributionJobRepository;
        this.controlledCopyDistributionJobItemRepository = controlledCopyDistributionJobItemRepository;
    }

    @GetMapping("/{id}/action-capabilities")
    public ResponseEntity<ControlledCopyActionCapabilitiesResponse> getActionCapabilities(@PathVariable UUID id) {
        return ResponseEntity.ok(controlledCopyAuthorizationService.getCopyCapabilities(id));
    }

    @GetMapping("/batches/{batchId}/action-capabilities")
    public ResponseEntity<ControlledCopyActionCapabilitiesResponse> getBatchActionCapabilities(@PathVariable UUID batchId) {
        return ResponseEntity.ok(controlledCopyAuthorizationService.getBatchCapabilities(batchId));
    }

    @GetMapping("/filters")
    public ResponseEntity<ControlledCopyFiltersResponse> getFilters() {
        return ResponseEntity.ok(controlledCopyService.getFilters());
    }

    @GetMapping("/batch-status-discrepancies")
    public ResponseEntity<PageResponse<com.eqms.dto.document.ControlledCopyBatchStatusDiscrepancyResponse>> listBatchStatusDiscrepancies(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer limit
    ) {
        return ResponseEntity.ok(controlledCopyService.listBatchStatusDiscrepancies(page, limit));
    }

    @GetMapping
    public ResponseEntity<PageResponse<ControlledCopyListItemResponse>> list(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String department,
            @RequestParam(required = false) String documentId,
            @RequestParam(required = false) String createdFrom,
            @RequestParam(required = false) String createdTo,
            @RequestParam(required = false) String validFrom,
            @RequestParam(required = false) String validTo,
            @RequestParam(required = false) String expiryFrom,
            @RequestParam(required = false) String expiryTo,
            @RequestParam(required = false) String recallFrom,
            @RequestParam(required = false) String recallTo,
            @RequestParam(required = false, defaultValue = "created") String sortBy,
            @RequestParam(required = false, defaultValue = "desc") String sortDirection
    ) {
        return ResponseEntity.ok(controlledCopyService.list(
                page,
                limit,
                search,
                status,
                department,
                documentId,
                createdFrom,
                createdTo,
                validFrom,
                validTo,
                expiryFrom,
                expiryTo,
                recallFrom,
                recallTo,
                sortBy,
                sortDirection
        ));
    }

    @GetMapping("/batches")
    public ResponseEntity<PageResponse<ControlledCopyDistributionBatchSummaryResponse>> listBatches(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String documentId,
            @RequestParam(required = false) String createdFrom,
            @RequestParam(required = false) String createdTo,
            @RequestParam(required = false) String validFrom,
            @RequestParam(required = false) String validTo,
            @RequestParam(required = false) String expiryFrom,
            @RequestParam(required = false) String expiryTo,
            @RequestParam(required = false) String recallFrom,
            @RequestParam(required = false) String recallTo,
            @RequestParam(required = false, defaultValue = "created") String sortBy,
            @RequestParam(required = false, defaultValue = "desc") String sortDirection
    ) {
        return ResponseEntity.ok(controlledCopyService.listDistributionBatches(
                page,
                limit,
                search,
                status,
                documentId,
                createdFrom,
                createdTo,
                validFrom,
                validTo,
                expiryFrom,
                expiryTo,
                recallFrom,
                recallTo,
                sortBy,
                sortDirection
        ));
    }

    @GetMapping("/batches/{batchId}")
    public ResponseEntity<ControlledCopyDistributionBatchSummaryResponse> getBatchById(@PathVariable UUID batchId) {
        return ResponseEntity.ok(controlledCopyService.getDistributionBatchById(batchId));
    }

    @GetMapping("/batches/{batchId}/detail")
    public ResponseEntity<ControlledCopyDistributionBatchSummaryResponse> getBatchDetailById(@PathVariable UUID batchId) {
        return ResponseEntity.ok(controlledCopyService.getControlledCopyDistributionBatchDetail(batchId));
    }

    @GetMapping("/batches/{batchId}/copies")
    public ResponseEntity<PageResponse<ControlledCopyListItemResponse>> listBatchCopies(
            @PathVariable UUID batchId,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer limit
    ) {
        return ResponseEntity.ok(controlledCopyService.listDistributionBatchCopies(batchId, page, limit));
    }

    @GetMapping("/export")
    public ResponseEntity<StreamingResponseBody> export(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String department,
            @RequestParam(required = false) String documentId,
            @RequestParam(required = false) String createdFrom,
            @RequestParam(required = false) String createdTo,
            @RequestParam(required = false) String validFrom,
            @RequestParam(required = false) String validTo,
            @RequestParam(required = false) String expiryFrom,
            @RequestParam(required = false) String expiryTo,
            @RequestParam(required = false) String recallFrom,
            @RequestParam(required = false) String recallTo,
            @RequestParam(required = false, defaultValue = "created") String sortBy,
            @RequestParam(required = false, defaultValue = "desc") String sortDirection
    ) {
        StreamingResponseBody csv = outputStream -> controlledCopyService.writeExport(
                search, status, department, documentId, createdFrom, createdTo,
                validFrom, validTo, expiryFrom, expiryTo, recallFrom, recallTo,
                sortBy, sortDirection, outputStream
        );
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=controlled-copies-export.csv")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(csv);
    }

    @GetMapping("/{id}")
    public ResponseEntity<ControlledCopyListItemResponse> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(controlledCopyService.getById(id));
    }

    @GetMapping("/{id}/detail")
    public ResponseEntity<ControlledCopyListItemResponse> getDetailById(@PathVariable UUID id) {
        return ResponseEntity.ok(controlledCopyService.getControlledCopyDetail(id));
    }

    @GetMapping("/{id}/resolved-detail")
    public ResponseEntity<Object> getResolvedDetailById(@PathVariable UUID id) {
        return ResponseEntity.ok(controlledCopyService.getControlledCopyResolvedDetail(id));
    }

    @GetMapping("/{id}/resolved-detail/snapshot")
    public ResponseEntity<Object> getResolvedDetailSnapshotById(@PathVariable UUID id) {
        return ResponseEntity.ok(controlledCopyService.getControlledCopyResolvedDetailForSnapshot(id));
    }

    @GetMapping("/request-context")
    public ResponseEntity<ControlledCopyRequestContextResponse> getRequestContext(
            @RequestParam(required = false) String documentId,
            @RequestParam(required = false) String revisionId
    ) {
        return ResponseEntity.ok(controlledCopyService.getRequestContext(documentId, revisionId));
    }

    @GetMapping("/{id}/signatures")
    public ResponseEntity<java.util.List<SignatureResponse>> getSignatures(@PathVariable UUID id) {
        return ResponseEntity.ok(controlledCopyService.getControlledCopySignatures(id));
    }

    @GetMapping("/{id}/preview")
    public ResponseEntity<ControlledCopyPreviewResponse> openPreview(
            @PathVariable UUID id,
            @RequestParam String token,
            @RequestParam(required = false) String password
    ) {
        return ResponseEntity.ok(controlledCopyService.openPreview(id, token, password));
    }

    @GetMapping("/{id}/preview/pages/{pageNumber}")
    public ResponseEntity<byte[]> renderPreviewPage(
            @PathVariable UUID id,
            @PathVariable int pageNumber,
            @RequestParam String token
    ) {
        byte[] bytes = controlledCopyService.renderPreviewPage(id, token, pageNumber);
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_PNG)
                .header(HttpHeaders.CACHE_CONTROL, "no-store, no-cache, must-revalidate, max-age=0")
                .body(bytes);
    }

    @GetMapping("/{id}/preview/file")
    public ResponseEntity<byte[]> previewFile(
            @PathVariable UUID id,
            @RequestParam String token
    ) {
        ControlledCopyService.FileDownload file = controlledCopyService.previewControlledCopyFile(id, token);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + file.fileName() + "\"")
                .contentType(MediaType.parseMediaType(file.contentType()))
                .body(file.bytes());
    }

    @GetMapping("/{id}/download")
    public ResponseEntity<byte[]> downloadControlledCopy(
            @PathVariable UUID id,
            @RequestParam String token,
            @RequestParam(required = false) String password
    ) {
        ControlledCopyService.FileDownload file = controlledCopyService.downloadControlledCopy(id, token, password);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + file.fileName() + "\"")
                .contentType(MediaType.parseMediaType(file.contentType()))
                .body(file.bytes());
    }

    @GetMapping("/distribution-batches/{batchId}/job-status")
    public ResponseEntity<java.util.Map<String, Object>> getDistributionJobStatus(
            @PathVariable UUID batchId,
            @RequestParam(required = false, defaultValue = "DISTRIBUTE") String action
    ) {
        controlledCopyAuthorizationService.getBatchCapabilities(batchId);
        ControlledCopyDistributionJob job = controlledCopyDistributionJobRepository
                .findByBatch_IdAndActionTypeOrderByCreatedAtDesc(batchId, action.toUpperCase(java.util.Locale.ROOT))
                .stream()
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Job not found for batch: " + batchId));
        String status = switch (job.getStatus()) {
            case "COMPLETED" -> "completed";
            case "COMPLETED_WITH_ERRORS" -> "completed_with_errors";
            default -> "in_progress";
        };
        return ResponseEntity.ok(java.util.Map.of(
                "batchId", batchId.toString(),
                "processed", job.getSucceededItems() + job.getFailedItems(),
                "total", job.getTotalItems(),
                "failed", job.getFailedItems(),
                "status", status
        ));
    }

    @GetMapping("/distribution-batches/{batchId}/failed-items")
    public ResponseEntity<List<com.eqms.dto.document.ControlledCopyBatchFailedItemResponse>> getDistributionFailedItems(
            @PathVariable UUID batchId,
            @RequestParam(required = false, defaultValue = "DISTRIBUTE") String action
    ) {
        controlledCopyAuthorizationService.getBatchCapabilities(batchId);
        ControlledCopyDistributionJob job = controlledCopyDistributionJobRepository
                .findByBatch_IdAndActionTypeOrderByCreatedAtDesc(batchId, action.toUpperCase(java.util.Locale.ROOT))
                .stream()
                .findFirst()
                .orElse(null);
        if (job == null) {
            return ResponseEntity.ok(List.of());
        }
        List<com.eqms.dto.document.ControlledCopyBatchFailedItemResponse> failedItems = controlledCopyDistributionJobItemRepository
                .findAllByJob_IdAndStatusOrderByIdAsc(job.getId(), "FAILED")
                .stream()
                .map(item -> new com.eqms.dto.document.ControlledCopyBatchFailedItemResponse(
                        item.getControlledCopy().getId().toString(),
                        item.getControlledCopy().getControlledCopyNumber(),
                        item.getControlledCopy().getRecipientName(),
                        item.getLastErrorMessage()
                ))
                .toList();
        return ResponseEntity.ok(failedItems);
    }

    @PostMapping("/distribution-batches/{batchId}/retry-failed")
    public ResponseEntity<Void> retryFailedDistribution(
            @PathVariable UUID batchId,
            @RequestParam(required = false, defaultValue = "DISTRIBUTE") String action
    ) {
        if ("RECALL".equalsIgnoreCase(action)) {
            controlledCopyService.retryFailedRecall(batchId);
        } else if ("CANCEL".equalsIgnoreCase(action)) {
            controlledCopyService.retryFailedCancel(batchId);
        } else {
            controlledCopyService.retryFailedDistribution(batchId);
        }
        return ResponseEntity.accepted().build();
    }

    @PostMapping("/{id}/preview/close")
    public ResponseEntity<ControlledCopyPreviewResponse> closePreview(
            @PathVariable UUID id,
            @RequestBody(required = false) ControlledCopyPreviewCloseRequest request
    ) {
        return ResponseEntity.ok(controlledCopyService.closePreview(
                id,
                request == null ? null : request.token(),
                request == null ? null : request.timeSpentMs()
        ));
    }

    @PostMapping("/{id}/preview/print")
    public ResponseEntity<Void> consumePreviewPrint(
            @PathVariable UUID id,
            @RequestBody ControlledCopyPreviewCloseRequest request
    ) {
        controlledCopyService.consumePreviewPrint(id, request == null ? null : request.token());
        return ResponseEntity.noContent().build();
    }

    @PostMapping
    public ResponseEntity<ControlledCopyListItemResponse> create(@Valid @RequestBody ControlledCopyRequestCreateRequest request) {
        return ResponseEntity.ok(controlledCopyService.requestControlledCopy(request));
    }

    @PostMapping("/{id}/print")
    public ResponseEntity<ControlledCopyListItemResponse> print(
            @PathVariable UUID id,
            @RequestBody(required = false) ControlledCopyPrintRequest request
    ) {
        return ResponseEntity.ok(controlledCopyService.markAsPrinted(id, request));
    }

    @PostMapping("/{id}/distribute")
    public ResponseEntity<ControlledCopyListItemResponse> distribute(
            @PathVariable UUID id,
            @RequestBody(required = false) ControlledCopyDistributeRequest request
    ) {
        return ResponseEntity.ok(controlledCopyService.distribute(id, request));
    }

    @PostMapping("/batches/{batchId}/distribute")
    public ResponseEntity<ControlledCopyDistributionBatchSummaryResponse> distributeBatch(
            @PathVariable UUID batchId,
            @RequestBody(required = false) ControlledCopyDistributeRequest request
    ) {
        return ResponseEntity.ok(controlledCopyService.distributeBatch(batchId, request));
    }

    @PostMapping("/{id}/destroy")
    public ResponseEntity<ControlledCopyListItemResponse> destroy(
            @PathVariable UUID id,
            @RequestBody(required = false) ControlledCopyDestroyRequest request
    ) {
        return ResponseEntity.ok(controlledCopyService.destroy(id, request));
    }

    @PostMapping(value = "/{id}/destroy", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ControlledCopyListItemResponse> destroyWithEvidence(
            @PathVariable UUID id,
            @RequestParam(required = false) String destroyedBy,
            @RequestParam(required = false) String destroyedByUserId,
            @RequestParam(required = false) String destroyReason,
            @RequestParam(required = false) String witnessedBy,
            @RequestParam(required = false) String witnessedByUserId,
            @RequestParam(required = false) String destroyedAt,
            @RequestParam(required = false) String destructionMethod,
            @RequestParam(required = false) String destructionType,
            @RequestParam(required = false) String signatureToken,
            @RequestPart(value = "evidenceFiles", required = false) List<MultipartFile> evidenceFiles
    ) {
        return ResponseEntity.ok(controlledCopyService.destroy(
                id,
                new ControlledCopyDestroyRequest(
                        destroyedBy,
                        destroyedByUserId,
                        destroyReason,
                        witnessedBy,
                        witnessedByUserId,
                        destroyedAt,
                        destructionMethod,
                        destructionType,
                        signatureToken
                ),
                evidenceFiles
        ));
    }

    @GetMapping("/{id}/evidence")
    public ResponseEntity<List<ControlledCopyEvidenceResponse>> listEvidence(@PathVariable UUID id) {
        return ResponseEntity.ok(controlledCopyService.listEvidence(id));
    }

    @GetMapping("/{id}/evidence/{evidenceId}/download")
    public ResponseEntity<byte[]> downloadEvidence(@PathVariable UUID id, @PathVariable UUID evidenceId) {
        ControlledCopyService.FileDownload file = controlledCopyService.downloadEvidence(id, evidenceId);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + file.fileName() + "\"")
                .contentType(MediaType.parseMediaType(file.contentType()))
                .body(file.bytes());
    }

    @PostMapping("/{id}/recall")
    public ResponseEntity<ControlledCopyListItemResponse> recall(
            @PathVariable UUID id,
            @RequestBody(required = false) ControlledCopyRecallRequest request
    ) {
        return ResponseEntity.ok(controlledCopyService.recall(id, request));
    }

    @PostMapping("/{id}/replace")
    public ResponseEntity<ControlledCopyListItemResponse> replaceLostDamaged(
            @PathVariable UUID id,
            @RequestBody(required = false) ControlledCopyReplaceRequest request
    ) {
        return ResponseEntity.ok(controlledCopyService.replaceLostDamaged(id, request));
    }

    @PostMapping("/batches/{batchId}/recall")
    public ResponseEntity<ControlledCopyDistributionBatchSummaryResponse> recallBatch(
            @PathVariable UUID batchId,
            @RequestBody(required = false) ControlledCopyRecallRequest request
    ) {
        return ResponseEntity.ok(controlledCopyService.recallBatch(batchId, request));
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<ControlledCopyListItemResponse> cancel(
            @PathVariable UUID id,
            @RequestBody(required = false) ControlledCopyCancelRequest request
    ) {
        return ResponseEntity.ok(controlledCopyService.cancel(id, request));
    }

    @PostMapping("/batches/{batchId}/cancel")
    public ResponseEntity<ControlledCopyDistributionBatchSummaryResponse> cancelBatch(
            @PathVariable UUID batchId,
            @RequestBody(required = false) ControlledCopyCancelRequest request
    ) {
        return ResponseEntity.ok(controlledCopyService.cancelBatch(batchId, request));
    }
}
