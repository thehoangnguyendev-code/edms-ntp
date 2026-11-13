package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.entity.ElectronicSignature;
import com.eqms.entity.UserAccount;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriComponentsBuilder;

import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Restore into production (SDS-BR-003). No approval flow: the person who restores, rolls back or finalizes signs with their own
 * electronic signature, and the permission decides who may. Restoring and rolling back need backup.restore.execute; finalizing needs
 * backup.restore.finalize, which the administrator grants to a QA user. The signature is recorded in the same transaction as the
 * request to the agent, and is rolled back if the agent refuses. The agent's worker does the work; the caller reads the job.
 */
@RestController
@RequestMapping("/backup-restore")
public class BackupProductionRestoreController {

    static final String VIEW = "backup.module.view";
    static final String EXECUTE = "backup.restore.execute";
    static final String FINALIZE = "backup.restore.finalize";
    static final String MEANING_EXECUTE = "BACKUP_RESTORE_EXECUTION";
    static final String MEANING_ROLLBACK = "BACKUP_RESTORE_ROLLBACK";
    static final String MEANING_FINALIZE = "BACKUP_RESTORE_FINALIZATION";
    private static final Pattern BACKUP_ID = Pattern.compile("^BK-\\d{8}-\\d{4}-\\d{4}$");
    private static final Pattern RUN_CODE = Pattern.compile("^RS-[0-9a-f]{12}$");
    private static final Pattern JOB_ID = Pattern.compile("^[0-9a-fA-F-]{36}$");

    public record SignedBody(String signatureToken) {
    }

    /** {@code components} are the parts to restore (DATABASE, and OBJECT_STORE for the files); null means the database and the files the backup holds. */
    public record RestoreBody(String signatureToken, java.util.List<String> components) {
    }

    static final java.util.Set<String> PARTS = java.util.Set.of("DATABASE", "OBJECT_STORE");

    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissions;
    private final BackupAgentClient agent;
    private final AuditTrailService audit;
    private final SecurityChangeSignatureService signatures;
    private final TransactionTemplate tx;

    public BackupProductionRestoreController(CurrentUserService currentUserService, PermissionEvaluationService permissions, BackupAgentClient agent,
                                             AuditTrailService audit, SecurityChangeSignatureService signatures, TransactionTemplate tx) {
        this.currentUserService = currentUserService;
        this.permissions = permissions;
        this.agent = agent;
        this.audit = audit;
        this.signatures = signatures;
        this.tx = tx;
    }

    /** The restores that reached the swap, and what the person can do now. */
    @GetMapping("/production-restores")
    public ResponseEntity<JsonNode> list(@RequestParam(required = false) String search, @RequestParam(required = false) String status,
                                         @RequestParam(required = false) String part, @RequestParam(required = false) String restoredFrom,
                                         @RequestParam(required = false) String restoredTo, @RequestParam(required = false) String closedFrom,
                                         @RequestParam(required = false) String closedTo,
                                         @RequestParam(defaultValue = "restoredAt") String sortBy, @RequestParam(defaultValue = "desc") String sortDirection,
                                         @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit) {
        UserAccount actor = currentUserService.requireCurrentUser();
        require(actor, VIEW);
        UriComponentsBuilder uri = UriComponentsBuilder.fromPath("/internal/restores/production");
        Map<String, Object> vars = new java.util.LinkedHashMap<>();
        if (search != null && !search.isBlank()) {
            uri.queryParam("search", "{search}");
            vars.put("search", cut(search, 200));
        }
        if (status != null && !status.isBlank()) {
            uri.queryParam("status", "{status}");
            vars.put("status", cut(status, 30));
        }
        for (String[] pair : new String[][] {{"part", part}, {"restoredFrom", restoredFrom}, {"restoredTo", restoredTo}, {"closedFrom", closedFrom}, {"closedTo", closedTo}}) {
            if (pair[1] != null && !pair[1].isBlank()) {
                uri.queryParam(pair[0], "{" + pair[0] + "}");
                vars.put(pair[0], cut(pair[1], 40));
            }
        }
        uri.queryParam("sortBy", "{sortBy}").queryParam("sortDirection", "{dir}")
                .queryParam("page", Math.max(page, 1)).queryParam("limit", Math.min(Math.max(limit, 1), 100));
        vars.put("sortBy", cut(sortBy, 30));
        vars.put("dir", "asc".equalsIgnoreCase(sortDirection) ? "asc" : "desc");
        return reply(agent.exchange(HttpMethod.GET, uri.buildAndExpand(vars).encode().toUriString(), null));
    }

    private static String cut(String value, int max) {
        return value.length() > max ? value.substring(0, max) : value;
    }

    @GetMapping("/production-restores/jobs/{jobId}")
    public ResponseEntity<JsonNode> job(@PathVariable String jobId) {
        UserAccount actor = currentUserService.requireCurrentUser();
        require(actor, VIEW);
        if (jobId == null || !JOB_ID.matcher(jobId).matches()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "JOB_NOT_FOUND");
        return reply(agent.exchange(HttpMethod.GET, "/internal/restores/production/jobs/" + jobId, null));
    }

    /** What the signed-in person may do, so the screen shows only the actions that will be accepted. */
    @GetMapping("/production-restores/capabilities")
    public Map<String, Boolean> capabilities() {
        UserAccount actor = currentUserService.requireCurrentUser();
        return Map.of("view", permissions.hasAnyPermission(actor, VIEW),
                "restore", permissions.hasAnyPermission(actor, EXECUTE),
                "rollback", permissions.hasAnyPermission(actor, EXECUTE),
                "finalize", permissions.hasAnyPermission(actor, FINALIZE));
    }

    @PostMapping("/backups/{backupNumber}/production-restore")
    public ResponseEntity<JsonNode> restore(@PathVariable String backupNumber, @RequestBody RestoreBody body) {
        UserAccount actor = currentUserService.requireCurrentUser();
        require(actor, EXECUTE);
        if (backupNumber == null || !BACKUP_ID.matcher(backupNumber).matches()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "BACKUP_NOT_FOUND");
        java.util.List<String> parts = null;
        if (body != null && body.components() != null) {
            parts = body.components().stream().map(p -> p == null ? "" : p.trim()).distinct().toList();
            if (parts.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "RESTORE_PARTS_REQUIRED");
            if (!PARTS.containsAll(parts)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "RESTORE_PART_UNKNOWN");
        }
        UUID entity = UUID.nameUUIDFromBytes(("BACKUP_RESTORE:" + backupNumber).getBytes(StandardCharsets.UTF_8));
        Map<String, Object> extra = new java.util.LinkedHashMap<>();
        extra.put("backupNumber", backupNumber);
        if (parts != null) extra.put("components", parts);
        BackupAgentClient.Reply reply = signedCall(actor, body == null ? null : new SignedBody(body.signatureToken()), MEANING_EXECUTE, entity, backupNumber,
                "Restore of backup " + backupNumber + " into production" + (parts == null ? "" : " (" + String.join(", ", parts) + ")"),
                "/internal/restores/production", extra, null);
        audit.logAs(actor, "BACKUP_RESTORE", backupNumber, entity, reply.ok() ? "PRODUCTION_RESTORE_REQUESTED" : "PRODUCTION_RESTORE_REFUSED", null, null,
                reply.ok() ? "Requested a restore of backup " + backupNumber + (parts == null ? "" : " (" + String.join(", ", parts) + ")") + " into production, signed" : "Refused: " + reply.body().path("code").asText("UNKNOWN"));
        return reply(reply);
    }

    @PostMapping("/production-restores/{runCode}/finalize")
    public ResponseEntity<JsonNode> finalizeRestore(@PathVariable String runCode, @RequestBody SignedBody body) {
        UserAccount actor = currentUserService.requireCurrentUser();
        require(actor, FINALIZE);
        return action(actor, runCode, body, MEANING_FINALIZE, "finalize", "PRODUCTION_RESTORE_FINALIZED", "Finalized");
    }

    @PostMapping("/production-restores/{runCode}/rollback")
    public ResponseEntity<JsonNode> rollBack(@PathVariable String runCode, @RequestBody SignedBody body) {
        UserAccount actor = currentUserService.requireCurrentUser();
        require(actor, EXECUTE);
        return action(actor, runCode, body, MEANING_ROLLBACK, "rollback", "PRODUCTION_RESTORE_ROLLED_BACK", "Rolled back");
    }

    private ResponseEntity<JsonNode> action(UserAccount actor, String runCode, SignedBody body, String meaning, String path, String auditAction, String verb) {
        if (runCode == null || !RUN_CODE.matcher(runCode).matches()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "RESTORE_NOT_FOUND");
        UUID entity = UUID.nameUUIDFromBytes(("BACKUP_RESTORE:" + runCode).getBytes(StandardCharsets.UTF_8));
        BackupAgentClient.Reply reply = signedCall(actor, body, meaning, entity, runCode, verb + " restore " + runCode,
                "/internal/restores/production/" + runCode + "/" + path, Map.of(), null);
        audit.logAs(actor, "BACKUP_RESTORE", runCode, entity, reply.ok() ? auditAction : auditAction + "_REFUSED", null, null,
                reply.ok() ? verb + " restore " + runCode + " with an electronic signature" : "Refused: " + reply.body().path("code").asText("UNKNOWN"));
        return reply(reply);
    }

    /** Verifies the signature first, records it with the call to the agent in one transaction, and undoes it if the agent refuses. */
    private BackupAgentClient.Reply signedCall(UserAccount actor, SignedBody body, String meaning, UUID entity, String entityName, String reason,
                                               String path, Map<String, Object> extra, Object unused) {
        String token = body == null ? null : body.signatureToken();
        signatures.requireValidToken(actor, token);
        return tx.execute(status -> {
            ElectronicSignature signature = signatures.record(actor, token, meaning, "BACKUP_RESTORE", entity, entityName, reason, null, null);
            String ref = signature == null ? "SIGNATURE_NOT_REQUIRED_BY_CONFIGURATION" : signature.getSignatureId();
            Map<String, Object> payload = new java.util.LinkedHashMap<>(extra);
            payload.put("by", actor.getUsername());
            payload.put("signatureRef", ref);
            BackupAgentClient.Reply r = agent.exchange(HttpMethod.POST, path, payload);
            if (!r.ok()) status.setRollbackOnly();
            return r;
        });
    }

    private void require(UserAccount actor, String permission) {
        if (!permissions.hasAnyPermission(actor, permission)) throw new AccessDeniedException("Permission " + permission + " required");
    }

    private static ResponseEntity<JsonNode> reply(BackupAgentClient.Reply reply) {
        return ResponseEntity.status(reply.status()).cacheControl(CacheControl.noStore()).body(reply.body());
    }
}
