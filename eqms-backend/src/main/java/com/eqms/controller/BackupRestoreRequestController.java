package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.entity.ElectronicSignature;
import com.eqms.entity.UserAccount;
import com.eqms.service.AuditTrailService;
import com.eqms.service.BackupAgentClient;
import com.eqms.service.RestoreApprovalNotifier;
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

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Restore requests, steps R0-R3 (SDS 11.3). Asking, approving and deciding are separate permissions; there is no cancellation; approving carries the approver's
 * electronic signature, recorded in the same transaction as the approval. Nothing here restores data: execution is not built.
 */
@RestController
@RequestMapping("/backup-restore")
public class BackupRestoreRequestController {

    static final String VIEW = "backup.module.view";
    static final String REQUEST = "backup.restore.request";
    static final String APPROVE = "backup.restore.approve";
    static final String EXECUTE = "backup.restore.execute";
    static final String MEANING = "BACKUP_RESTORE_APPROVAL";
    static final String REJECT_MEANING = "BACKUP_RESTORE_REJECTION";
    private static final Pattern BACKUP_ID = Pattern.compile("^BK-\\d{8}-\\d{4}-\\d{4}$");
    private static final Pattern REQUEST_ID = Pattern.compile("^RS-\\d{8}-\\d{4}$");
    private static final int MAX_TEXT = 500;

    public record CreateRestoreBody(String type, String target, String reason, String changeControlRef) {
    }

    public record ApproveBody(String signatureToken) {
    }

    /** Rejection needs a reason and the rejecting person's electronic signature. */
    public record ReasonBody(String reason, String signatureToken) {
    }

    /** The window the executor asks for, as an instant (for example 2026-10-10T02:00:00Z). The executor is the signed-in person. */
    public record EnterWindowBody(boolean noUserConfirmed) {
    }

    public record ScheduleBody(String windowStart) {
    }

    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissionEvaluationService;
    private final BackupAgentClient agent;
    private final AuditTrailService audit;
    private final SecurityChangeSignatureService signatures;
    private final TransactionTemplate tx;
    private final RestoreApprovalNotifier approvalNotifier;

    public BackupRestoreRequestController(CurrentUserService currentUserService, PermissionEvaluationService permissionEvaluationService,
                                          BackupAgentClient agent, AuditTrailService audit, SecurityChangeSignatureService signatures, TransactionTemplate tx,
                                          RestoreApprovalNotifier approvalNotifier) {
        this.currentUserService = currentUserService;
        this.permissionEvaluationService = permissionEvaluationService;
        this.agent = agent;
        this.audit = audit;
        this.signatures = signatures;
        this.tx = tx;
        this.approvalNotifier = approvalNotifier;
    }

    @GetMapping("/restores")
    public ResponseEntity<JsonNode> list(@RequestParam(required = false) String search, @RequestParam(required = false) String status,
                                         @RequestParam(required = false) String target,
                                         @RequestParam(defaultValue = "requestedAt") String sortBy, @RequestParam(defaultValue = "desc") String sortDirection,
                                         @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit) {
        require(currentUserService.requireCurrentUser(), VIEW);
        UriComponentsBuilder uri = UriComponentsBuilder.fromPath("/internal/restores");
        Map<String, Object> vars = new LinkedHashMap<>();
        if (search != null && !search.isBlank()) {
            uri.queryParam("search", "{search}");
            vars.put("search", cut(search, 200));
        }
        if (status != null && !status.isBlank()) {
            uri.queryParam("status", "{status}");
            vars.put("status", cut(status, 20));
        }
        if (target != null && !target.isBlank()) {
            uri.queryParam("target", "{target}");
            vars.put("target", cut(target, 20));
        }
        uri.queryParam("sortBy", "{sortBy}").queryParam("sortDirection", "{dir}")
                .queryParam("page", Math.max(page, 1)).queryParam("limit", Math.min(Math.max(limit, 1), 100));
        vars.put("sortBy", cut(sortBy, 30));
        vars.put("dir", "asc".equalsIgnoreCase(sortDirection) ? "asc" : "desc");
        return reply(agent.exchange(HttpMethod.GET, uri.buildAndExpand(vars).encode().toUriString(), null));
    }

    @GetMapping("/restores/{restoreNumber}")
    public ResponseEntity<JsonNode> get(@PathVariable String restoreNumber) {
        require(currentUserService.requireCurrentUser(), VIEW);
        return reply(agent.exchange(HttpMethod.GET, "/internal/restores/" + validRequestId(restoreNumber), null));
    }

    @PostMapping("/backups/{backupNumber}/restores")
    public ResponseEntity<JsonNode> request(@PathVariable String backupNumber, @RequestBody CreateRestoreBody body) {
        UserAccount actor = currentUserService.requireCurrentUser();
        require(actor, REQUEST);
        String id = validBackupId(backupNumber);
        String reason = body == null || body.reason() == null ? "" : body.reason().trim();
        if (reason.isEmpty() || reason.length() > MAX_TEXT) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "RESTORE_REASON_REQUIRED");
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("by", actor.getUsername());
        out.put("type", body.type());
        out.put("target", body.target());
        out.put("reason", reason);
        out.put("changeControlRef", body.changeControlRef());
        BackupAgentClient.Reply reply = agent.exchange(HttpMethod.POST, "/internal/backups/" + id + "/restores", out);
        if (reply.ok()) {
            audit.logAs(actor, "BACKUP_RESTORE", reply.body().path("restoreNumber").asText(), uuidOf(reply), "RESTORE_REQUESTED", null, "PENDING_APPROVAL",
                    "Requested a " + body.type() + " restore of " + id + " to " + body.target() + ". Reason: " + reason);
        }
        return reply(reply);
    }

    /** Approval needs the approver's electronic signature; the signature is recorded in the same transaction as the approval. */
    /** The checks before a run and the schedule that exists (SDS 11.3, R4); read on the agent. */
    @GetMapping("/restores/{restoreNumber}/execution")
    public ResponseEntity<JsonNode> execution(@PathVariable String restoreNumber) {
        UserAccount actor = currentUserService.requireCurrentUser();
        require(actor, VIEW);
        String id = validRequestId(restoreNumber);
        return reply(agent.exchange(HttpMethod.GET, "/internal/restores/" + id + "/execution", null));
    }

    /** Schedules an approved request for a maintenance window. Changes no data; the run itself is not built yet. */
    @PostMapping("/restores/{restoreNumber}/schedule")
    public ResponseEntity<JsonNode> schedule(@PathVariable String restoreNumber, @RequestBody ScheduleBody body) {
        UserAccount actor = currentUserService.requireCurrentUser();
        require(actor, EXECUTE);
        String id = validRequestId(restoreNumber);
        UUID requestUuid = requestUuid(id);
        if (requestUuid == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "RESTORE_REQUEST_NOT_FOUND");
        String window = body == null || body.windowStart() == null ? "" : body.windowStart().trim();
        BackupAgentClient.Reply reply = agent.exchange(HttpMethod.POST, "/internal/restores/" + id + "/schedule",
                Map.of("by", actor.getUsername(), "windowStart", window));
        if (reply.ok()) {
            audit.logAs(actor, "BACKUP_RESTORE", id, requestUuid, "RESTORE_SCHEDULED", "APPROVED", "APPROVED", "Scheduled restore " + id + " for " + window);
        }
        return reply(reply);
    }

    /**
     * Starts the restore window: the system goes from DRAINED to LOCKED_RESTORING for this request (SDS 11.5.1, WP3.1 slice 2). Only a
     * person with the execute permission may do it; the agent checks the schedule, the time and the notice.
     */
    @PostMapping("/restores/{restoreNumber}/enter-window")
    public ResponseEntity<JsonNode> enterWindow(@PathVariable String restoreNumber, @RequestBody EnterWindowBody body) {
        UserAccount actor = currentUserService.requireCurrentUser();
        require(actor, EXECUTE);
        String id = validRequestId(restoreNumber);
        UUID requestUuid = requestUuid(id);
        if (requestUuid == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "RESTORE_REQUEST_NOT_FOUND");
        boolean confirmed = body != null && body.noUserConfirmed();
        BackupAgentClient.Reply reply = agent.exchange(HttpMethod.POST, "/internal/restores/" + id + "/enter-window",
                Map.of("by", actor.getUsername(), "noUserConfirmed", confirmed));
        if (reply.ok()) {
            audit.logAs(actor, "BACKUP_RESTORE", id, requestUuid, "RESTORE_WINDOW_LOCKED", "APPROVED", "LOCKED_RESTORING", "Restore window started for " + id);
        }
        return reply(reply);
    }

    /**
     * Starts the test restore of the backup inside the restore window (SDS 14.1, WP3.1 slice 3). The restore runs in a scratch database
     * on the restore worker; production data is not changed.
     */
    @PostMapping("/restores/{restoreNumber}/test-restore")
    public ResponseEntity<JsonNode> testRestore(@PathVariable String restoreNumber) {
        UserAccount actor = currentUserService.requireCurrentUser();
        require(actor, EXECUTE);
        String id = validRequestId(restoreNumber);
        UUID requestUuid = requestUuid(id);
        if (requestUuid == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "RESTORE_REQUEST_NOT_FOUND");
        BackupAgentClient.Reply reply = agent.exchange(HttpMethod.POST, "/internal/restores/" + id + "/test-restore", Map.of("by", actor.getUsername()));
        if (reply.ok()) {
            audit.logAs(actor, "BACKUP_RESTORE", id, requestUuid, "RESTORE_TEST_STARTED", "LOCKED_RESTORING", "LOCKED_RESTORING", "Test restore started for " + id);
        }
        return reply(reply);
    }

    /** The signed evidence pack of one restore request (SDS 16): what happened, who decided, the checks and the ledger chain. */
    @GetMapping("/restores/{restoreNumber}/evidence")
    public ResponseEntity<JsonNode> evidence(@PathVariable String restoreNumber) {
        UserAccount actor = currentUserService.requireCurrentUser();
        require(actor, VIEW);
        String id = validRequestId(restoreNumber);
        return reply(agent.exchange(HttpMethod.GET, "/internal/restores/" + id + "/evidence", null));
    }

    /** Whether a production restore of this backup may be asked for: the test restore that decides it, read on the agent. */
    @GetMapping("/backups/{backupNumber}/restore-readiness")
    public ResponseEntity<JsonNode> readiness(@PathVariable String backupNumber) {
        UserAccount actor = currentUserService.requireCurrentUser();
        require(actor, VIEW);
        String id = validBackupId(backupNumber);
        return reply(agent.exchange(HttpMethod.GET, "/internal/backups/" + id + "/restore-readiness", null));
    }

    @PostMapping("/restores/{restoreNumber}/approve")
    public ResponseEntity<JsonNode> approve(@PathVariable String restoreNumber, @RequestBody ApproveBody body) {
        UserAccount actor = currentUserService.requireCurrentUser();
        require(actor, APPROVE);
        String id = validRequestId(restoreNumber);
        String token = body == null ? null : body.signatureToken();
        signatures.requireValidToken(actor, token);
        UUID requestUuid = requestUuid(id);
        if (requestUuid == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "RESTORE_REQUEST_NOT_FOUND");
        BackupAgentClient.Reply reply = tx.execute(status -> {
            ElectronicSignature signature = signatures.record(actor, token, MEANING, "BACKUP_RESTORE", requestUuid, id,
                    "Approval of restore " + id, null, null);
            String ref = signature == null ? "SIGNATURE_NOT_REQUIRED_BY_CONFIGURATION" : signature.getSignatureId();
            BackupAgentClient.Reply approved = agent.exchange(HttpMethod.POST, "/internal/restores/" + id + "/approve",
                    Map.of("by", actor.getUsername(), "signatureRef", ref));
            if (!approved.ok()) {
                status.setRollbackOnly();
            }
            return approved;
        });
        if (reply.ok()) {
            audit.logAs(actor, "BACKUP_RESTORE", id, requestUuid, "RESTORE_APPROVED", "PENDING_APPROVAL", "APPROVED",
                    "Approved restore " + id + " with an electronic signature");
            approvalNotifier.approved(id, reply.body().path("backupNumber").asText(""), actor.getUsername());
        } else if (requestUuid != null) {
            audit.logAs(actor, "BACKUP_RESTORE", id, requestUuid, "RESTORE_APPROVAL_REFUSED", "PENDING_APPROVAL", "PENDING_APPROVAL",
                    "Approval refused: " + reply.body().path("code").asText("UNKNOWN"));
        }
        return reply(reply);
    }

    @PostMapping("/restores/{restoreNumber}/reject")
    public ResponseEntity<JsonNode> reject(@PathVariable String restoreNumber, @RequestBody ReasonBody body) {
        UserAccount actor = currentUserService.requireCurrentUser();
        require(actor, APPROVE);
        String id = validRequestId(restoreNumber);
        String reason = body == null || body.reason() == null ? "" : body.reason().trim();
        if (reason.isEmpty() || reason.length() > MAX_TEXT) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "RESTORE_REASON_REQUIRED");
        String token = body.signatureToken();
        signatures.requireValidToken(actor, token);
        UUID requestUuid = requestUuid(id);
        if (requestUuid == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "RESTORE_REQUEST_NOT_FOUND");
        BackupAgentClient.Reply reply = tx.execute(status -> {
            signatures.record(actor, token, REJECT_MEANING, "BACKUP_RESTORE", requestUuid, id,
                    "Rejection of restore " + id, null, null);
            BackupAgentClient.Reply rejected = agent.exchange(HttpMethod.POST, "/internal/restores/" + id + "/reject",
                    Map.of("by", actor.getUsername(), "reason", reason));
            if (!rejected.ok()) {
                status.setRollbackOnly();
            }
            return rejected;
        });
        if (reply.ok()) {
            audit.logAs(actor, "BACKUP_RESTORE", id, requestUuid, "RESTORE_REJECTED", "PENDING_APPROVAL", "REJECTED", "Rejected restore " + id + ". Reason: " + reason);
        }
        return reply(reply);
    }

    /** The audit row needs the request's own id; it is read from the agent first, because a refusal body has none. */
    private UUID requestUuid(String id) {
        BackupAgentClient.Reply current = agent.exchange(HttpMethod.GET, "/internal/restores/" + id, null);
        return current.ok() ? uuidText(current.body().path("id").asText()) : null;
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

    private static String validRequestId(String id) {
        if (id == null || !REQUEST_ID.matcher(id).matches()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "RESTORE_REQUEST_NOT_FOUND");
        return id;
    }

    private static String cut(String value, int max) {
        return value.length() > max ? value.substring(0, max) : value;
    }

    private static UUID uuidOf(BackupAgentClient.Reply reply) {
        return uuidText(reply.body().path("id").asText());
    }

    private static UUID uuidText(String text) {
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
