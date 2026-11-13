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

    static final String VIEW = "backup.admin.disaster_recovery.view";
    static final String MANAGE = "backup.admin.disaster_recovery.manage";
    static final String TARGET_MEANING = "BACKUP_DR_TARGET_CHANGE";
    static final String AUTHORITY_MEANING = "BACKUP_DR_AUTHORITY_CHANGE";
    static final String DECLARE_MEANING = "BACKUP_DR_DECLARE";
    static final String CLOSE_MEANING = "BACKUP_DR_CLOSE";
    private static final Pattern DECLARATION = Pattern.compile("^DR-[0-9]{4}-[0-9]{4,}$");
    private static final Pattern CODE = Pattern.compile("^[A-Z_]{3,40}$");

    public record TargetBody(double rpoHours, double rtoHours, String reason, String signatureToken) {
    }

    public record VerifyBody(String verifiedAt, String note) {
    }

    public record AuthorityBody(String value, String reason, String signatureToken) {
    }

    public record DeclareBody(String scenario, String reason, String signatureToken) {
    }

    public record CloseBody(String summary, String signatureToken) {
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

    @GetMapping("/scenarios")
    public ResponseEntity<JsonNode> scenarios() {
        require(currentUserService.requireCurrentUser(), VIEW);
        return reply(agent.exchange(HttpMethod.GET, "/internal/dr/scenarios", null));
    }

    @GetMapping("/readiness")
    public ResponseEntity<JsonNode> readiness() {
        require(currentUserService.requireCurrentUser(), VIEW);
        return reply(agent.exchange(HttpMethod.GET, "/internal/dr/readiness", null));
    }

    private static void addBounded(org.springframework.web.util.UriComponentsBuilder uri, Map<String, Object> vars, String name, String value, int max) {
        if (value == null || value.isBlank()) return;
        uri.queryParam(name, "{" + name + "}");
        vars.put(name, cut(value.trim(), max));
    }

    @GetMapping("/declarations")
    public ResponseEntity<JsonNode> declarations(@org.springframework.web.bind.annotation.RequestParam(required = false) String search,
                                                 @org.springframework.web.bind.annotation.RequestParam(required = false) String status,
                                                 @org.springframework.web.bind.annotation.RequestParam(required = false) String scenario,
                                                 @org.springframework.web.bind.annotation.RequestParam(required = false) String from,
                                                 @org.springframework.web.bind.annotation.RequestParam(required = false) String to,
                                                 @org.springframework.web.bind.annotation.RequestParam(defaultValue = "declaredAt") String sortBy,
                                                 @org.springframework.web.bind.annotation.RequestParam(defaultValue = "desc") String sortDirection,
                                                 @org.springframework.web.bind.annotation.RequestParam(defaultValue = "1") int page,
                                                 @org.springframework.web.bind.annotation.RequestParam(defaultValue = "10") int limit) {
        require(currentUserService.requireCurrentUser(), VIEW);
        org.springframework.web.util.UriComponentsBuilder uri = org.springframework.web.util.UriComponentsBuilder.fromPath("/internal/dr/declarations")
                .queryParam("page", Math.max(page, 1)).queryParam("limit", Math.min(Math.max(limit, 1), 100));
        Map<String, Object> vars = new LinkedHashMap<>();
        addBounded(uri, vars, "search", search, 200);
        addBounded(uri, vars, "status", status, 10);
        addBounded(uri, vars, "scenario", scenario, 40);
        addBounded(uri, vars, "from", from, 40);
        addBounded(uri, vars, "to", to, 40);
        addBounded(uri, vars, "sortBy", sortBy, 30);
        addBounded(uri, vars, "sortDirection", sortDirection, 4);
        return reply(agent.exchange(HttpMethod.GET, uri.buildAndExpand(vars).encode().toUriString(), null));
    }

    /** Only the person named as the declaration authority may declare a disaster, and signs it. */
    @PostMapping("/declarations")
    public ResponseEntity<JsonNode> declare(@RequestBody DeclareBody body) {
        UserAccount actor = currentUserService.requireCurrentUser();
        require(actor, MANAGE);
        if (body == null || body.scenario() == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "DR_SCENARIO_NOT_FOUND");
        String scenario = validCode(body.scenario(), "DR_SCENARIO_NOT_FOUND");
        String reason = trimmed(body.reason());
        if (reason.isEmpty() || reason.length() > 1000) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "DR_REASON_REQUIRED");
        BackupAgentClient.Reply authority = agent.exchange(HttpMethod.GET, "/internal/dr/authority", null);
        String allowed = authority.ok() && authority.body() != null ? authority.body().path("value").asText("") : "";
        if (allowed.isEmpty() || !allowed.equalsIgnoreCase(actor.getUsername())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "DR_NOT_THE_DECLARATION_AUTHORITY");
        }
        String token = body.signatureToken();
        signatures.requireValidToken(actor, token);
        UUID id = UUID.nameUUIDFromBytes(("declaration:" + scenario + ":" + java.time.Instant.now()).getBytes(StandardCharsets.UTF_8));
        BackupAgentClient.Reply reply = tx.execute(status -> {
            ElectronicSignature signature = signatures.record(actor, token, DECLARE_MEANING, "BACKUP_DR_DECLARATION", id, scenario,
                    "Declaration of a disaster, scenario " + scenario, null, null);
            String ref = signature == null ? "SIGNATURE_NOT_REQUIRED_BY_CONFIGURATION" : signature.getSignatureId();
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("scenario", scenario);
            out.put("reason", reason);
            out.put("by", actor.getUsername());
            out.put("signatureRef", ref);
            BackupAgentClient.Reply made = agent.exchange(HttpMethod.POST, "/internal/dr/declarations", out);
            if (!made.ok()) status.setRollbackOnly();
            return made;
        });
        if (reply.ok()) {
            String code = reply.body().path("code").asText(scenario);
            audit.logAs(actor, "BACKUP_DR_DECLARATION", code, id, "DR_DECLARED", null, "OPEN", "Declared a disaster (" + scenario + "). Reason: " + reason);
        }
        return reply(reply);
    }

    @PostMapping("/declarations/{code}/close")
    public ResponseEntity<JsonNode> close(@PathVariable String code, @RequestBody CloseBody body) {
        UserAccount actor = currentUserService.requireCurrentUser();
        require(actor, MANAGE);
        if (code == null || !DECLARATION.matcher(code).matches()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "DR_DECLARATION_NOT_FOUND");
        String summary = body == null ? "" : trimmed(body.summary());
        if (summary.isEmpty() || summary.length() > 2000) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "DR_SUMMARY_REQUIRED");
        String token = body.signatureToken();
        signatures.requireValidToken(actor, token);
        UUID id = UUID.nameUUIDFromBytes(("declaration-close:" + code).getBytes(StandardCharsets.UTF_8));
        BackupAgentClient.Reply reply = tx.execute(status -> {
            ElectronicSignature signature = signatures.record(actor, token, CLOSE_MEANING, "BACKUP_DR_DECLARATION", id, code,
                    "Closure of disaster declaration " + code, null, null);
            String ref = signature == null ? "SIGNATURE_NOT_REQUIRED_BY_CONFIGURATION" : signature.getSignatureId();
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("summary", summary);
            out.put("by", actor.getUsername());
            out.put("signatureRef", ref);
            BackupAgentClient.Reply closed = agent.exchange(HttpMethod.POST, "/internal/dr/declarations/" + code + "/close", out);
            if (!closed.ok()) status.setRollbackOnly();
            return closed;
        });
        if (reply.ok()) {
            audit.logAs(actor, "BACKUP_DR_DECLARATION", code, id, "DR_DECLARATION_CLOSED", "OPEN", "CLOSED", "Closed disaster declaration " + code + ". " + summary);
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
