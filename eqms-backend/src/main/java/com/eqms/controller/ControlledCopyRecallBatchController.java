package com.eqms.controller;

import com.eqms.dto.controlledcopyrecall.RecallBatchCommitRequest;
import com.eqms.dto.controlledcopyrecall.RecallBatchResponse;
import com.eqms.dto.controlledcopyrecall.RecallBatchSummaryResponse;
import com.eqms.dto.controlledcopyrecall.RecallItemResponse;
import com.eqms.dto.controlledcopyrecall.RecallItemUpdateRequest;
import com.eqms.service.ControlledCopyRecallBatchService;
import com.eqms.service.ExecutedRecordService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

/**
 * Recall paper Controlled Copies in bulk by scanning their QR code. A draft batch is built from uploaded scans, reviewed,
 * then committed with one electronic signature. All authorization and business rules live in
 * {@link ControlledCopyRecallBatchService}.
 */
@RestController
@RequestMapping("/controlled-copies/recall-batches")
public class ControlledCopyRecallBatchController {

    private final ControlledCopyRecallBatchService recallBatchService;

    public ControlledCopyRecallBatchController(ControlledCopyRecallBatchService recallBatchService) {
        this.recallBatchService = recallBatchService;
    }

    /** The current user's open drafts, so an interrupted review can be resumed. */
    @GetMapping
    public ResponseEntity<List<RecallBatchSummaryResponse>> myDrafts() {
        return ResponseEntity.ok(recallBatchService.myDrafts());
    }

    /** Starts a draft from up to 50 scans (PDF, PNG or JPEG). Nothing about any copy changes yet. */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<RecallBatchResponse> create(@RequestPart("files") List<MultipartFile> files) {
        return ResponseEntity.ok(recallBatchService.createDraft(files));
    }

    @PostMapping(value = "/{batchId}/files", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<RecallBatchResponse> addFiles(@PathVariable UUID batchId, @RequestPart("files") List<MultipartFile> files) {
        return ResponseEntity.ok(recallBatchService.addFiles(batchId, files));
    }

    @GetMapping("/{batchId}")
    public ResponseEntity<RecallBatchResponse> get(@PathVariable UUID batchId) {
        return ResponseEntity.ok(recallBatchService.get(batchId));
    }

    /** The scans of a batch, searched and sorted on the server: {@code sortBy} is itemNo (default), file, code, copy or result. */
    @GetMapping("/{batchId}/items")
    public ResponseEntity<java.util.List<RecallItemResponse>> items(
            @PathVariable UUID batchId,
            @RequestParam(required = false) String search,
            @RequestParam(required = false, defaultValue = "itemNo") String sortBy,
            @RequestParam(required = false, defaultValue = "asc") String sortDirection) {
        return ResponseEntity.ok(recallBatchService.listItems(batchId, search, sortBy, sortDirection));
    }

    /** Excludes a scan, or identifies its copy by number when the QR code could not be read. */
    @PatchMapping("/{batchId}/items/{itemId}")
    public ResponseEntity<RecallBatchResponse> updateItem(
            @PathVariable UUID batchId, @PathVariable UUID itemId, @RequestBody RecallItemUpdateRequest request) {
        return ResponseEntity.ok(recallBatchService.updateItem(batchId, itemId, request));
    }

    /** The uploaded scan, inline, for the review screen. */
    @GetMapping("/{batchId}/items/{itemId}/file")
    public ResponseEntity<byte[]> itemFile(@PathVariable UUID batchId, @PathVariable UUID itemId) throws IOException {
        ExecutedRecordService.RecordFile file = recallBatchService.previewItemFile(batchId, itemId);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline")
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .header("X-Content-Type-Options", "nosniff")
                .contentType(MediaType.parseMediaType(file.contentType()))
                .body(file.bytes());
    }

    @PostMapping("/{batchId}/commit")
    public ResponseEntity<RecallBatchResponse> commit(@PathVariable UUID batchId, @RequestBody RecallBatchCommitRequest request) {
        return ResponseEntity.ok(recallBatchService.commit(batchId, request));
    }

    @PostMapping("/{batchId}/discard")
    public ResponseEntity<RecallBatchResponse> discard(@PathVariable UUID batchId) {
        return ResponseEntity.ok(recallBatchService.discard(batchId));
    }
}
