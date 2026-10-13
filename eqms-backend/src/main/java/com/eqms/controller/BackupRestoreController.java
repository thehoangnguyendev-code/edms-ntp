package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.backup.BackupRestoreStatusResponse;
import com.eqms.entity.UserAccount;
import com.eqms.service.AuditTrailService;
import com.eqms.service.BackupAgentClient;
import com.eqms.service.PermissionEvaluationService;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Backup & Restore module API. The backend decides who may do what and records it in the audit trail; the Backup Agent does the
 * work (SDS-BR-001). Nothing here reads a backup or a key.
 */
@RestController
@RequestMapping("/backup-restore")
public class BackupRestoreController {

    static final String VIEW_PERMISSION = "backup.module.view";
    static final String RUN_PERMISSION = "backup.backup.run";
    static final String VERIFY_PERMISSION = "backup.backup.verify";

    private static final Pattern BACKUP_ID = Pattern.compile("^BK-\\d{8}-\\d{4}-\\d{4}$");
    private static final Set<String> BACKUP_TYPES = Set.of("FULL", "PRE_CHANGE");
    private static final int MAX_REASON = 500;
    private static final int MAX_REFERENCE = 120;

    public record CreateBackupRequest(String reason, String changeControlRef, String type) {
    }

    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissionEvaluationService;
    private final BackupAgentClient agent;
    private final AuditTrailService auditTrailService;

    public BackupRestoreController(CurrentUserService currentUserService, PermissionEvaluationService permissionEvaluationService,
                                   BackupAgentClient agent, AuditTrailService auditTrailService) {
        this.currentUserService = currentUserService;
        this.permissionEvaluationService = permissionEvaluationService;
        this.agent = agent;
        this.auditTrailService = auditTrailService;
    }

    /** Kept for the module landing check. */
    @GetMapping("/status")
    public ResponseEntity<BackupRestoreStatusResponse> status() {
        require(currentUserService.requireCurrentUser(), VIEW_PERMISSION);
        return noStore(BackupRestoreStatusResponse.notImplemented());
    }

    @GetMapping("/overview")
    public ResponseEntity<JsonNode> overview() {
        require(currentUserService.requireCurrentUser(), VIEW_PERMISSION);
        return noStore(agent.get("/internal/overview"));
    }

    /** Per-day counts for the overview chart; the agent clamps the window, this only passes it on. */
    @GetMapping("/overview/daily")
    public ResponseEntity<JsonNode> overviewDaily(@RequestParam(defaultValue = "30") int days) {
        require(currentUserService.requireCurrentUser(), VIEW_PERMISSION);
        MultiValueMap<String, String> query = new LinkedMultiValueMap<>();
        query.add("days", String.valueOf(Math.min(Math.max(days, 1), 90)));
        return noStore(agent.get("/internal/overview/daily", query));
    }

    @GetMapping("/backups")
    public ResponseEntity<JsonNode> list(@RequestParam(required = false) String search, @RequestParam(required = false) String status,
                                         @RequestParam(required = false) String type, @RequestParam(required = false) String verification,
                                         @RequestParam(required = false) String startedFrom, @RequestParam(required = false) String startedTo,
                                         @RequestParam(required = false) String checkedFrom, @RequestParam(required = false) String checkedTo,
                                         @RequestParam(defaultValue = "startedAt") String sortBy, @RequestParam(defaultValue = "desc") String sortDirection,
                                         @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit) {
        require(currentUserService.requireCurrentUser(), VIEW_PERMISSION);
        MultiValueMap<String, String> query = new LinkedMultiValueMap<>();
        addIfText(query, "search", search, 200);
        addIfText(query, "status", status, 20);
        addIfText(query, "type", type, 20);
        addIfText(query, "verification", verification, 20);
        addInstant(query, "startedFrom", startedFrom);
        addInstant(query, "startedTo", startedTo);
        addInstant(query, "checkedFrom", checkedFrom);
        addInstant(query, "checkedTo", checkedTo);
        addIfText(query, "sortBy", sortBy, 30);
        addIfText(query, "sortDirection", sortDirection, 4);
        query.add("page", String.valueOf(Math.max(page, 1)));
        query.add("limit", String.valueOf(Math.min(Math.max(limit, 1), 100)));
        return noStore(agent.get("/internal/backups", query));
    }

    @GetMapping("/backups/{backupNumber}")
    public ResponseEntity<JsonNode> get(@PathVariable String backupNumber) {
        require(currentUserService.requireCurrentUser(), VIEW_PERMISSION);
        return noStore(agent.get("/internal/backups/" + validId(backupNumber)));
    }

    @PostMapping("/backups")
    public ResponseEntity<JsonNode> create(@RequestBody CreateBackupRequest request) {
        UserAccount actor = currentUserService.requireCurrentUser();
        require(actor, RUN_PERMISSION);
        String reason = request.reason() == null ? "" : request.reason().trim();
        if (reason.isEmpty() || reason.length() > MAX_REASON) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "BACKUP_REASON_REQUIRED");
        }
        String reference = request.changeControlRef() == null ? "" : request.changeControlRef().trim();
        if (reference.length() > MAX_REFERENCE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "BACKUP_REFERENCE_TOO_LONG");
        }
        String type = request.type() == null || request.type().isBlank() ? "FULL" : request.type().trim();
        if (!BACKUP_TYPES.contains(type)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "BACKUP_TYPE_NOT_ALLOWED");
        }
        if ("PRE_CHANGE".equals(type) && reference.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "BACKUP_CHANGE_REFERENCE_REQUIRED");
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("requestedBy", identity(actor));
        body.put("reason", reason);
        body.put("changeControlRef", reference);
        body.put("type", type);
        JsonNode accepted = agent.post("/internal/backups", body);
        auditTrailService.logAs(actor, "BACKUP", "Backup request", jobId(accepted), "BACKUP_REQUESTED", null, "QUEUED",
                "Requested a " + type + " backup. Reason: " + reason + (reference.isEmpty() ? "" : " (" + reference + ")"));
        return ResponseEntity.status(HttpStatus.ACCEPTED).cacheControl(CacheControl.noStore()).body(accepted);
    }

    @PostMapping("/backups/{backupNumber}/verify")
    public ResponseEntity<JsonNode> verify(@PathVariable String backupNumber) {
        UserAccount actor = currentUserService.requireCurrentUser();
        require(actor, VERIFY_PERMISSION);
        String id = validId(backupNumber);
        JsonNode accepted = agent.post("/internal/backups/" + id + "/verify", Map.of("requestedBy", identity(actor)));
        auditTrailService.logAs(actor, "BACKUP", id, jobId(accepted), "BACKUP_VERIFY_REQUESTED", null, "QUEUED", "Requested an integrity check of " + id);
        return ResponseEntity.status(HttpStatus.ACCEPTED).cacheControl(CacheControl.noStore()).body(accepted);
    }

    @GetMapping("/jobs/{jobId}")
    public ResponseEntity<JsonNode> job(@PathVariable UUID jobId) {
        require(currentUserService.requireCurrentUser(), VIEW_PERMISSION);
        return noStore(agent.get("/internal/jobs/" + jobId));
    }

    @GetMapping("/schedules/rows")
    public ResponseEntity<JsonNode> scheduleRows(@RequestParam(required = false) String search, @RequestParam(required = false) String status,
                                                 @RequestParam(required = false) String type, @RequestParam(required = false) String frequency,
                                                 @RequestParam(defaultValue = "component") String sortBy, @RequestParam(defaultValue = "asc") String sortDirection,
                                                 @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit) {
        require(currentUserService.requireCurrentUser(), VIEW_PERMISSION);
        MultiValueMap<String, String> query = new LinkedMultiValueMap<>();
        addIfText(query, "search", search, 200);
        addIfText(query, "status", status, 20);
        addIfText(query, "type", type, 20);
        addIfText(query, "frequency", frequency, 20);
        addIfText(query, "sortBy", sortBy, 30);
        addIfText(query, "sortDirection", sortDirection, 4);
        query.add("page", String.valueOf(Math.max(page, 1)));
        query.add("limit", String.valueOf(Math.min(Math.max(limit, 1), 100)));
        return noStore(agent.get("/internal/schedules/rows", query));
    }

    @GetMapping("/schedules")
    public ResponseEntity<JsonNode> schedules() {
        require(currentUserService.requireCurrentUser(), VIEW_PERMISSION);
        return noStore(agent.get("/internal/schedules"));
    }

    private void require(UserAccount actor, String permission) {
        if (!permissionEvaluationService.hasAnyPermission(actor, permission)) {
            throw new AccessDeniedException("Permission " + permission + " required");
        }
    }

    private static String identity(UserAccount actor) {
        return actor.getFullName() + " (" + actor.getUsername() + ")";
    }

    /** A backup id is generated by the agent in one fixed shape; anything else never reaches the agent. */
    private static String validId(String backupNumber) {
        if (backupNumber == null || !BACKUP_ID.matcher(backupNumber).matches()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "BACKUP_NOT_FOUND");
        }
        return backupNumber;
    }

    private static UUID jobId(JsonNode accepted) {
        try {
            return UUID.fromString(accepted.path("jobId").asText());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private static void addIfText(MultiValueMap<String, String> query, String name, String value, int max) {
        if (value != null && !value.isBlank()) {
            query.add(name, value.length() > max ? value.substring(0, max) : value);
        }
    }

    /** A date filter must be an ISO instant; anything else is refused instead of being dropped, which would show the wrong rows. */
    private static void addInstant(MultiValueMap<String, String> query, String name, String value) {
        if (value == null || value.isBlank()) return;
        try {
            query.add(name, java.time.Instant.parse(value.trim()).toString());
        } catch (java.time.format.DateTimeParseException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "INVALID_DATE");
        }
    }

    private static <T> ResponseEntity<T> noStore(T body) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body);
    }
}
