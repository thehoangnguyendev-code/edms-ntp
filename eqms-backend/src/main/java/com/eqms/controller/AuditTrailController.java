package com.eqms.controller;

import com.eqms.dto.audittrail.AuditTrailRecordResponse;
import com.eqms.dto.audittrail.AuditTrailDetailResponse;
import com.eqms.dto.audittrail.AuditTrailUserOptionResponse;
import com.eqms.dto.user.PageResponse;
import com.eqms.service.AuditTrailService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/audit-trail")
public class AuditTrailController {

    private final AuditTrailService auditTrailService;

    public AuditTrailController(AuditTrailService auditTrailService) {
        this.auditTrailService = auditTrailService;
    }

    @GetMapping
    public ResponseEntity<PageResponse<AuditTrailRecordResponse>> list(
            @RequestParam(required = false) String search,
            @RequestParam(required = false, defaultValue = "All") String module,
            @RequestParam(required = false, defaultValue = "All") String action,
            @RequestParam(required = false) String user,
            @RequestParam(required = false, defaultValue = "All") String severity,
            @RequestParam(required = false) String documentNumber,
            @RequestParam(required = false) String entityId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String ipAddress,
            @RequestParam(required = false) Boolean eSignatureOnly,
            @RequestParam(required = false) String dateFrom,
            @RequestParam(required = false) String dateTo,
            @RequestParam(defaultValue = "timestamp") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDirection,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit
    ) {
        return ResponseEntity.ok(auditTrailService.list(search, module, action, user, severity, documentNumber, entityId, status, ipAddress, eSignatureOnly, dateFrom, dateTo, sortBy, sortDirection, page, limit));
    }

    @GetMapping("/{id}")
    public ResponseEntity<AuditTrailDetailResponse> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(auditTrailService.getById(id));
    }

    @GetMapping("/entity/{module}/{entityId}")
    public ResponseEntity<List<AuditTrailRecordResponse>> getByEntity(
            @PathVariable String module,
            @PathVariable UUID entityId
    ) {
        return ResponseEntity.ok(auditTrailService.getByEntity(module, entityId));
    }

    @GetMapping("/users")
    public ResponseEntity<List<AuditTrailUserOptionResponse>> getUsers(
            @RequestParam(required = false, defaultValue = "All") String module,
            @RequestParam(required = false) String documentNumber,
            @RequestParam(required = false) String entityId
    ) {
        return ResponseEntity.ok(auditTrailService.listUsers(module, documentNumber, entityId));
    }

    @GetMapping("/export")
    public ResponseEntity<StreamingResponseBody> export(
            @RequestParam(required = false) String search,
            @RequestParam(required = false, defaultValue = "All") String module,
            @RequestParam(required = false, defaultValue = "All") String action,
            @RequestParam(required = false) String user,
            @RequestParam(required = false, defaultValue = "All") String severity,
            @RequestParam(required = false) String documentNumber,
            @RequestParam(required = false) String entityId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String ipAddress,
            @RequestParam(required = false) Boolean eSignatureOnly,
            @RequestParam(required = false) String dateFrom,
            @RequestParam(required = false) String dateTo,
            @RequestParam(defaultValue = "timestamp") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDirection
    ) {
        StreamingResponseBody csv = outputStream -> auditTrailService.writeExport(
                search, module, action, user, severity, documentNumber, entityId, status, ipAddress,
                eSignatureOnly, dateFrom, dateTo, sortBy, sortDirection, outputStream
        );
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=audit-trail.csv")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(csv);
    }
}
