package com.eqms.controller;

import com.eqms.dto.uncontrolledcopy.UncontrolledCopyActionRequest;
import com.eqms.dto.uncontrolledcopy.UncontrolledCopyBatchDistributeRequest;
import com.eqms.dto.uncontrolledcopy.UncontrolledCopyCreateRequest;
import com.eqms.dto.uncontrolledcopy.UncontrolledCopyFiltersResponse;
import com.eqms.dto.uncontrolledcopy.UncontrolledCopyRequestContextResponse;
import com.eqms.dto.uncontrolledcopy.UncontrolledCopyResponse;
import com.eqms.dto.user.PageResponse;
import com.eqms.service.UncontrolledCopyService;
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

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Uncontrolled Copy API. Mirrors the applicable subset of {@link ControlledCopyController}'s endpoint shape --
 * there are deliberately no recall / replace / evidence / destroy endpoints, since an Uncontrolled Copy is never
 * tracked after issuance. All authorization is enforced in {@link UncontrolledCopyService}.
 */
@RestController
@RequestMapping("/uncontrolled-copies")
public class UncontrolledCopyController {

    private final UncontrolledCopyService uncontrolledCopyService;

    public UncontrolledCopyController(UncontrolledCopyService uncontrolledCopyService) {
        this.uncontrolledCopyService = uncontrolledCopyService;
    }

    @GetMapping("/filters")
    public ResponseEntity<UncontrolledCopyFiltersResponse> getFilters() {
        return ResponseEntity.ok(uncontrolledCopyService.getFilters());
    }

    @GetMapping
    public ResponseEntity<PageResponse<UncontrolledCopyResponse>> list(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String documentId,
            @RequestParam(required = false) String createdFrom,
            @RequestParam(required = false) String createdTo,
            @RequestParam(required = false) String validFrom,
            @RequestParam(required = false) String validTo,
            @RequestParam(required = false) String approvedFrom,
            @RequestParam(required = false) String approvedTo,
            @RequestParam(required = false) String distributedFrom,
            @RequestParam(required = false) String distributedTo,
            @RequestParam(required = false, defaultValue = "created") String sortBy,
            @RequestParam(required = false, defaultValue = "desc") String sortDirection
    ) {
        return ResponseEntity.ok(uncontrolledCopyService.list(
                page, limit, search, status, documentId, createdFrom, createdTo, validFrom, validTo,
                approvedFrom, approvedTo, distributedFrom, distributedTo, sortBy, sortDirection));
    }

    @GetMapping("/request-context")
    public ResponseEntity<UncontrolledCopyRequestContextResponse> getRequestContext(
            @RequestParam(required = false) String documentId,
            @RequestParam(required = false) String revisionId
    ) {
        return ResponseEntity.ok(uncontrolledCopyService.getRequestContext(documentId, revisionId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<UncontrolledCopyResponse> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(uncontrolledCopyService.getDetail(id));
    }

    @GetMapping("/{id}/detail")
    public ResponseEntity<UncontrolledCopyResponse> getDetailById(@PathVariable UUID id) {
        return ResponseEntity.ok(uncontrolledCopyService.getDetail(id));
    }

    @PostMapping
    public ResponseEntity<UncontrolledCopyResponse> create(@RequestBody UncontrolledCopyCreateRequest request) {
        return ResponseEntity.ok(uncontrolledCopyService.requestUncontrolledCopy(request));
    }

    @PostMapping("/{id}/approve")
    public ResponseEntity<UncontrolledCopyResponse> approve(
            @PathVariable UUID id,
            @RequestBody(required = false) UncontrolledCopyActionRequest request
    ) {
        return ResponseEntity.ok(uncontrolledCopyService.approveRequest(id, request));
    }

    @PostMapping("/{id}/reject")
    public ResponseEntity<UncontrolledCopyResponse> reject(
            @PathVariable UUID id,
            @RequestBody(required = false) UncontrolledCopyActionRequest request
    ) {
        return ResponseEntity.ok(uncontrolledCopyService.rejectRequest(id, request));
    }

    @PostMapping("/{id}/generate")
    public ResponseEntity<UncontrolledCopyResponse> generate(
            @PathVariable UUID id,
            @RequestBody(required = false) UncontrolledCopyActionRequest request
    ) {
        return ResponseEntity.ok(uncontrolledCopyService.generate(id, request));
    }

    @PostMapping("/{id}/distribute")
    public ResponseEntity<UncontrolledCopyResponse> distribute(
            @PathVariable UUID id,
            @RequestBody(required = false) UncontrolledCopyActionRequest request
    ) {
        return ResponseEntity.ok(uncontrolledCopyService.distribute(id, request));
    }

    @PostMapping("/distribute-batch")
    public ResponseEntity<List<UncontrolledCopyResponse>> distributeBatch(@RequestBody UncontrolledCopyBatchDistributeRequest request) {
        return ResponseEntity.ok(uncontrolledCopyService.distributeBatch(request));
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<UncontrolledCopyResponse> cancel(
            @PathVariable UUID id,
            @RequestBody(required = false) UncontrolledCopyActionRequest request
    ) {
        return ResponseEntity.ok(uncontrolledCopyService.cancel(id, request));
    }

    /** Inline view of the stored watermarked PDF (does not consume the download allowance). */
    @GetMapping("/{id}/preview")
    public ResponseEntity<byte[]> preview(@PathVariable UUID id) {
        UncontrolledCopyService.FileDownload file = uncontrolledCopyService.preview(id);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + file.fileName() + "\"")
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .header("X-Content-Type-Options", "nosniff")
                .contentType(MediaType.parseMediaType(file.contentType()))
                .body(file.bytes());
    }

    /** Alias of /preview, matching the Controlled Copy "/preview/file" naming used by the embedded viewer. */
    @GetMapping("/{id}/file")
    public ResponseEntity<byte[]> file(@PathVariable UUID id) {
        return preview(id);
    }

    /**
     * Attachment download. Login-required (the link in the distribution e-mail points at the frontend route that
     * calls this), never a public/token link -- same pattern as the Controlled Copy DCO ZIP download.
     */
    @GetMapping("/{id}/download")
    public ResponseEntity<byte[]> download(@PathVariable UUID id) {
        UncontrolledCopyService.FileDownload file = uncontrolledCopyService.download(id);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + file.fileName() + "\"")
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .header("X-Content-Type-Options", "nosniff")
                .contentType(MediaType.parseMediaType(file.contentType()))
                .body(file.bytes());
    }

    @GetMapping("/{id}/distribution-job-status")
    public ResponseEntity<Map<String, Object>> getDistributionJobStatus(@PathVariable UUID id) {
        return ResponseEntity.ok(uncontrolledCopyService.getDistributionJobStatus(id));
    }
}
