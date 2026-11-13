package com.eqms.backup.agent.api;

import com.eqms.backup.agent.alert.AlertRuleService;
import com.eqms.backup.agent.drill.DrPlanService;
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

import java.time.Instant;
import java.util.List;
import java.util.Map;

/** The Disaster Recovery Plan (SDS 15.2). The drill records were removed; the plan stays. The backend has checked the person and the permission. */
@RestController
@RequestMapping("/internal/dr")
public class InternalDrPlanController {

    public record TargetsRequest(double rpoHours, double rtoHours, String by, String reason, String signatureRef) {
    }

    public record KitVerificationRequest(String verifiedAt, String by, String note) {
    }

    public record AuthorityRequest(String value, String by, String reason, String signatureRef) {
    }

    public record DeclareRequest(String scenario, String reason, String by, String signatureRef) {
    }

    public record CloseRequest(String summary, String by, String signatureRef) {
    }

    private final DrPlanService plan;
    private final AlertRuleService rules;

    public InternalDrPlanController(DrPlanService plan, AlertRuleService rules) {
        this.plan = plan;
        this.rules = rules;
    }

    /** The targets next to what the records show now. */
    @GetMapping("/readiness")
    public List<Map<String, Object>> readiness() {
        return plan.readiness();
    }

    private static Instant instant(String value, String name) {
        if (value == null || value.isBlank()) return null;
        try {
            return Instant.parse(value.trim());
        } catch (java.time.format.DateTimeParseException e) {
            throw ExportException.invalid("DR_DATE", "The " + name + " date is not a valid instant");
        }
    }

    @GetMapping("/declarations")
    public Map<String, Object> declarations(@RequestParam(required = false) String search, @RequestParam(required = false) String status,
                                            @RequestParam(required = false) String scenario, @RequestParam(required = false) String from,
                                            @RequestParam(required = false) String to, @RequestParam(defaultValue = "declaredAt") String sortBy,
                                            @RequestParam(defaultValue = "desc") String sortDirection,
                                            @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit,
                                            @RequestParam(required = false) String people) {
        return plan.declarations(search, status, scenario, instant(from, "from"), instant(to, "to"), sortBy, "asc".equalsIgnoreCase(sortDirection), page, limit, SearchClause.split(people));
    }

    @PostMapping("/declarations")
    public Map<String, Object> declare(@RequestBody DeclareRequest r) {
        return plan.declare(r.scenario(), r.reason(), r.by(), r.signatureRef());
    }

    @PostMapping("/declarations/{code}/close")
    public Map<String, Object> close(@PathVariable String code, @RequestBody CloseRequest r) {
        return plan.closeDeclaration(code, r.summary(), r.by(), r.signatureRef());
    }

    @GetMapping("/scenarios")
    public List<Map<String, Object>> scenarios() {
        return plan.scenarios();
    }

    @PostMapping("/scenarios/{code}/targets")
    public Map<String, Object> changeTargets(@PathVariable String code, @RequestBody TargetsRequest r) {
        return plan.changeTargets(code, r.rpoHours(), r.rtoHours(), r.by(), r.reason(), r.signatureRef());
    }

    @GetMapping("/kit")
    public List<Map<String, Object>> kit() {
        return plan.kit(rules.threshold("DR_KIT_OVERDUE", 365));
    }

    @PostMapping("/kit/{code}/verify")
    public Map<String, Object> verifyKit(@PathVariable String code, @RequestBody KitVerificationRequest r) {
        Instant when;
        try {
            when = r.verifiedAt() == null ? null : Instant.parse(r.verifiedAt());
        } catch (java.time.format.DateTimeParseException e) {
            throw ExportException.invalid("VERIFIED_AT_INVALID", "The date of the check must be an instant such as 2026-10-13T02:00:00Z");
        }
        return plan.verifyKitItem(code, when, r.by(), r.note());
    }

    @GetMapping("/authority")
    public Map<String, Object> authority() {
        return Map.of("key", DrPlanService.AUTHORITY_KEY, "value", plan.declarationAuthority());
    }

    @PostMapping("/authority")
    public Map<String, Object> changeAuthority(@RequestBody AuthorityRequest r) {
        return plan.changeDeclarationAuthority(r.value(), r.by(), r.reason(), r.signatureRef());
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
