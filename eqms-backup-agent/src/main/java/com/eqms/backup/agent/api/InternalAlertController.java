package com.eqms.backup.agent.api;

import com.eqms.backup.agent.alert.AlertRuleService;
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

    public record RuleRequest(boolean inApp, boolean email, Integer threshold, String by, String reason) {
    }

    public record DeliveredRequest(List<String> ids) {
    }

    /** An alert raised by the application itself; only the codes listed in {@link #EXTERNAL_CODES} are accepted. */
    public record ExternalAlertRequest(String code, String severity, String detail) {
    }

    private static final java.util.Set<String> EXTERNAL_CODES = java.util.Set.of("REPORT_COPY_STALE");

    private final AlertService alerts;
    private final AlertRuleService rules;
    private final com.eqms.backup.agent.backup.BackupRepository repository;

    public InternalAlertController(AlertService alerts, AlertRuleService rules, com.eqms.backup.agent.backup.BackupRepository repository) {
        this.alerts = alerts;
        this.rules = rules;
        this.repository = repository;
    }

    /** The application tells the agent about a problem only it can see (the copy of the run summary is out of date). One open alert per code: a second call while it is not acknowledged adds nothing. */
    @PostMapping("/alerts/external")
    public Map<String, Object> external(@RequestBody ExternalAlertRequest r) {
        if (r == null || r.code() == null || !EXTERNAL_CODES.contains(r.code())) {
            throw ExportException.invalid("ALERT_CODE", "Not an alert the application may raise");
        }
        String severity = java.util.Set.of("INFO", "WARNING", "HIGH", "CRITICAL").contains(r.severity()) ? r.severity() : "WARNING";
        return Map.of("raised", repository.insertAlertOnce(severity, r.code(), r.detail() == null ? "" : r.detail(), null));
    }

    @GetMapping("/alert-rules")
    public List<Map<String, Object>> rules() {
        return rules.rules();
    }

    @PostMapping("/alert-rules/{code}")
    public Map<String, Object> changeRule(@PathVariable String code, @RequestBody RuleRequest r) {
        return rules.update(code, r.inApp(), r.email(), r.threshold(), r.by(), r.reason());
    }

    /** The alerts the backend still has to tell people about, and who they are to be told to. */
    @GetMapping("/alerts/pending-delivery")
    public Map<String, Object> pendingDelivery(@RequestParam(defaultValue = "50") int limit) {
        return rules.pendingDelivery(limit);
    }

    @PostMapping("/alerts/delivered")
    public Map<String, Object> delivered(@RequestBody DeliveredRequest r) {
        List<java.util.UUID> ids = new java.util.ArrayList<>();
        for (String id : r.ids() == null ? List.<String>of() : r.ids()) {
            try {
                ids.add(java.util.UUID.fromString(id));
            } catch (IllegalArgumentException e) {
                throw ExportException.invalid("ALERT_ID", "Not an alert id: " + id);
            }
        }
        return Map.of("marked", rules.markDelivered(ids));
    }

    @GetMapping("/alerts")
    public Map<String, Object> list(@RequestParam(required = false) String state, @RequestParam(required = false) String severity,
                                    @RequestParam(required = false) String search, @RequestParam(defaultValue = "1") int page,
                                    @RequestParam(defaultValue = "10") int limit, @RequestParam(required = false) String from,
                                    @RequestParam(required = false) String to, @RequestParam(defaultValue = "at") String sortBy,
                                    @RequestParam(defaultValue = "desc") String sortDirection, @RequestParam(required = false) String people,
                                    @RequestParam(required = false) String ids) {
        List<java.util.UUID> idList = new java.util.ArrayList<>();
        if (ids != null && !ids.isBlank()) {
            for (String id : ids.split(",")) {
                try {
                    idList.add(java.util.UUID.fromString(id.trim()));
                } catch (IllegalArgumentException e) {
                    throw ExportException.invalid("ALERT_ID", "Not an alert id: " + id);
                }
            }
        }
        return alerts.page(state, severity, search, instant(from, "from"), instant(to, "to"), sortBy, "asc".equalsIgnoreCase(sortDirection), page, limit, SearchClause.split(people), idList);
    }

    private static java.time.Instant instant(String value, String name) {
        if (value == null || value.isBlank()) return null;
        try {
            return java.time.Instant.parse(value.trim());
        } catch (java.time.format.DateTimeParseException e) {
            throw ExportException.invalid("ALERT_DATE", "The " + name + " date is not a valid instant");
        }
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
