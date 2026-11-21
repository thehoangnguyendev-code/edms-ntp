package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.AuditTrailService;
import com.eqms.service.BackupAgentClient;
import com.eqms.service.ObjectNumberService;
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
    private static final Pattern RULE_CODE = Pattern.compile("^[A-Z0-9_]{3,80}$");

    public record AcknowledgeBody(String comment) {
    }

    public record RecipientBody(String username) {
    }

    public record RuleBody(boolean inApp, boolean email, Integer threshold, String reason) {
    }

    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissions;
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private ObjectNumberService numbers;
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
                                         @RequestParam(defaultValue = "10") int limit, @RequestParam(required = false) String from,
                                         @RequestParam(required = false) String to, @RequestParam(defaultValue = "at") String sortBy,
                                         @RequestParam(defaultValue = "desc") String sortDirection) {
        require(currentUserService.requireCurrentUser(), VIEW);
        UriComponentsBuilder uri = UriComponentsBuilder.fromPath("/internal/alerts")
                .queryParam("page", Math.max(page, 1)).queryParam("limit", Math.min(Math.max(limit, 1), 100));
        Map<String, Object> vars = new LinkedHashMap<>();
        for (String[] pair : new String[][] {{"from", from}, {"to", to}, {"sortBy", sortBy}, {"sortDirection", sortDirection}}) {
            if (pair[1] != null && !pair[1].isBlank()) {
                uri.queryParam(pair[0], "{" + pair[0] + "}");
                vars.put(pair[0], cut(pair[1], 40));
            }
        }
        if (state != null && !state.isBlank()) {
            uri.queryParam("state", "{state}");
            vars.put("state", cut(state, 20));
        }
        if (severity != null && !severity.isBlank()) {
            uri.queryParam("severity", "{severity}");
            vars.put("severity", cut(severity, 20));
        }
        // a search that is (part of) the number of an alert finds that alert: the numbers are kept here, the alerts in the Backup Agent
        java.util.List<String> byNumber = numbers == null || search == null ? java.util.List.of() : numbers.backupAlertIdsByNumber(search);
        if (!byNumber.isEmpty()) {
            uri.queryParam("ids", "{ids}");
            vars.put("ids", String.join(",", byNumber));
        } else if (search != null && !search.isBlank()) {
            uri.queryParam("search", "{search}");
            vars.put("search", cut(search, 200));
        }
        BackupAgentClient.Reply listed = agent.exchange(HttpMethod.GET, uri.buildAndExpand(vars).encode().toUriString(), null);
        if (listed.ok()) {
            numberTheAlerts(listed.body());
            labelTheAlerts(listed.body() == null ? null : listed.body().get("data"));
        }
        return reply(listed);
    }

    /** The agent raises an alert with a code and a sentence that may carry another code: each alert also carries the words of its code, and no code is left in the sentence. */
    static void labelTheAlerts(JsonNode data) {
        if (data == null || !data.isArray()) return;
        for (JsonNode alert : data) {
            if (!(alert instanceof com.fasterxml.jackson.databind.node.ObjectNode object)) continue;
            String code = object.path("code").asText(null);
            if (code != null) object.put("codeLabel", com.eqms.util.DisplayLabels.humanize(code));
            String severity = object.path("severity").asText(null);
            if (severity != null) object.put("severityLabel", com.eqms.util.DisplayLabels.humanize(severity));
            if (object.path("detail").isTextual()) object.put("detail", com.eqms.util.DisplayLabels.prose(object.path("detail").asText()));
            // a reference that is a machine word instead of a number (NEVER: no copy has ever been recorded) is shown as a word
            String ref = object.path("ref").asText(null);
            if (ref != null && com.eqms.util.DisplayLabels.isMachineValue(ref)) object.put("ref", com.eqms.util.DisplayLabels.humanize(ref));
        }
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
            audit.logAs(actor, "BACKUP_ALERT", numbers == null ? "Backup alert" : numbers.backupAlertNumber(id, ObjectNumberService.currentYear()), BackupAuditIds.of("alert", id), "ALERT_ACKNOWLEDGED", "OPEN", "ACKNOWLEDGED",
                    "Acknowledged a backup alert" + (comment.isEmpty() ? "" : ". Note: " + comment),
                com.eqms.util.AuditChanges.reason("Note", comment));
        }
        return reply(reply);
    }

    @GetMapping("/alert-rules")
    public ResponseEntity<JsonNode> rules() {
        require(currentUserService.requireCurrentUser(), VIEW);
        return reply(agent.exchange(HttpMethod.GET, "/internal/alert-rules", null));
    }

    @PostMapping("/alert-rules/{code}")
    public ResponseEntity<JsonNode> changeRule(@PathVariable String code, @RequestBody RuleBody body) {
        UserAccount actor = currentUserService.requireCurrentUser();
        require(actor, MANAGE);
        if (code == null || !RULE_CODE.matcher(code).matches()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "ALERT_RULE_NOT_FOUND");
        String reason = body == null || body.reason() == null ? "" : body.reason().trim();
        if (reason.isEmpty() || reason.length() > MAX_TEXT) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "ALERT_RULE_REASON_REQUIRED");
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("inApp", body.inApp());
        out.put("email", body.email());
        out.put("threshold", body.threshold());
        out.put("by", actor.getUsername());
        out.put("reason", reason);
        BackupAgentClient.Reply reply = agent.exchange(HttpMethod.POST, "/internal/alert-rules/" + code, out);
        if (reply.ok()) {
            JsonNode before = reply.body() == null ? null : reply.body().path("previous");
            String was = before == null || before.isMissingNode() ? "" : " (was: in the application " + (before.path("inApp").asBoolean() ? "on" : "off")
                    + ", e-mail " + (before.path("email").asBoolean() ? "on" : "off") + (before.path("threshold").isNull() ? "" : ", limit " + before.path("threshold").asText()) + ")";
            audit.logAs(actor, "BACKUP_ALERT_RULE", ruleName(code), BackupAuditIds.of("alert-rule", code), "ALERT_RULE_CHANGED", null, "CHANGED",
                    "Changed alert rule " + code + ": in the application " + (body.inApp() ? "on" : "off") + ", e-mail " + (body.email() ? "on" : "off")
                            + (body.threshold() == null ? "" : ", limit " + body.threshold()) + was + ". Reason: " + reason,
                com.eqms.util.AuditChanges.with("Reason", reason, com.eqms.util.AuditChanges.of("Rule",null,code), com.eqms.util.AuditChanges.of("In-App Notification",null,body.inApp() ? "On" : "Off"), com.eqms.util.AuditChanges.of("E-mail",null,body.email() ? "On" : "Off"), com.eqms.util.AuditChanges.of("Limit",null,body.threshold())));
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
                    "Added " + person.getUsername() + " to the people who receive backup alerts",
                java.util.List.of(com.eqms.util.AuditChanges.of("Recipient",null,person.getUsername())));
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
                    "Removed " + target + " from the people who receive backup alerts",
                java.util.List.of(com.eqms.util.AuditChanges.of("Recipient",target,null)));
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

    /** Gives each alert of the page its number (the oldest first, so the numbers follow the order the alerts were raised) and puts it in the answer. */
    private void numberTheAlerts(JsonNode body) {
        if (numbers == null || body == null || !body.path("data").isArray()) return;
        java.util.List<com.fasterxml.jackson.databind.node.ObjectNode> alerts = new java.util.ArrayList<>();
        for (JsonNode alert : body.path("data")) if (alert instanceof com.fasterxml.jackson.databind.node.ObjectNode node && node.hasNonNull("id")) alerts.add(node);
        alerts.sort(java.util.Comparator.comparing(a -> a.path("at").asText("")));
        for (com.fasterxml.jackson.databind.node.ObjectNode alert : alerts) {
            int year = ObjectNumberService.currentYear();
            try {
                year = java.time.OffsetDateTime.parse(alert.path("at").asText()).atZoneSameInstant(com.eqms.util.DateTimeFormatUtils.ZONE).getYear();
            } catch (RuntimeException ignored) {
                // an alert with no readable time is numbered in the current year
            }
            alert.put("alertNumber", numbers.backupAlertNumber(alert.path("id").asText(), year));
        }
    }

    /** The name of an alert rule as a person reads it ("Capacity High"), not its code (CAPACITY_HIGH). */
    static String ruleName(String code) {
        StringBuilder out = new StringBuilder();
        for (String word : (code == null ? "" : code).toLowerCase(java.util.Locale.ROOT).split("[_\\s]+")) {
            if (word.isEmpty()) continue;
            if (out.length() > 0) out.append(' ');
            out.append(Character.toUpperCase(word.charAt(0))).append(word.substring(1));
        }
        return out.toString();
    }

    private static ResponseEntity<JsonNode> reply(BackupAgentClient.Reply reply) {
        return ResponseEntity.status(reply.status()).cacheControl(CacheControl.noStore()).body(reply.body());
    }
}
