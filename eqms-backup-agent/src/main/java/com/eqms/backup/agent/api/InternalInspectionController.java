package com.eqms.backup.agent.api;

import com.eqms.backup.agent.export.ExportException;
import com.eqms.backup.agent.restore.InspectionService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/** Backup Inspection (SDS 7.2). The backend has checked the person and the permission; the agent enforces who may approve. */
@RestController
@RequestMapping("/internal")
public class InternalInspectionController {

    public record AskRequest(String by, String reason) {
    }

    public record ApproveRequest(String by, String signatureRef) {
    }

    public record ReasonRequest(String by, String reason) {
    }

    private final InspectionService inspections;

    public InternalInspectionController(InspectionService inspections) {
        this.inspections = inspections;
    }

    @GetMapping("/inspections")
    public Map<String, Object> list(@RequestParam(required = false) String search, @RequestParam(required = false) String status,
                                    @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit) {
        return inspections.page(search, status, page, limit);
    }

    @GetMapping("/inspections/{inspectionId}")
    public Map<String, Object> get(@PathVariable String inspectionId) {
        return inspections.get(inspectionId);
    }

    @PostMapping("/backups/{backupId}/inspections")
    public ResponseEntity<Map<String, Object>> ask(@PathVariable String backupId, @RequestBody AskRequest r) {
        return ResponseEntity.status(HttpStatus.CREATED).body(inspections.request(backupId, r.by(), r.reason()));
    }

    @PostMapping("/inspections/{inspectionId}/approve")
    public Map<String, Object> approve(@PathVariable String inspectionId, @RequestBody ApproveRequest r) {
        return inspections.approve(inspectionId, r.by(), r.signatureRef());
    }

    @PostMapping("/inspections/{inspectionId}/reject")
    public Map<String, Object> reject(@PathVariable String inspectionId, @RequestBody ReasonRequest r) {
        return inspections.reject(inspectionId, r.by(), r.reason());
    }

    @PostMapping("/inspections/{inspectionId}/close")
    public Map<String, Object> close(@PathVariable String inspectionId, @RequestBody ReasonRequest r) {
        return inspections.close(inspectionId, r.by(), r.reason());
    }

    @ExceptionHandler(ExportException.class)
    public ResponseEntity<Map<String, Object>> refused(ExportException e) {
        HttpStatus status = switch (e.kind) {
            case NOT_FOUND -> HttpStatus.NOT_FOUND;
            case CONFLICT, SEPARATION -> HttpStatus.CONFLICT;
            case INVALID -> HttpStatus.BAD_REQUEST;
        };
        return ResponseEntity.status(status).body(Map.of("code", e.code, "message", e.getMessage()));
    }
}
