package com.eqms.controller;

import com.eqms.dto.executedrecord.ExecutedRecordResponse;
import com.eqms.dto.executedrecord.RecordExecutionRequest;
import com.eqms.dto.user.PageResponse;
import com.eqms.service.ExecutedRecordService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.UUID;

/**
 * Paper Executed Records API (including historical records). {@code /forms/{formDocumentId}/executed-records/*}
 * for creating records against a specific Form; {@code /executed-records/*} for the global list,
 * detail, approve/reject/download actions. All authorization is enforced in
 * {@link ExecutedRecordService}.
 */
@RestController
public class ExecutedRecordController {

    private final ExecutedRecordService executedRecordService;
    private final ObjectMapper objectMapper;

    public ExecutedRecordController(ExecutedRecordService executedRecordService, ObjectMapper objectMapper) {
        this.executedRecordService = executedRecordService;
        this.objectMapper = objectMapper;
    }

    @GetMapping("/executed-records")
    public ResponseEntity<PageResponse<ExecutedRecordResponse>> list(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String formDocumentId,
            @RequestParam(required = false) String controlledCopyId,
            @RequestParam(required = false) String filledFrom,
            @RequestParam(required = false) String filledTo,
            @RequestParam(required = false) String recordedFrom,
            @RequestParam(required = false) String recordedTo,
            @RequestParam(required = false, defaultValue = "created") String sortBy,
            @RequestParam(required = false, defaultValue = "desc") String sortDirection
    ) {
        return ResponseEntity.ok(executedRecordService.list(
                page, limit, search, formDocumentId, controlledCopyId, filledFrom, filledTo, recordedFrom, recordedTo, sortBy, sortDirection));
    }

    @GetMapping("/executed-records/{id}")
    public ResponseEntity<ExecutedRecordResponse> getDetail(@PathVariable UUID id) {
        return ResponseEntity.ok(executedRecordService.getDetail(id));
    }

    /** Launched from a Controlled Copy's own Recall action -- "this copy came back filled in" and
     *  "this copy is now closed" as one operator action, one e-signature. See
     *  {@link ExecutedRecordService#recordPhysicalCopyAndClose}. */
    @PostMapping(value = "/controlled-copies/{controlledCopyId}/recall-with-executed-record", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ExecutedRecordResponse> recordPhysicalCopyAndClose(
            @PathVariable UUID controlledCopyId,
            @RequestPart("request") String requestJson,
            @RequestPart("file") MultipartFile file
    ) throws IOException {
        RecordExecutionRequest request = objectMapper.readValue(requestJson, RecordExecutionRequest.class);
        try (var stream = file.getInputStream()) {
            return ResponseEntity.ok(executedRecordService.recordPhysicalCopyAndClose(
                    controlledCopyId, request, file.getOriginalFilename(), stream));
        }
    }

    /** The scan, inline, for the preview modal. Needs the view permission only, and the record's visibility. */
    @GetMapping("/executed-records/{id}/preview")
    public ResponseEntity<byte[]> preview(@PathVariable UUID id) throws IOException {
        ExecutedRecordService.RecordFile file = executedRecordService.previewFile(id);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline")
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .header("X-Content-Type-Options", "nosniff")
                .contentType(MediaType.parseMediaType(file.contentType()))
                .body(file.bytes());
    }

    @GetMapping("/executed-records/{id}/download")
    public ResponseEntity<byte[]> download(@PathVariable UUID id) throws IOException {
        ExecutedRecordResponse detail = executedRecordService.getDetail(id);
        byte[] bytes = executedRecordService.downloadFile(id);
        String fileName = (detail.recordNumber() == null ? "executed-record" : detail.recordNumber()) + ".pdf";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + fileName + "\"")
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .header("X-Content-Type-Options", "nosniff")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(bytes);
    }
}
