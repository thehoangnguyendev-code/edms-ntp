package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.entity.UserAccount;
import com.eqms.service.BackupAgentClient;
import com.eqms.service.BackupPolicyService;
import com.eqms.service.PermissionEvaluationService;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Backup policy versions and the places backups are copied to (System Administration > Backup Policy). Viewing, proposing and
 * approving are three permissions; approving also needs an electronic signature. The answer of the Backup Agent, including its
 * reasons for a refusal, is passed on as it is.
 */
@RestController
@RequestMapping("/backup-restore")
public class BackupPolicyController {

    static final String VIEW_PERMISSION = "backup.admin.policy.view";
    static final String STORAGE_VIEW_PERMISSION = "backup.admin.storage.view";
    static final String STORAGE_TEST_PERMISSION = "backup.admin.storage.test";
    static final String PROPOSE_PERMISSION = "backup.admin.policy.propose";
    static final String APPROVE_PERMISSION = "backup.admin.policy.approve";
    private static final int MAX_REASON = 500;

    public record ProposeRequest(JsonNode scope, JsonNode schedule, JsonNode retention, JsonNode targets, String reason) {
    }

    public record ActivateRequest(String signatureToken) {
    }

    public record DiscardRequest(String reason) {
    }

    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissionEvaluationService;
    private final BackupAgentClient agent;
    private final BackupPolicyService policies;

    public BackupPolicyController(CurrentUserService currentUserService, PermissionEvaluationService permissionEvaluationService,
                                  BackupAgentClient agent, BackupPolicyService policies) {
        this.currentUserService = currentUserService;
        this.permissionEvaluationService = permissionEvaluationService;
        this.agent = agent;
        this.policies = policies;
    }

    @GetMapping("/targets")
    public ResponseEntity<JsonNode> targets() {
        require(currentUserService.requireCurrentUser(), VIEW_PERMISSION, STORAGE_VIEW_PERMISSION);
        return reply(agent.exchange(HttpMethod.GET, "/internal/targets", null));
    }

    @GetMapping("/encryption")
    public ResponseEntity<JsonNode> encryption() {
        require(currentUserService.requireCurrentUser(), STORAGE_VIEW_PERMISSION);
        return reply(agent.exchange(HttpMethod.GET, "/internal/encryption", null));
    }

    @PostMapping("/targets/{code}/test")
    public ResponseEntity<JsonNode> testTarget(@PathVariable String code) {
        UserAccount actor = currentUserService.requireCurrentUser();
        require(actor, STORAGE_TEST_PERMISSION);
        if (code == null || !code.matches("^T[1-9]$")) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "TARGET_NOT_FOUND");
        BackupAgentClient.Reply reply = agent.exchange(HttpMethod.POST, "/internal/targets/" + code + "/test", Map.of("requestedBy", actor.getUsername()));
        if (reply.status() != 404) {
            policies.recordTargetTest(actor, code, reply.body().path("ok").asBoolean(false));
        }
        return reply(reply);
    }

    @GetMapping("/policies")
    public ResponseEntity<JsonNode> list(@RequestParam(required = false) String search, @RequestParam(required = false) String status,
                                         @RequestParam(defaultValue = "version") String sortBy, @RequestParam(defaultValue = "desc") String sortDirection,
                                         @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit) {
        require(currentUserService.requireCurrentUser(), VIEW_PERMISSION);
        org.springframework.web.util.UriComponentsBuilder uri = org.springframework.web.util.UriComponentsBuilder.fromPath("/internal/policies");
        if (search != null && !search.isBlank()) uri.queryParam("search", "{search}");
        if (status != null && !status.isBlank()) uri.queryParam("status", "{status}");
        uri.queryParam("sortBy", "{sortBy}").queryParam("sortDirection", "{dir}").queryParam("page", Math.max(page, 1)).queryParam("limit", Math.min(Math.max(limit, 1), 100));
        String path = uri.buildAndExpand(Map.of("search", search == null ? "" : cut(search, 200), "status", status == null ? "" : cut(status, 20),
                "sortBy", cut(sortBy, 30), "dir", "asc".equalsIgnoreCase(sortDirection) ? "asc" : "desc")).encode().toUriString();
        return reply(agent.exchange(HttpMethod.GET, path, null));
    }

    private static String cut(String value, int max) {
        return value.length() > max ? value.substring(0, max) : value;
    }

    @GetMapping("/policies/{version}")
    public ResponseEntity<JsonNode> get(@PathVariable int version) {
        require(currentUserService.requireCurrentUser(), VIEW_PERMISSION);
        return reply(agent.exchange(HttpMethod.GET, "/internal/policies/" + validVersion(version), null));
    }

    @GetMapping("/policies/{version}/gate")
    public ResponseEntity<JsonNode> gate(@PathVariable int version) {
        require(currentUserService.requireCurrentUser(), VIEW_PERMISSION);
        return reply(agent.exchange(HttpMethod.GET, "/internal/policies/" + validVersion(version) + "/gate", null));
    }

    @PostMapping("/policies")
    public ResponseEntity<JsonNode> propose(@RequestBody ProposeRequest request) {
        UserAccount actor = currentUserService.requireCurrentUser();
        require(actor, PROPOSE_PERMISSION);
        String reason = reason(request.reason());
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("scope", request.scope());
        body.put("schedule", request.schedule());
        body.put("retention", request.retention());
        body.put("targets", request.targets());
        return reply(policies.propose(actor, body, reason));
    }

    @PostMapping("/policies/{version}/activate")
    public ResponseEntity<JsonNode> activate(@PathVariable int version, @RequestBody ActivateRequest request) {
        UserAccount actor = currentUserService.requireCurrentUser();
        require(actor, APPROVE_PERMISSION);
        return reply(policies.activate(actor, validVersion(version), request == null ? null : request.signatureToken()));
    }

    @PostMapping("/policies/{version}/discard")
    public ResponseEntity<JsonNode> discard(@PathVariable int version, @RequestBody DiscardRequest request) {
        UserAccount actor = currentUserService.requireCurrentUser();
        require(actor, PROPOSE_PERMISSION);
        return reply(policies.discard(actor, validVersion(version), reason(request == null ? null : request.reason())));
    }

    private void require(UserAccount actor, String... permissions) {
        if (!permissionEvaluationService.hasAnyPermission(actor, permissions)) {
            throw new AccessDeniedException("Permission " + permissions[0] + " required");
        }
    }

    private static int validVersion(int version) {
        if (version < 1) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "POLICY_NOT_FOUND");
        return version;
    }

    private static String reason(String text) {
        String reason = text == null ? "" : text.trim();
        if (reason.isEmpty() || reason.length() > MAX_REASON) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "POLICY_REASON_REQUIRED");
        return reason;
    }

    private static ResponseEntity<JsonNode> reply(BackupAgentClient.Reply reply) {
        return ResponseEntity.status(reply.status()).cacheControl(CacheControl.noStore()).body(reply.body());
    }
}
