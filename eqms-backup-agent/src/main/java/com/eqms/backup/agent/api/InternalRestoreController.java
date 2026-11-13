package com.eqms.backup.agent.api;

import com.eqms.backup.agent.export.ExportException;
import com.eqms.backup.agent.maintenance.MaintenanceService;
import com.eqms.backup.agent.restore.WeeklyV2Verification;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * The weekly restore check (SDS 14.1). The restore request and approval flow (R0-R3) was removed: a restore into production is
 * {@link InternalProductionRestoreController}, signed by the person who does it. The records of the old requests stay in the control
 * database as evidence; nothing reads or writes them any more.
 */
@RestController
@RequestMapping("/internal")
public class InternalRestoreController {

    private final WeeklyV2Verification weeklyV2;

    public InternalRestoreController(WeeklyV2Verification weeklyV2) {
        this.weeklyV2 = weeklyV2;
    }

    /** Runs the weekly V2 check now, the same as the Monday schedule does (SDS 14.1). Worker only; returns the rehearsal id or none. */
    @PostMapping("/verification/v2")
    public Map<String, Object> runV2(@RequestBody(required = false) Map<String, Object> ignored) {
        java.util.Optional<String> id = weeklyV2.runOnce();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("rehearsalId", id.orElse(null));
        return out;
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
