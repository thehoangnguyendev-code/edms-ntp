package com.eqms.backup.agent.api;

import com.eqms.backup.agent.drill.DrDrillService;
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

/** Disaster recovery drills and the Disaster Recovery Plan (SDS 15.2). The backend has checked the person and the permission. */
@RestController
@RequestMapping("/internal/dr")
public class InternalDrDrillController {

    public record DrillRequest(String scenario, String performedAt, String lead, double achievedRtoHours, String result, String findings, String by) {
    }

    public record TargetsRequest(double rpoHours, double rtoHours, String by, String reason, String signatureRef) {
    }

    public record KitVerificationRequest(String verifiedAt, String by, String note) {
    }

    public record AuthorityRequest(String value, String by, String reason, String signatureRef) {
    }

    private final DrDrillService drills;
    private final DrPlanService plan;

    public InternalDrDrillController(DrDrillService drills, DrPlanService plan) {
        this.drills = drills;
        this.plan = plan;
    }

    @GetMapping("/scenarios")
    public List<Map<String, Object>> scenarios() {
        return drills.scenarios();
    }

    @PostMapping("/scenarios/{code}/targets")
    public Map<String, Object> changeTargets(@PathVariable String code, @RequestBody TargetsRequest r) {
        return plan.changeTargets(code, r.rpoHours(), r.rtoHours(), r.by(), r.reason(), r.signatureRef());
    }

    @GetMapping("/kit")
    public List<Map<String, Object>> kit() {
        return plan.kit();
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

    @GetMapping("/drills")
    public Map<String, Object> list(@RequestParam(required = false) String search, @RequestParam(required = false) String scenario,
                                    @RequestParam(required = false) String result,
                                    @RequestParam(defaultValue = "performedAt") String sortBy, @RequestParam(defaultValue = "desc") String sortDirection,
                                    @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit) {
        return drills.page(search, scenario, result, sortBy, "asc".equalsIgnoreCase(sortDirection), page, limit);
    }

    @PostMapping("/drills")
    public ResponseEntity<Map<String, Object>> record(@RequestBody DrillRequest r) {
        Instant when;
        try {
            when = r.performedAt() == null ? null : Instant.parse(r.performedAt());
        } catch (java.time.format.DateTimeParseException e) {
            throw ExportException.invalid("DRILL_DATE_INVALID", "The date of the drill must be an instant such as 2026-10-13T02:00:00Z");
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(drills.record(r.scenario(), when, r.lead(), r.achievedRtoHours(), r.result(), r.findings(), r.by()));
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
