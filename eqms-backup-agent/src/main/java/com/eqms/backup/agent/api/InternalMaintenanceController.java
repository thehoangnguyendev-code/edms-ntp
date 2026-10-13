package com.eqms.backup.agent.api;

import com.eqms.backup.agent.ledger.LedgerService;
import com.eqms.backup.agent.maintenance.MaintenanceService;
import com.eqms.backup.agent.maintenance.SuperAdminService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Maintenance window and Super Administrator checks, called by the eQMS backend only (shared secret). The backend has already
 * checked the Maintenance Pass; the agent records and enforces the state.
 */
@RestController
@RequestMapping("/internal")
public class InternalMaintenanceController {

    public record NoticeRequest(int minutes, String restoreNumber, String by) {
    }

    public record ByRequest(String by) {
    }

    public record LockRequest(String by, boolean noUserConfirmed) {
    }

    public record CredentialRequest(String username, String password) {
    }

    public record EventRequest(String event, String restoreNumber, String by, Map<String, Object> detail) {
    }

    private final MaintenanceService maintenance;
    private final SuperAdminService superAdmins;
    private final LedgerService ledger;

    public InternalMaintenanceController(MaintenanceService maintenance, SuperAdminService superAdmins, LedgerService ledger) {
        this.maintenance = maintenance;
        this.superAdmins = superAdmins;
        this.ledger = ledger;
    }

    /**
     * Records a step the eQMS backend took inside the window (for example the sessions signed out). Only a fixed list of event names
     * is accepted, so this cannot be used to write arbitrary entries.
     */
    @PostMapping("/maintenance/event")
    public ResponseEntity<Map<String, Object>> event(@RequestBody EventRequest r) {
        if (r.event() == null || !ALLOWED_EVENTS.contains(r.event())) {
            return ResponseEntity.badRequest().body(Map.of("code", "MAINTENANCE_EVENT_NOT_ALLOWED"));
        }
        ledger.append(r.by() == null || r.by().isBlank() ? "system" : r.by(), r.event(), r.restoreNumber() == null ? "maintenance" : r.restoreNumber(),
                r.detail() == null ? Map.of() : r.detail());
        return ResponseEntity.ok(Map.of("recorded", true));
    }

    private static final java.util.Set<String> ALLOWED_EVENTS = java.util.Set.of("MAINTENANCE_SESSIONS_REVOKED");

    @GetMapping("/maintenance")
    public Map<String, Object> status() {
        return view(maintenance.status());
    }

    @PostMapping("/maintenance/notice")
    public Map<String, Object> notice(@RequestBody NoticeRequest r) {
        return view(maintenance.notice(r.minutes(), r.restoreNumber(), r.by()));
    }

    @PostMapping("/maintenance/cancel")
    public Map<String, Object> cancel(@RequestBody ByRequest r) {
        return view(maintenance.cancel(r.by()));
    }

    @PostMapping("/maintenance/lock")
    public Map<String, Object> lock(@RequestBody LockRequest r) {
        return view(maintenance.lock(r.by(), r.noUserConfirmed()));
    }

    @PostMapping("/maintenance/unlock")
    public Map<String, Object> unlock(@RequestBody ByRequest r) {
        return view(maintenance.unlock(r.by()));
    }

    /** Checks the Super Administrator's password. Returns 401 for a wrong user or password alike. */
    @PostMapping("/super-admin/verify")
    public ResponseEntity<Map<String, Object>> verify(@RequestBody CredentialRequest r) {
        boolean ok = superAdmins.verify(r.username(), r.password());
        return ok ? ResponseEntity.ok(Map.of("ok", true)) : ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("ok", false));
    }

    private static Map<String, Object> view(MaintenanceService.Status s) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("state", s.state().name());
        m.put("restoreNumber", s.restoreNumber());
        m.put("endsAt", s.endsAt() == null ? null : s.endsAt().toString());
        m.put("changedBy", s.changedBy());
        m.put("changedAt", s.changedAt().toString());
        m.put("serverNow", Instant.now().toString());
        return m;
    }

    @ExceptionHandler(SuperAdminService.LockedOutException.class)
    public ResponseEntity<Map<String, Object>> lockedOut(SuperAdminService.LockedOutException e) {
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(Map.of("ok", false, "code", "SUPER_ADMIN_LOCKED", "message", e.getMessage()));
    }

    @ExceptionHandler(MaintenanceService.MaintenanceException.class)
    public ResponseEntity<Map<String, Object>> refused(MaintenanceService.MaintenanceException e) {
        HttpStatus status = e.code.equals("MAINTENANCE_STATE") || e.code.equals("MAINTENANCE_CONFIRMATION_REQUIRED") ? HttpStatus.CONFLICT : HttpStatus.BAD_REQUEST;
        if (e.code.equals("MAINTENANCE_LOCK_FILE")) status = HttpStatus.INTERNAL_SERVER_ERROR;
        return ResponseEntity.status(status).body(Map.of("code", e.code, "message", e.getMessage()));
    }
}
