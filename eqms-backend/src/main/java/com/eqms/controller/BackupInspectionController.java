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

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Backup Inspection (SDS 7.2, phase 1). Asking uses the restore request permission and deciding uses the restore approval permission,
 * so the same people who handle restores handle inspections. Approving and rejecting carry an electronic signature, recorded in the
 * same transaction as the decision. The agent enforces that the approver is a different person and that the copy is read-only.
 */
@RestController
@RequestMapping("/backup-restore")
public class BackupInspectionController {

    static final String VIEW = BackupRestoreRequestController.VIEW;
    static final String REQUEST = BackupRestoreRequestController.REQUEST;
    static final String APPROVE = BackupRestoreRequestController.APPROVE;
    static final String APPROVAL_MEANING = "BACKUP_INSPECTION_APPROVAL";
    static final String REJECTION_MEANING = "BACKUP_INSPECTION_REJECTION";
    private static final Pattern BACKUP_ID = Pattern.compile("^BK-\\d{8}-\\d{4}-\\d{4}$");
    private static final Pattern INSPECTION_ID = Pattern.compile("^IS-\\d{8}-\\d{4}$");
    private static final int MAX_TEXT = 500;
    static final Set<String> STATUSES = Set.of("PENDING_APPROVAL", "REJECTED", "APPROVED", "OPENING", "OPEN", "CLOSED", "FAILED");

    public record AskBody(String reason) {
    }

    public record ApproveBody(String signatureToken) {
    }

    public record ReasonBody(String reason, String signatureToken) {
    }

    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissionEvaluationService;
    private final BackupAgentClient agent;
    private final AuditTrailService audit;
    private final SecurityChangeSignatureService signatures;
    private final TransactionTemplate tx;

    public BackupInspectionController(CurrentUserService currentUserService, PermissionEvaluationService permissionEvaluationService,
                                      BackupAgentClient agent, AuditTrailService audit, SecurityChangeSignatureService signatures, TransactionTemplate tx) {
        this.currentUserService = currentUserService;
        this.permissionEvaluationService = permissionEvaluationService;
        this.agent = agent;
        this.audit = audit;
        this.signatures = signatures;
        this.tx = tx;
    }

    @GetMapping("/inspections")
    public ResponseEntity<JsonNode> list(@RequestParam(required = false) String search, @RequestParam(required = false) String status,
                                         @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit) {
        require(currentUserService.requireCurrentUser(), VIEW);
        UriComponentsBuilder uri = UriComponentsBuilder.fromPath("/internal/inspections")
                .queryParam("page", Math.max(page, 1)).queryParam("limit", Math.min(Math.max(limit, 1), 100));
        Map<String, Object> vars = new LinkedHashMap<>();
        if (search != null && !search.isBlank()) {
            uri.queryParam("search", "{search}");
            vars.put("search", search.length() > 200 ? search.substring(0, 200) : search);
        }
        if (status != null && !status.isBlank()) {
            String allowed = status.trim().toUpperCase(Locale.ROOT);
            if (!STATUSES.contains(allowed)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "INSPECTION_STATUS_UNKNOWN");
            uri.queryParam("status", "{status}");
            vars.put("status", allowed);
        }
        return reply(agent.exchange(HttpMethod.GET, uri.buildAndExpand(vars).encode().toUriString(), null));
    }

    @GetMapping("/inspections/{inspectionId}")
    public ResponseEntity<JsonNode> get(@PathVariable String inspectionId) {
        require(currentUserService.requireCurrentUser(), VIEW);
        return reply(agent.exchange(HttpMethod.GET, "/internal/inspections/" + validInspectionId(inspectionId), null));
    }

    @PostMapping("/backups/{backupId}/inspections")
    public ResponseEntity<JsonNode> ask(@PathVariable String backupId, @RequestBody AskBody body) {
        UserAccount actor = currentUserService.requireCurrentUser();
        require(actor, REQUEST);
        String id = validBackupId(backupId);
        String reason = body == null || body.reason() == null ? "" : body.reason().trim();
        if (reason.isEmpty() || reason.length() > MAX_TEXT) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "INSPECTION_REASON_REQUIRED");
        BackupAgentClient.Reply reply = agent.exchange(HttpMethod.POST, "/internal/backups/" + id + "/inspections",
                Map.of("by", actor.getUsername(), "reason", reason));
        if (reply.ok()) {
            audit.logAs(actor, "BACKUP_INSPECTION", reply.body().path("inspectionId").asText(), uuidText(reply.body().path("id").asText()),
                    "INSPECTION_REQUESTED", null, "PENDING_APPROVAL", "Asked to inspect " + id + " read-only for five minutes. Reason: " + reason);
        }
        return reply(reply);
    }

    /** Approval needs the approver's electronic signature; it is recorded in the same transaction as the approval. */
    @PostMapping("/inspections/{inspectionId}/approve")
    public ResponseEntity<JsonNode> approve(@PathVariable String inspectionId, @RequestBody ApproveBody body) {
        UserAccount actor = currentUserService.requireCurrentUser();
        require(actor, APPROVE);
        String id = validInspectionId(inspectionId);
        String token = body == null ? null : body.signatureToken();
        signatures.requireValidToken(actor, token);
        UUID rowId = rowId(id);
        if (rowId == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "INSPECTION_NOT_FOUND");
        BackupAgentClient.Reply reply = tx.execute(status -> {
            ElectronicSignature signature = signatures.record(actor, token, APPROVAL_MEANING, "BACKUP_INSPECTION", rowId, id,
                    "Approval of inspection " + id, null, null);
            String ref = signature == null ? "SIGNATURE_NOT_REQUIRED_BY_CONFIGURATION" : signature.getSignatureId();
            BackupAgentClient.Reply approved = agent.exchange(HttpMethod.POST, "/internal/inspections/" + id + "/approve",
                    Map.of("by", actor.getUsername(), "signatureRef", ref));
            if (!approved.ok()) status.setRollbackOnly();
            return approved;
        });
        if (reply.ok()) {
            audit.logAs(actor, "BACKUP_INSPECTION", id, rowId, "INSPECTION_APPROVED", "PENDING_APPROVAL", "APPROVED",
                    "Approved inspection " + id + " with an electronic signature");
        } else {
            audit.logAs(actor, "BACKUP_INSPECTION", id, rowId, "INSPECTION_APPROVAL_REFUSED", "PENDING_APPROVAL", "PENDING_APPROVAL",
                    "Approval refused: " + reply.body().path("code").asText("UNKNOWN"));
        }
        return reply(reply);
    }

    @PostMapping("/inspections/{inspectionId}/reject")
    public ResponseEntity<JsonNode> reject(@PathVariable String inspectionId, @RequestBody ReasonBody body) {
        UserAccount actor = currentUserService.requireCurrentUser();
        require(actor, APPROVE);
        String id = validInspectionId(inspectionId);
        String reason = body == null || body.reason() == null ? "" : body.reason().trim();
        if (reason.isEmpty() || reason.length() > MAX_TEXT) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "INSPECTION_REASON_REQUIRED");
        String token = body == null ? null : body.signatureToken();
        signatures.requireValidToken(actor, token);
        UUID rowId = rowId(id);
        if (rowId == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "INSPECTION_NOT_FOUND");
        BackupAgentClient.Reply reply = tx.execute(status -> {
            signatures.record(actor, token, REJECTION_MEANING, "BACKUP_INSPECTION", rowId, id, "Rejection of inspection " + id, null, null);
            BackupAgentClient.Reply rejected = agent.exchange(HttpMethod.POST, "/internal/inspections/" + id + "/reject",
                    Map.of("by", actor.getUsername(), "reason", reason));
            if (!rejected.ok()) status.setRollbackOnly();
            return rejected;
        });
        if (reply.ok()) {
            audit.logAs(actor, "BACKUP_INSPECTION", id, rowId, "INSPECTION_REJECTED", "PENDING_APPROVAL", "REJECTED", "Rejected inspection " + id + ". Reason: " + reason);
        }
        return reply(reply);
    }

    /** Closing before the five minutes are over. Any person who may ask may close; the agent records who closed it and why. */
    @PostMapping("/inspections/{inspectionId}/close")
    public ResponseEntity<JsonNode> close(@PathVariable String inspectionId, @RequestBody(required = false) ReasonBody body) {
        UserAccount actor = currentUserService.requireCurrentUser();
        require(actor, REQUEST);
        String id = validInspectionId(inspectionId);
        String reason = body == null || body.reason() == null || body.reason().isBlank() ? "CLOSED_BY_USER" : body.reason().trim();
        if (reason.length() > MAX_TEXT) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "INSPECTION_REASON_REQUIRED");
        BackupAgentClient.Reply reply = agent.exchange(HttpMethod.POST, "/internal/inspections/" + id + "/close",
                Map.of("by", actor.getUsername(), "reason", reason));
        if (reply.ok()) {
            audit.logAs(actor, "BACKUP_INSPECTION", id, rowId(id), "INSPECTION_CLOSED", "OPEN", "CLOSED", "Closed inspection " + id + ". Reason: " + reason);
        }
        return reply(reply);
    }

    /** The audit row needs the inspection's own id; it is read from the agent first. */
    private UUID rowId(String id) {
        BackupAgentClient.Reply current = agent.exchange(HttpMethod.GET, "/internal/inspections/" + id, null);
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

    private static String validInspectionId(String id) {
        if (id == null || !INSPECTION_ID.matcher(id).matches()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "INSPECTION_NOT_FOUND");
        return id;
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
