package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.entity.ElectronicSignature;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.AuditTrailService;
import com.eqms.service.BackupAgentClient;
import com.eqms.service.PermissionEvaluationService;
import com.eqms.service.SecurityChangeSignatureService;
import com.fasterxml.jackson.databind.JsonNode;
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

import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * The Disaster Recovery Plan (SDS 15.2). Viewing needs backup.admin.disaster_recovery.view. Changing a recovery target and changing
 * who may declare a disaster need backup.admin.disaster_recovery.manage and an electronic signature, recorded in the same transaction.
 * Verifying a rebuild-kit item needs the manage permission only: it records what a person checked.
 */
@RestController
@RequestMapping("/backup-restore/dr")
public class BackupDrPlanController {

    static final String VIEW = BackupDrDrillController.VIEW;
    static final String MANAGE = BackupDrDrillController.MANAGE;
    static final String TARGET_MEANING = "BACKUP_DR_TARGET_CHANGE";
    static final String AUTHORITY_MEANING = "BACKUP_DR_AUTHORITY_CHANGE";
    private static final Pattern CODE = Pattern.compile("^[A-Z_]{3,40}$");

    public record TargetBody(double rpoHours, double rtoHours, String reason, String signatureToken) {
    }

    public record VerifyBody(String verifiedAt, String note) {
    }

    public record AuthorityBody(String value, String reason, String signatureToken) {
    }

    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissions;
    private final BackupAgentClient agent;
    private final AuditTrailService audit;
    private final SecurityChangeSignatureService signatures;
    private final TransactionTemplate tx;
    private final UserAccountRepository users;

    public BackupDrPlanController(CurrentUserService currentUserService, PermissionEvaluationService permissions, BackupAgentClient agent,
                                  AuditTrailService audit, SecurityChangeSignatureService signatures, TransactionTemplate tx, UserAccountRepository users) {
        this.currentUserService = currentUserService;
        this.permissions = permissions;
        this.agent = agent;
        this.audit = audit;
        this.signatures = signatures;
        this.tx = tx;
        this.users = users;
    }

    @PostMapping("/scenarios/{code}/targets")
    public ResponseEntity<JsonNode> changeTargets(@PathVariable String code, @RequestBody TargetBody body) {
        UserAccount actor = currentUserService.requireCurrentUser();
        require(actor, MANAGE);
        String scenario = validCode(code, "DR_SCENARIO_NOT_FOUND");
        if (body == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "DR_TARGET_INVALID");
        String reason = trimmed(body.reason());
        if (reason.isEmpty() || reason.length() > 500) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "DR_REASON_REQUIRED");
        String token = body.signatureToken();
        signatures.requireValidToken(actor, token);
        UUID id = UUID.nameUUIDFromBytes(("scenario:" + scenario).getBytes(StandardCharsets.UTF_8));
        BackupAgentClient.Reply reply = tx.execute(status -> {
            ElectronicSignature signature = signatures.record(actor, token, TARGET_MEANING, "BACKUP_DR_SCENARIO", id, scenario,
                    "Change of recovery targets for " + scenario, null, null);
            String ref = signature == null ? "SIGNATURE_NOT_REQUIRED_BY_CONFIGURATION" : signature.getSignatureId();
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("rpoHours", body.rpoHours());
            out.put("rtoHours", body.rtoHours());
            out.put("by", actor.getUsername());
            out.put("reason", reason);
            out.put("signatureRef", ref);
            BackupAgentClient.Reply changed = agent.exchange(HttpMethod.POST, "/internal/dr/scenarios/" + scenario + "/targets", out);
            if (!changed.ok()) status.setRollbackOnly();
            return changed;
        });
        if (reply.ok()) {
            audit.logAs(actor, "BACKUP_DR_SCENARIO", scenario, id, "DR_TARGET_CHANGED", null, "APPROVED",
                    "Changed recovery targets of " + scenario + " to RPO " + body.rpoHours() + " h and RTO " + body.rtoHours() + " h. Reason: " + reason);
        }
        return reply(reply);
    }

    @GetMapping("/kit")
    public ResponseEntity<JsonNode> kit() {
        require(currentUserService.requireCurrentUser(), VIEW);
        return reply(agent.exchange(HttpMethod.GET, "/internal/dr/kit", null));
    }

    @PostMapping("/kit/{code}/verify")
    public ResponseEntity<JsonNode> verify(@PathVariable String code, @RequestBody VerifyBody body) {
        UserAccount actor = currentUserService.requireCurrentUser();
        require(actor, MANAGE);
        String item = validCode(code, "KIT_ITEM_NOT_FOUND");
        if (body == null || body.verifiedAt() == null || body.verifiedAt().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "VERIFIED_AT_REQUIRED");
        }
        String note = body.note() == null ? null : cut(body.note().trim(), 1000);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("verifiedAt", body.verifiedAt().trim());
        out.put("by", actor.getUsername());
        out.put("note", note);
        BackupAgentClient.Reply reply = agent.exchange(HttpMethod.POST, "/internal/dr/kit/" + item + "/verify", out);
        if (reply.ok()) {
            audit.logAs(actor, "BACKUP_DR_KIT", item, BackupAuditIds.of("kit", item), "DR_KIT_VERIFIED", "NOT_VERIFIED", "VERIFIED",
                    "Verified rebuild kit item " + item + " as of " + body.verifiedAt().trim() + (note == null ? "" : ". Note: " + note));
        }
        return reply(reply);
    }

    @GetMapping("/authority")
    public ResponseEntity<JsonNode> authority() {
        require(currentUserService.requireCurrentUser(), VIEW);
        return reply(agent.exchange(HttpMethod.GET, "/internal/dr/authority", null));
    }

    @PostMapping("/authority")
    public ResponseEntity<JsonNode> changeAuthority(@RequestBody AuthorityBody body) {
        UserAccount actor = currentUserService.requireCurrentUser();
        require(actor, MANAGE);
        String who = body == null || body.value() == null ? "" : body.value().trim();
        if (who.isEmpty() || who.length() > 200) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "DR_AUTHORITY_REQUIRED");
        UserAccount person = users.findByUsernameIgnoreCase(who)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "DR_AUTHORITY_NOT_FOUND"));
        if (person.getStatus() != UserStatus.Active) throw new ResponseStatusException(HttpStatus.CONFLICT, "DR_AUTHORITY_NOT_ACTIVE");
        String reason = trimmed(body.reason());
        if (reason.isEmpty() || reason.length() > 500) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "DR_REASON_REQUIRED");
        String token = body.signatureToken();
        signatures.requireValidToken(actor, token);
        UUID id = UUID.nameUUIDFromBytes("setting:DECLARATION_AUTHORITY".getBytes(StandardCharsets.UTF_8));
        BackupAgentClient.Reply reply = tx.execute(status -> {
            ElectronicSignature signature = signatures.record(actor, token, AUTHORITY_MEANING, "BACKUP_DR_SETTING", id, "DECLARATION_AUTHORITY",
                    "Change of the person who may declare a disaster to " + person.getUsername(), null, null);
            String ref = signature == null ? "SIGNATURE_NOT_REQUIRED_BY_CONFIGURATION" : signature.getSignatureId();
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("value", person.getUsername());
            out.put("by", actor.getUsername());
            out.put("reason", reason);
            out.put("signatureRef", ref);
            BackupAgentClient.Reply changed = agent.exchange(HttpMethod.POST, "/internal/dr/authority", out);
            if (!changed.ok()) status.setRollbackOnly();
            return changed;
        });
        if (reply.ok()) {
            audit.logAs(actor, "BACKUP_DR_SETTING", "DECLARATION_AUTHORITY", id, "DR_AUTHORITY_CHANGED", null, person.getUsername(),
                    "Changed who may declare a disaster to " + person.getUsername() + ". Reason: " + reason);
        }
        return reply(reply);
    }

    private void require(UserAccount actor, String permission) {
        if (!permissions.hasAnyPermission(actor, permission)) {
            throw new AccessDeniedException("Permission " + permission + " required");
        }
    }

    private static String validCode(String code, String notFound) {
        if (code == null || !CODE.matcher(code).matches()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, notFound);
        return code;
    }

    private static String trimmed(String value) {
        return value == null ? "" : value.trim();
    }

    private static String cut(String value, int max) {
        return value.length() > max ? value.substring(0, max) : value;
    }

    private static ResponseEntity<JsonNode> reply(BackupAgentClient.Reply reply) {
        return ResponseEntity.status(reply.status()).cacheControl(CacheControl.noStore()).body(reply.body());
    }
}
