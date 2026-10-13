package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.entity.UserAccount;
import com.eqms.service.AuditTrailService;
import com.eqms.service.BackupAgentClient;
import com.eqms.service.PermissionEvaluationService;
import com.eqms.service.SecurityChangeSignatureService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * The owner-changeable restore rules (SDS 14.1). Viewing needs backup.admin.restore_controls.view; changing one needs
 * backup.admin.restore_rules.manage and an electronic signature, recorded in the same transaction as the change.
 */
@RestController
@RequestMapping("/backup-restore/restore-rules")
public class BackupRestoreRulesController {

    static final String VIEW = "backup.admin.restore_controls.view";
    static final String VERIFICATION_VIEW = "backup.admin.verification.view";
    static final String DRILL_RULE = "RESTORE_DRILL_INTERVAL_DAYS";
    static final String MANAGE = "backup.admin.restore_rules.manage";
    static final String MEANING = "BACKUP_RESTORE_RULE_CHANGE";
    private static final Pattern CODE = Pattern.compile("^[A-Z_]{3,60}$");

    public record ChangeBody(Integer value, String reason, String signatureToken) {
    }

    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissions;
    private final BackupAgentClient agent;
    private final AuditTrailService audit;
    private final SecurityChangeSignatureService signatures;
    private final TransactionTemplate tx;

    public BackupRestoreRulesController(CurrentUserService currentUserService, PermissionEvaluationService permissions, BackupAgentClient agent,
                                        AuditTrailService audit, SecurityChangeSignatureService signatures, TransactionTemplate tx) {
        this.currentUserService = currentUserService;
        this.permissions = permissions;
        this.agent = agent;
        this.audit = audit;
        this.signatures = signatures;
        this.tx = tx;
    }

    /**
     * Everyone who may view the restore rules gets all of them. A person who may only view the verification and drills screen gets the
     * drill interval alone, the one rule that screen shows.
     */
    @GetMapping
    public ResponseEntity<JsonNode> list() {
        UserAccount actor = currentUserService.requireCurrentUser();
        boolean allRules = permissions.hasAnyPermission(actor, VIEW);
        if (!allRules && !permissions.hasAnyPermission(actor, VERIFICATION_VIEW)) {
            throw new AccessDeniedException("Permission " + VIEW + " required");
        }
        BackupAgentClient.Reply reply = agent.exchange(HttpMethod.GET, "/internal/restore-rules", null);
        if (allRules || !reply.ok() || !reply.body().isArray()) return reply(reply);
        ArrayNode drillOnly = JsonNodeFactory.instance.arrayNode();
        reply.body().forEach(rule -> {
            if (DRILL_RULE.equals(rule.path("code").asText())) drillOnly.add(rule);
        });
        return ResponseEntity.status(reply.status()).cacheControl(CacheControl.noStore()).body(drillOnly);
    }

    @PostMapping("/{code}")
    public ResponseEntity<JsonNode> change(@PathVariable String code, @RequestBody ChangeBody body) {
        UserAccount actor = currentUserService.requireCurrentUser();
        require(actor, MANAGE);
        if (code == null || !CODE.matcher(code).matches()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "RULE_NOT_FOUND");
        if (body == null || body.value() == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "RULE_VALUE_REQUIRED");
        String reason = body.reason() == null ? "" : body.reason().trim();
        if (reason.isEmpty() || reason.length() > 500) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "RULE_REASON_REQUIRED");
        String token = body.signatureToken();
        signatures.requireValidToken(actor, token);
        UUID ruleId = UUID.nameUUIDFromBytes(code.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        BackupAgentClient.Reply reply = tx.execute(status -> {
            var signature = signatures.record(actor, token, MEANING, "BACKUP_RESTORE_RULE", ruleId, code,
                    "Change of restore rule " + code + " to " + body.value(), null, null);
            String ref = signature == null ? "SIGNATURE_NOT_REQUIRED_BY_CONFIGURATION" : signature.getSignatureId();
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("value", body.value());
            out.put("by", actor.getUsername());
            out.put("reason", reason);
            out.put("signatureRef", ref);
            BackupAgentClient.Reply changed = agent.exchange(HttpMethod.POST, "/internal/restore-rules/" + code, out);
            if (!changed.ok()) status.setRollbackOnly();
            return changed;
        });
        if (reply.ok()) {
            audit.logAs(actor, "BACKUP_RESTORE_RULE", code, ruleId, "RESTORE_RULE_CHANGED", reply.body().path("previous").asText(null),
                    String.valueOf(body.value()), "Changed " + code + " with an electronic signature. Reason: " + reason);
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
