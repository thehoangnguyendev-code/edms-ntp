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
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Restore rehearsals (SDS 14.1, V2/V3). Asking is audited with the person and the reason; the restore itself is done by the restore
 * worker, the only part of the system that holds the private key, and nothing here returns backup content.
 */
@RestController
@RequestMapping("/backup-restore")
public class BackupRehearsalController {

    static final String VIEW = "backup.module.view";
    static final String REQUEST = "backup.restore.test";
    private static final Pattern BACKUP_ID = Pattern.compile("^BK-\\d{8}-\\d{4}-\\d{4}$");
    private static final Pattern REHEARSAL_ID = Pattern.compile("^RH-\\d{8}-\\d{4}$");
    private static final int MAX_REASON = 500;

    public record RehearsalRequest(String reason) {
    }

    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissionEvaluationService;
    private final BackupAgentClient agent;
    private final AuditTrailService audit;

    public BackupRehearsalController(CurrentUserService currentUserService, PermissionEvaluationService permissionEvaluationService,
                                     BackupAgentClient agent, AuditTrailService audit) {
        this.currentUserService = currentUserService;
        this.permissionEvaluationService = permissionEvaluationService;
        this.agent = agent;
        this.audit = audit;
    }

    @GetMapping("/rehearsals")
    public ResponseEntity<JsonNode> list(@RequestParam(required = false) String search, @RequestParam(required = false) String status,
                                         @RequestParam(required = false) String backupNumber,
                                         @RequestParam(defaultValue = "requestedAt") String sortBy, @RequestParam(defaultValue = "desc") String sortDirection,
                                         @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit) {
        require(currentUserService.requireCurrentUser(), VIEW);
        UriComponentsBuilder uri = UriComponentsBuilder.fromPath("/internal/rehearsals");
        Map<String, Object> vars = new LinkedHashMap<>();
        if (search != null && !search.isBlank()) {
            uri.queryParam("search", "{search}");
            vars.put("search", cut(search, 200));
        }
        if (status != null && !status.isBlank()) {
            uri.queryParam("status", "{status}");
            vars.put("status", cut(status, 20));
        }
        if (backupNumber != null && !backupNumber.isBlank()) {
            uri.queryParam("backupNumber", "{backupNumber}");
            vars.put("backupNumber", validBackupId(backupNumber));
        }
        uri.queryParam("sortBy", "{sortBy}").queryParam("sortDirection", "{dir}")
                .queryParam("page", Math.max(page, 1)).queryParam("limit", Math.min(Math.max(limit, 1), 100));
        vars.put("sortBy", cut(sortBy, 30));
        vars.put("dir", "asc".equalsIgnoreCase(sortDirection) ? "asc" : "desc");
        return reply(agent.exchange(HttpMethod.GET, uri.buildAndExpand(vars).encode().toUriString(), null));
    }

    @GetMapping("/rehearsals/{rehearsalId}")
    public ResponseEntity<JsonNode> get(@PathVariable String rehearsalId) {
        require(currentUserService.requireCurrentUser(), VIEW);
        return reply(agent.exchange(HttpMethod.GET, "/internal/rehearsals/" + validRehearsalId(rehearsalId), null));
    }

    @PostMapping("/backups/{backupNumber}/rehearsals")
    public ResponseEntity<JsonNode> request(@PathVariable String backupNumber, @RequestBody RehearsalRequest request) {
        UserAccount actor = currentUserService.requireCurrentUser();
        require(actor, REQUEST);
        String id = validBackupId(backupNumber);
        String reason = request == null || request.reason() == null ? "" : request.reason().trim();
        if (reason.isEmpty() || reason.length() > MAX_REASON) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "REHEARSAL_REASON_REQUIRED");
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("by", actor.getUsername());
        body.put("reason", reason);
        BackupAgentClient.Reply reply = agent.exchange(HttpMethod.POST, "/internal/backups/" + id + "/rehearsals", body);
        if (reply.ok()) {
            audit.logAs(actor, "BACKUP", id, uuid(reply.body().path("id").asText()), "RESTORE_REHEARSAL_REQUESTED", null, "QUEUED",
                    "Asked for a test restore of " + id + " as " + reply.body().path("rehearsalId").asText() + ". Reason: " + reason);
        }
        return reply(reply);
    }

    private void require(UserAccount actor, String permission) {
        if (!permissionEvaluationService.hasAnyPermission(actor, permission)) {
            throw new AccessDeniedException("Permission " + permission + " required");
        }
    }

    private static String validBackupId(String id) {
        if (id == null || !BACKUP_ID.matcher(id).matches()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "BACKUP_NOT_FOUND");
        return id;
    }

    private static String validRehearsalId(String id) {
        if (id == null || !REHEARSAL_ID.matcher(id).matches()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "REHEARSAL_NOT_FOUND");
        return id;
    }

    private static String cut(String value, int max) {
        return value.length() > max ? value.substring(0, max) : value;
    }

    private static UUID uuid(String text) {
        try {
            return UUID.fromString(text);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private static ResponseEntity<JsonNode> reply(BackupAgentClient.Reply reply) {
        return ResponseEntity.status(reply.status()).cacheControl(CacheControl.noStore()).body(reply.body());
    }
}
