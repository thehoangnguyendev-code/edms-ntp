package com.eqms.backup.agent.api;

import com.eqms.backup.agent.policy.PolicyService;
import com.fasterxml.jackson.databind.JsonNode;
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
import java.util.List;
import java.util.Map;

/**
 * Backup policy versions (SDS 6.1 and 24). The eQMS backend has already checked who the person is, what they may do and their
 * electronic signature; the agent enforces what only it can: the two-person rule, the 3-2-1-1 gate and the target tests.
 */
@RestController
@RequestMapping("/internal/policies")
public class InternalPolicyController {

    public record ProposeRequest(JsonNode scope, JsonNode schedule, JsonNode retention, JsonNode targets, String reason, String proposedBy) {
    }

    public record ActivateRequest(String approvedBy, String signatureRef) {
    }

    public record DiscardRequest(String discardedBy, String reason) {
    }

    private final PolicyService policies;

    public InternalPolicyController(PolicyService policies) {
        this.policies = policies;
    }

    @GetMapping
    public Map<String, Object> list(@RequestParam(required = false) String search, @RequestParam(required = false) String status,
                                    @RequestParam(defaultValue = "version") String sortBy, @RequestParam(defaultValue = "desc") String sortDirection,
                                    @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit) {
        PolicyService.Page result = policies.page(search, status, sortBy, "asc".equalsIgnoreCase(sortDirection), page, limit);
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

    @GetMapping("/{version}")
    public Map<String, Object> get(@PathVariable int version) {
        return policies.get(version);
    }

    @GetMapping("/{version}/gate")
    public Map<String, Object> gate(@PathVariable int version) {
        PolicyService.Gate gate = policies.preview(version);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("passed", gate.passed());
        out.put("enforced", gate.enforced());
        out.put("conditions", gate.conditions());
        return out;
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> propose(@RequestBody ProposeRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(policies.propose(new PolicyService.Proposal(request.scope(), request.schedule(), request.retention(), request.targets(), request.reason(), request.proposedBy())));
    }

    @PostMapping("/{version}/activate")
    public Map<String, Object> activate(@PathVariable int version, @RequestBody ActivateRequest request) {
        return policies.activate(version, request.approvedBy(), request.signatureRef());
    }

    @PostMapping("/{version}/discard")
    public Map<String, Object> discard(@PathVariable int version, @RequestBody DiscardRequest request) {
        return policies.discard(version, request.discardedBy(), request.reason());
    }

    @ExceptionHandler(PolicyService.PolicyException.class)
    public ResponseEntity<Map<String, Object>> refused(PolicyService.PolicyException e) {
        HttpStatus status = switch (e.kind) {
            case NOT_FOUND -> HttpStatus.NOT_FOUND;
            case CONFLICT, SEPARATION -> HttpStatus.CONFLICT;
            case GATE -> HttpStatus.UNPROCESSABLE_ENTITY;
            case INVALID -> HttpStatus.BAD_REQUEST;
        };
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("code", e.code);
        body.put("message", e.getMessage());
        if (e.detail != null) body.put("detail", e.detail);
        return ResponseEntity.status(status).body(body);
    }
}
