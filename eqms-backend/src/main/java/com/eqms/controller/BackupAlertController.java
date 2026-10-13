package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.UserAccountRepository;
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
import java.util.regex.Pattern;

/**
 * Backup alerts (SDS 15.1): the list of alerts, acknowledging one, and the people who receive them. Viewing needs
 * backup.admin.alerts.view; acknowledging and managing recipients need backup.admin.alerts.manage.
 */
@RestController
@RequestMapping("/backup-restore")
public class BackupAlertController {

    static final String VIEW = "backup.admin.alerts.view";
    static final String MANAGE = "backup.admin.alerts.manage";
    private static final Pattern ALERT_ID = Pattern.compile("^[0-9a-fA-F-]{36}$");
    private static final int MAX_TEXT = 500;

    public record AcknowledgeBody(String comment) {
    }

    public record RecipientBody(String username) {
    }

    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissions;
    private final BackupAgentClient agent;
    private final AuditTrailService audit;
    private final UserAccountRepository users;

    public BackupAlertController(CurrentUserService currentUserService, PermissionEvaluationService permissions, BackupAgentClient agent,
                                 AuditTrailService audit, UserAccountRepository users) {
        this.currentUserService = currentUserService;
        this.permissions = permissions;
        this.agent = agent;
        this.audit = audit;
        this.users = users;
    }

    @GetMapping("/alerts")
    public ResponseEntity<JsonNode> list(@RequestParam(required = false) String state, @RequestParam(required = false) String severity,
                                         @RequestParam(required = false) String search, @RequestParam(defaultValue = "1") int page,
                                         @RequestParam(defaultValue = "10") int limit) {
        require(currentUserService.requireCurrentUser(), VIEW);
        UriComponentsBuilder uri = UriComponentsBuilder.fromPath("/internal/alerts")
                .queryParam("page", Math.max(page, 1)).queryParam("limit", Math.min(Math.max(limit, 1), 100));
        Map<String, Object> vars = new LinkedHashMap<>();
        if (state != null && !state.isBlank()) {
            uri.queryParam("state", "{state}");
            vars.put("state", cut(state, 20));
        }
        if (severity != null && !severity.isBlank()) {
            uri.queryParam("severity", "{severity}");
            vars.put("severity", cut(severity, 20));
        }
        if (search != null && !search.isBlank()) {
            uri.queryParam("search", "{search}");
            vars.put("search", cut(search, 200));
        }
        return reply(agent.exchange(HttpMethod.GET, uri.buildAndExpand(vars).encode().toUriString(), null));
    }

    @PostMapping("/alerts/{alertId}/acknowledge")
    public ResponseEntity<JsonNode> acknowledge(@PathVariable String alertId, @RequestBody(required = false) AcknowledgeBody body) {
        UserAccount actor = currentUserService.requireCurrentUser();
        require(actor, MANAGE);
        String id = validAlertId(alertId);
        String comment = body == null || body.comment() == null ? "" : body.comment().trim();
        if (comment.length() > MAX_TEXT) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "ALERT_COMMENT_TOO_LONG");
        BackupAgentClient.Reply reply = agent.exchange(HttpMethod.POST, "/internal/alerts/" + id + "/acknowledge",
                Map.of("by", actor.getUsername(), "comment", comment));
        if (reply.ok()) {
            audit.logAs(actor, "BACKUP_ALERT", id, BackupAuditIds.of("alert", id), "ALERT_ACKNOWLEDGED", "OPEN", "ACKNOWLEDGED",
                    "Acknowledged backup alert " + id + (comment.isEmpty() ? "" : ". Note: " + comment));
        }
        return reply(reply);
    }

    @GetMapping("/alert-recipients")
    public ResponseEntity<JsonNode> recipients() {
        require(currentUserService.requireCurrentUser(), VIEW);
        return reply(agent.exchange(HttpMethod.GET, "/internal/alert-recipients", null));
    }

    @PostMapping("/alert-recipients")
    public ResponseEntity<JsonNode> addRecipient(@RequestBody RecipientBody body) {
        UserAccount actor = currentUserService.requireCurrentUser();
        require(actor, MANAGE);
        String username = body == null || body.username() == null ? "" : body.username().trim();
        if (username.isEmpty() || username.length() > 120) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "RECIPIENT_REQUIRED");
        UserAccount person = users.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "RECIPIENT_NOT_FOUND"));
        if (person.getStatus() != UserStatus.Active) throw new ResponseStatusException(HttpStatus.CONFLICT, "RECIPIENT_NOT_ACTIVE");
        BackupAgentClient.Reply reply = agent.exchange(HttpMethod.POST, "/internal/alert-recipients",
                Map.of("by", actor.getUsername(), "username", person.getUsername()));
        if (reply.ok()) {
            audit.logAs(actor, "BACKUP_ALERT_RECIPIENT", person.getUsername(), BackupAuditIds.of("recipient", person.getUsername()), "ALERT_RECIPIENT_ADDED", null, "ACTIVE",
                    "Added " + person.getUsername() + " to the people who receive backup alerts");
        }
        return reply(reply);
    }

    @PostMapping("/alert-recipients/{username}/remove")
    public ResponseEntity<JsonNode> removeRecipient(@PathVariable String username) {
        UserAccount actor = currentUserService.requireCurrentUser();
        require(actor, MANAGE);
        String target = cut(username == null ? "" : username.trim(), 120);
        if (target.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "ALERT_RECIPIENT_NOT_FOUND");
        BackupAgentClient.Reply reply = agent.exchange(HttpMethod.POST, "/internal/alert-recipients/" + target + "/remove",
                Map.of("by", actor.getUsername()));
        if (reply.ok()) {
            audit.logAs(actor, "BACKUP_ALERT_RECIPIENT", target, BackupAuditIds.of("recipient", target), "ALERT_RECIPIENT_REMOVED", "ACTIVE", "REMOVED",
                    "Removed " + target + " from the people who receive backup alerts");
        }
        return reply(reply);
    }

    private void require(UserAccount actor, String permission) {
        if (!permissions.hasAnyPermission(actor, permission)) {
            throw new AccessDeniedException("Permission " + permission + " required");
        }
    }

    private static String validAlertId(String id) {
        if (id == null || !ALERT_ID.matcher(id).matches()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "ALERT_NOT_FOUND");
        return id;
    }

    private static String cut(String value, int max) {
        return value.length() > max ? value.substring(0, max) : value;
    }

    private static ResponseEntity<JsonNode> reply(BackupAgentClient.Reply reply) {
        return ResponseEntity.status(reply.status()).cacheControl(CacheControl.noStore()).body(reply.body());
    }
}
