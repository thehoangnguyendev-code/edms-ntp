package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.entity.UserAccount;
import com.eqms.service.AuditTrailService;
import com.eqms.service.BackupAgentClient;
import com.eqms.service.PermissionEvaluationService;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.util.Map;
import java.util.regex.Pattern;

/**
 * The periodic check of the live file store. The list and the newest result are seen with backup.module.view; starting one now needs
 * backup.backup.verify, like any other integrity check. The weekly one is started by the Backup Agent itself.
 */
@RestController
@RequestMapping("/backup-restore/store-scrubs")
public class BackupStoreScrubController {

    static final String VIEW = "backup.module.view";
    static final String START = "backup.backup.verify";
    private static final Pattern ID = Pattern.compile("^[0-9a-fA-F-]{36}$");

    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissions;
    private final BackupAgentClient agent;
    private final AuditTrailService audit;

    public BackupStoreScrubController(CurrentUserService currentUserService, PermissionEvaluationService permissions, BackupAgentClient agent, AuditTrailService audit) {
        this.currentUserService = currentUserService;
        this.permissions = permissions;
        this.agent = agent;
        this.audit = audit;
    }

    @GetMapping
    public ResponseEntity<JsonNode> list(@RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit) {
        require(currentUserService.requireCurrentUser(), VIEW);
        return reply(agent.exchange(HttpMethod.GET, "/internal/store-scrubs?page=" + Math.max(page, 1) + "&limit=" + Math.min(Math.max(limit, 1), 100), null));
    }

    @GetMapping("/{id}")
    public ResponseEntity<JsonNode> detail(@PathVariable String id) {
        require(currentUserService.requireCurrentUser(), VIEW);
        if (id == null || !ID.matcher(id).matches()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "SCRUB_NOT_FOUND");
        return reply(agent.exchange(HttpMethod.GET, "/internal/store-scrubs/" + id, null));
    }

    @PostMapping
    public ResponseEntity<JsonNode> start() {
        UserAccount actor = currentUserService.requireCurrentUser();
        require(actor, START);
        BackupAgentClient.Reply reply = agent.exchange(HttpMethod.POST, "/internal/store-scrubs", Map.of("by", actor.getUsername()));
        if (reply.ok()) {
            String job = reply.body().path("jobId").asText("");
            audit.logAs(actor, "BACKUP_STORE_SCRUB", job, BackupAuditIds.of("store-scrub", job), "STORE_SCRUB_STARTED", null, "QUEUED",
                    "Started a check of the live file store");
        }
        return reply(reply);
    }

    private void require(UserAccount actor, String permission) {
        if (!permissions.hasAnyPermission(actor, permission)) {
            throw new AccessDeniedException("Permission " + permission + " required");
        }
    }

    private static ResponseEntity<JsonNode> reply(BackupAgentClient.Reply reply) {
        return ResponseEntity.status(reply.status()).cacheControl(CacheControl.noStore()).body(reply.body());
    }
}
