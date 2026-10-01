package com.eqms.controller;

import com.eqms.dto.executedrecord.ApproveExecutedRecordRequest;
import com.eqms.dto.executedrecord.ExecutedRecordResponse;
import com.eqms.dto.executedrecord.RecordExecutionRequest;
import com.eqms.dto.executedrecord.RejectExecutedRecordRequest;
import com.eqms.dto.executedrecord.SubmitEformSessionRequest;
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
 * Executed Records API (Form / eForm phase 1). {@code /forms/{formDocumentId}/executed-records/*}
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
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String captureMethod,
            @RequestParam(required = false) String formDocumentId,
            @RequestParam(required = false) String filledFrom,
            @RequestParam(required = false) String filledTo,
            @RequestParam(required = false, defaultValue = "created") String sortBy,
            @RequestParam(required = false, defaultValue = "desc") String sortDirection
    ) {
        return ResponseEntity.ok(executedRecordService.list(
                page, limit, search, status, captureMethod, formDocumentId, filledFrom, filledTo, sortBy, sortDirection));
    }

    @GetMapping("/executed-records/{id}")
    public ResponseEntity<ExecutedRecordResponse> getDetail(@PathVariable UUID id) {
        return ResponseEntity.ok(executedRecordService.getDetail(id));
    }

    @PostMapping(value = "/forms/{formDocumentId}/executed-records/record-physical-copy", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ExecutedRecordResponse> recordPhysicalCopy(
            @PathVariable UUID formDocumentId,
            @RequestPart("request") String requestJson,
            @RequestPart("file") MultipartFile file
    ) throws IOException {
        RecordExecutionRequest request = objectMapper.readValue(requestJson, RecordExecutionRequest.class);
        try (var stream = file.getInputStream()) {
            return ResponseEntity.ok(executedRecordService.recordPhysicalCopy(
                    formDocumentId, request, file.getOriginalFilename(), stream));
        }
    }

    /** Launched from a Controlled Copy's own Recall action (not the Form's Executed Records tab)
     *  -- "this copy came back filled in" and "this copy is now closed" as one operator action,
     *  one e-signature. See {@link ExecutedRecordService#recordPhysicalCopyAndClose}. */
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

    @PostMapping(value = "/forms/{formDocumentId}/executed-records/submit-eform", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ExecutedRecordResponse> submitEform(
            @PathVariable UUID formDocumentId,
            @RequestPart("request") String requestJson,
            @RequestPart("file") MultipartFile file
    ) throws IOException {
        RecordExecutionRequest request = objectMapper.readValue(requestJson, RecordExecutionRequest.class);
        try (var stream = file.getInputStream()) {
            return ResponseEntity.ok(executedRecordService.submitEform(
                    formDocumentId, request, file.getOriginalFilename(), stream));
        }
    }

    @PostMapping(value = "/forms/{formDocumentId}/executed-records/submit-eform-session")
    public ResponseEntity<ExecutedRecordResponse> submitEformSession(
            @PathVariable UUID formDocumentId, @RequestBody SubmitEformSessionRequest request
    ) throws IOException {
        return ResponseEntity.ok(executedRecordService.submitEformFromSession(
                formDocumentId, UUID.fromString(request.eformSessionId()), request.reason(), request.signatureToken()));
    }

    @PostMapping("/executed-records/{id}/approve")
    public ResponseEntity<ExecutedRecordResponse> approve(@PathVariable UUID id, @RequestBody ApproveExecutedRecordRequest request) {
        return ResponseEntity.ok(executedRecordService.approve(id, request));
    }

    @PostMapping("/executed-records/{id}/reject")
    public ResponseEntity<ExecutedRecordResponse> reject(@PathVariable UUID id, @RequestBody RejectExecutedRecordRequest request) {
        return ResponseEntity.ok(executedRecordService.reject(id, request));
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
