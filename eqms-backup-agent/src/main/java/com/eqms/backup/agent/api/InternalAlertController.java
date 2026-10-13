package com.eqms.backup.agent.api;

import com.eqms.backup.agent.alert.AlertService;
import com.eqms.backup.agent.export.ExportException;
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

/** Backup alerts and their recipients (SDS 15.1). The backend has checked the person and the permission. */
@RestController
@RequestMapping("/internal")
public class InternalAlertController {

    public record AcknowledgeRequest(String by, String comment) {
    }

    public record PersonRequest(String by, String username) {
    }

    private final AlertService alerts;

    public InternalAlertController(AlertService alerts) {
        this.alerts = alerts;
    }

    @GetMapping("/alerts")
    public Map<String, Object> list(@RequestParam(required = false) String state, @RequestParam(required = false) String severity,
                                    @RequestParam(required = false) String search, @RequestParam(defaultValue = "1") int page,
                                    @RequestParam(defaultValue = "10") int limit) {
        return alerts.page(state, severity, search, page, limit);
    }

    @PostMapping("/alerts/{alertId}/acknowledge")
    public Map<String, Object> acknowledge(@PathVariable String alertId, @RequestBody AcknowledgeRequest r) {
        return alerts.acknowledge(alertId, r.by(), r.comment());
    }

    @GetMapping("/alert-recipients")
    public List<Map<String, Object>> recipients() {
        return alerts.recipients();
    }

    @PostMapping("/alert-recipients")
    public ResponseEntity<Map<String, Object>> add(@RequestBody PersonRequest r) {
        return ResponseEntity.status(HttpStatus.CREATED).body(alerts.addRecipient(r.username(), r.by()));
    }

    @PostMapping("/alert-recipients/{username}/remove")
    public Map<String, Object> remove(@PathVariable String username, @RequestBody PersonRequest r) {
        return alerts.removeRecipient(username, r.by());
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
