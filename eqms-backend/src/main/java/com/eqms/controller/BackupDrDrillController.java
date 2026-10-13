package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.entity.UserAccount;
import com.eqms.service.AuditTrailService;
import com.eqms.service.BackupAgentClient;
import com.eqms.service.PermissionEvaluationService;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.LinkedHashMap;
import java.util.Map;

/** Disaster recovery drills (SDS 15.2). Viewing needs backup.admin.disaster_recovery.view; recording needs ...manage. */
@RestController
@RequestMapping("/backup-restore/dr")
public class BackupDrDrillController {

    static final String VIEW = "backup.admin.disaster_recovery.view";
    static final String MANAGE = "backup.admin.disaster_recovery.manage";

    public record DrillBody(String scenario, String performedAt, String lead, Double achievedRtoHours, String result, String findings) {
    }

    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissions;
    private final BackupAgentClient agent;
    private final AuditTrailService audit;

    public BackupDrDrillController(CurrentUserService currentUserService, PermissionEvaluationService permissions, BackupAgentClient agent, AuditTrailService audit) {
        this.currentUserService = currentUserService;
        this.permissions = permissions;
        this.agent = agent;
        this.audit = audit;
    }

    @GetMapping("/scenarios")
    public ResponseEntity<JsonNode> scenarios() {
        require(currentUserService.requireCurrentUser(), VIEW);
        return reply(agent.exchange(HttpMethod.GET, "/internal/dr/scenarios", null));
    }

    @GetMapping("/drills")
    public ResponseEntity<JsonNode> list(@RequestParam(required = false) String search, @RequestParam(required = false) String scenario,
                                         @RequestParam(required = false) String result,
                                         @RequestParam(defaultValue = "performedAt") String sortBy, @RequestParam(defaultValue = "desc") String sortDirection,
                                         @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit) {
        require(currentUserService.requireCurrentUser(), VIEW);
        UriComponentsBuilder uri = UriComponentsBuilder.fromPath("/internal/dr/drills");
        Map<String, Object> vars = new LinkedHashMap<>();
        if (search != null && !search.isBlank()) {
            uri.queryParam("search", "{search}");
            vars.put("search", cut(search, 200));
        }
        if (scenario != null && !scenario.isBlank()) {
            uri.queryParam("scenario", "{scenario}");
            vars.put("scenario", cut(scenario, 40));
        }
        if (result != null && !result.isBlank()) {
            uri.queryParam("result", "{result}");
            vars.put("result", cut(result, 40));
        }
        uri.queryParam("sortBy", "{sortBy}").queryParam("sortDirection", "{dir}")
                .queryParam("page", Math.max(page, 1)).queryParam("limit", Math.min(Math.max(limit, 1), 100));
        vars.put("sortBy", cut(sortBy, 30));
        vars.put("dir", "asc".equalsIgnoreCase(sortDirection) ? "asc" : "desc");
        return reply(agent.exchange(HttpMethod.GET, uri.buildAndExpand(vars).encode().toUriString(), null));
    }

    @PostMapping("/drills")
    public ResponseEntity<JsonNode> record(@RequestBody DrillBody body) {
        UserAccount actor = currentUserService.requireCurrentUser();
        require(actor, MANAGE);
        if (body == null || body.scenario() == null || body.scenario().isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "DRILL_SCENARIO_UNKNOWN");
        if (body.achievedRtoHours() == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "DRILL_TIME_INVALID");
        if (body.result() == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "DRILL_RESULT_UNKNOWN");
        String findings = body.findings() == null ? null : cut(body.findings().trim(), 4000);
        Map<String, Object> out = new java.util.LinkedHashMap<>();
        out.put("scenario", body.scenario());
        out.put("performedAt", body.performedAt());
        out.put("lead", body.lead());
        out.put("achievedRtoHours", body.achievedRtoHours());
        out.put("result", body.result());
        out.put("findings", findings);
        out.put("by", actor.getUsername());
        BackupAgentClient.Reply reply = agent.exchange(HttpMethod.POST, "/internal/dr/drills", out);
        if (reply.ok()) {
            audit.logAs(actor, "DR_DRILL", reply.body().path("drillCode").asText(), BackupAuditIds.of("dr-drill", reply.body().path("drillCode").asText()), "DR_DRILL_RECORDED", null, body.result(),
                    "Recorded disaster recovery drill " + reply.body().path("drillCode").asText() + " (" + body.scenario() + ", " + body.result() + ")");
        }
        return reply(reply);
    }

    private void require(UserAccount actor, String permission) {
        if (!permissions.hasAnyPermission(actor, permission)) {
            throw new AccessDeniedException("Permission " + permission + " required");
        }
    }

    private static String cut(String value, int max) {
        return value.length() > max ? value.substring(0, max) : value;
    }

    private static ResponseEntity<JsonNode> reply(BackupAgentClient.Reply reply) {
        return ResponseEntity.status(reply.status()).cacheControl(CacheControl.noStore()).body(reply.body());
    }
}
