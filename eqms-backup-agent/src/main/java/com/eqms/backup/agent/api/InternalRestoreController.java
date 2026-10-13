package com.eqms.backup.agent.api;

import com.eqms.backup.agent.export.ExportException;
import com.eqms.backup.agent.maintenance.MaintenanceService;
import com.eqms.backup.agent.restore.RestoreExecutionService;
import com.eqms.backup.agent.restore.RestoreRequestService;
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

import java.util.LinkedHashMap;
import java.time.Instant;
import java.util.Map;

/** Restore requests (steps R0-R3). The backend has checked the person and the permission; the agent enforces who may decide. */
@RestController
@RequestMapping("/internal")
public class InternalRestoreController {

    public record RequestBodyDto(String type, String target, String reason, String changeControlRef, String by) {
    }

    public record ByRequest(String by, String signatureRef) {
    }

    public record ReasonRequest(String by, String reason) {
    }

    private final RestoreRequestService requests;
    private final com.eqms.backup.agent.restore.WeeklyV2Verification weeklyV2;
    private final com.eqms.backup.agent.restore.RestoreEvidence evidence;
    private final RestoreExecutionService execution;

    public InternalRestoreController(RestoreRequestService requests, RestoreExecutionService execution, com.eqms.backup.agent.restore.WeeklyV2Verification weeklyV2,
                                    com.eqms.backup.agent.restore.RestoreEvidence evidence) {
        this.requests = requests;
        this.execution = execution;
        this.weeklyV2 = weeklyV2;
        this.evidence = evidence;
    }

    public record ScheduleRequest(String by, String windowStart) {
    }

    public record EnterWindowRequest(String by, boolean noUserConfirmed) {
    }

    public record TestRestoreRequest(String by) {
    }

    @GetMapping("/restores/{restoreNumber}/execution")
    public Map<String, Object> executionChecks(@PathVariable String restoreNumber) {
        return execution.preflight(restoreNumber);
    }

    @PostMapping("/restores/{restoreNumber}/schedule")
    public Map<String, Object> schedule(@PathVariable String restoreNumber, @RequestBody ScheduleRequest r) {
        Instant window;
        try {
            window = Instant.parse(r.windowStart() == null ? "" : r.windowStart());
        } catch (java.time.format.DateTimeParseException e) {
            throw ExportException.invalid("RESTORE_WINDOW_FORMAT", "The maintenance window must be an instant such as 2026-10-10T02:00:00Z");
        }
        return execution.schedule(restoreNumber, r.by(), window);
    }

    @GetMapping("/restores")
    public Map<String, Object> list(@RequestParam(required = false) String search, @RequestParam(required = false) String status, @RequestParam(required = false) String target,
                                    @RequestParam(defaultValue = "requestedAt") String sortBy, @RequestParam(defaultValue = "desc") String sortDirection,
                                    @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit) {
        RestoreRequestService.Page result = requests.page(search, status, target, sortBy, "asc".equalsIgnoreCase(sortDirection), page, limit);
        Map<String, Object> pagination = new LinkedHashMap<>();
        pagination.put("page", result.page());
        pagination.put("limit", result.limit());
        pagination.put("total", result.total());
        pagination.put("totalPages", Math.max(1, (int) Math.ceil(result.total() / (double) result.limit())));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("data", result.data());
        out.put("pagination", pagination);
        return out;
    }

    @GetMapping("/restores/{restoreNumber}")
    public Map<String, Object> get(@PathVariable String restoreNumber) {
        return requests.get(restoreNumber);
    }

    @GetMapping("/backups/{backupNumber}/restore-readiness")
    public Map<String, Object> readiness(@PathVariable String backupNumber) {
        return requests.readiness(backupNumber);
    }

    @PostMapping("/backups/{backupNumber}/restores")
    public ResponseEntity<Map<String, Object>> request(@PathVariable String backupNumber, @RequestBody RequestBodyDto r) {
        return ResponseEntity.status(HttpStatus.CREATED).body(requests.request(backupNumber, r.type(), r.target(), r.reason(), r.changeControlRef(), r.by()));
    }

    @PostMapping("/restores/{restoreNumber}/approve")
    public Map<String, Object> approve(@PathVariable String restoreNumber, @RequestBody ByRequest r) {
        return requests.approve(restoreNumber, r.by(), r.signatureRef());
    }

    @PostMapping("/restores/{restoreNumber}/reject")
    public Map<String, Object> reject(@PathVariable String restoreNumber, @RequestBody ReasonRequest r) {
        return requests.reject(restoreNumber, r.by(), r.reason());
    }

    /** Starts the restore window: the system goes to LOCKED_RESTORING for this request (SDS 11.5.1, WP3.1 slice 2). */
    @PostMapping("/restores/{restoreNumber}/enter-window")
    public Map<String, Object> enterWindow(@PathVariable String restoreNumber, @RequestBody EnterWindowRequest r) {
        return execution.enterWindow(restoreNumber, r.by(), r.noUserConfirmed());
    }

    /** The signed evidence pack of one restore request (SDS 16). */
    @GetMapping("/restores/{restoreNumber}/evidence")
    public Map<String, Object> evidencePack(@PathVariable String restoreNumber) {
        return evidence.pack(restoreNumber);
    }

    /** Runs the weekly V2 check now, the same as the Monday schedule does (SDS 14.1). Worker only; returns the rehearsal id or none. */
    @PostMapping("/verification/v2")
    public Map<String, Object> runV2(@RequestBody(required = false) java.util.Map<String, Object> ignored) {
        java.util.Optional<String> id = weeklyV2.runOnce();
        java.util.Map<String, Object> out = new LinkedHashMap<>();
        out.put("rehearsalId", id.orElse(null));
        return out;
    }

    /** Starts the test restore of the backup inside the restore window (SDS 14.1, WP3.1 slice 3). */
    @PostMapping("/restores/{restoreNumber}/test-restore")
    public Map<String, Object> testRestore(@PathVariable String restoreNumber, @RequestBody TestRestoreRequest r) {
        return execution.startTestRestore(restoreNumber, r.by());
    }

    @ExceptionHandler(MaintenanceService.MaintenanceException.class)
    public ResponseEntity<Map<String, Object>> maintenanceRefused(MaintenanceService.MaintenanceException e) {
        HttpStatus status = e.code.equals("MAINTENANCE_STATE") || e.code.equals("MAINTENANCE_CONFIRMATION_REQUIRED") ? HttpStatus.CONFLICT : HttpStatus.BAD_REQUEST;
        if (e.code.equals("MAINTENANCE_LOCK_FILE")) status = HttpStatus.INTERNAL_SERVER_ERROR;
        return ResponseEntity.status(status).body(Map.of("code", e.code, "message", e.getMessage()));
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
