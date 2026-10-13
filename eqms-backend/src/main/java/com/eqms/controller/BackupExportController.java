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
 * Export Backup Set and the Offline Media Register. The backend decides who may ask, approve or look after media and records every
 * step in the audit trail; the Backup Agent builds the package and enforces the two-person rule. A package is never sent through
 * the browser: nothing here returns backup data, only the record of what was exported where.
 */
@RestController
@RequestMapping("/backup-restore")
public class BackupExportController {

    static final String VIEW = "backup.module.view";
    static final String EXPORT = "backup.backup.export";
    static final String APPROVE = "backup.backup.export.approve";
    static final String MEDIA_VIEW = "backup.admin.storage.view";
    static final String MEDIA_MANAGE = "backup.media.manage";

    private static final Pattern BACKUP_ID = Pattern.compile("^BK-\\d{8}-\\d{4}-\\d{4}$");
    private static final Pattern EXPORT_ID = Pattern.compile("^EXP-\\d{8}-\\d{4}$");
    private static final int MAX_TEXT = 500;

    public record ExportRequest(UUID mediaId, String reason) {
    }

    public record DecisionRequest(String reason) {
    }

    public record MediaRequest(String label, String serialNumber, String kind, Long capacityBytes, String exportDir, String expiresOn) {
    }

    public record HandoverRequest(String holder, String location) {
    }

    public record ReadTestRequest(String result, String detail) {
    }

    public record RecycleRequest(Boolean wipeConfirmed, String reason) {
    }

    public record RetireRequest(String destructionRecord) {
    }

    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissionEvaluationService;
    private final BackupAgentClient agent;
    private final AuditTrailService audit;

    public BackupExportController(CurrentUserService currentUserService, PermissionEvaluationService permissionEvaluationService,
                                  BackupAgentClient agent, AuditTrailService audit) {
        this.currentUserService = currentUserService;
        this.permissionEvaluationService = permissionEvaluationService;
        this.agent = agent;
        this.audit = audit;
    }

    // ------------------------------------------------------------------ exports

    @GetMapping("/exports")
    public ResponseEntity<JsonNode> exportList(@RequestParam(required = false) String search, @RequestParam(required = false) String status,
                                               @RequestParam(required = false) String backupId,
                                               @RequestParam(defaultValue = "requestedAt") String sortBy, @RequestParam(defaultValue = "desc") String sortDirection,
                                               @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit) {
        require(currentUserService.requireCurrentUser(), VIEW);
        UriComponentsBuilder uri = UriComponentsBuilder.fromPath("/internal/exports");
        Map<String, Object> vars = new LinkedHashMap<>();
        text(uri, vars, "search", search, 200);
        text(uri, vars, "status", status, 20);
        if (backupId != null && !backupId.isBlank()) text(uri, vars, "backupId", validBackupId(backupId), 30);
        paging(uri, vars, sortBy, sortDirection, page, limit);
        return reply(agent.exchange(HttpMethod.GET, uri.buildAndExpand(vars).encode().toUriString(), null));
    }

    @GetMapping("/exports/{exportId}")
    public ResponseEntity<JsonNode> exportGet(@PathVariable String exportId) {
        require(currentUserService.requireCurrentUser(), VIEW);
        return reply(agent.exchange(HttpMethod.GET, "/internal/exports/" + validExportId(exportId), null));
    }

    @GetMapping("/backups/{backupId}/export-estimate")
    public ResponseEntity<JsonNode> estimate(@PathVariable String backupId) {
        require(currentUserService.requireCurrentUser(), EXPORT);
        return reply(agent.exchange(HttpMethod.GET, "/internal/backups/" + validBackupId(backupId) + "/export-estimate", null));
    }

    @PostMapping("/backups/{backupId}/exports")
    public ResponseEntity<JsonNode> request(@PathVariable String backupId, @RequestBody ExportRequest request) {
        UserAccount actor = currentUserService.requireCurrentUser();
        require(actor, EXPORT);
        String id = validBackupId(backupId);
        if (request == null || request.mediaId() == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "EXPORT_MEDIA_REQUIRED");
        String reason = reason(request.reason(), "EXPORT_REASON_REQUIRED");
        BackupAgentClient.Reply reply = agent.exchange(HttpMethod.POST, "/internal/backups/" + id + "/exports",
                body("mediaId", request.mediaId().toString(), "reason", reason, "by", actor.getUsername()));
        if (reply.ok()) {
            audit.logAs(actor, "BACKUP_EXPORT", reply.body().path("exportId").asText(), uuid(reply.body().path("id").asText()), "BACKUP_EXPORT_REQUESTED", null, "REQUESTED",
                    "Asked to export " + id + " to medium " + reply.body().path("mediaLabel").asText() + ". Reason: " + reason);
        }
        return reply(reply);
    }

    @PostMapping("/exports/{exportId}/approve")
    public ResponseEntity<JsonNode> approve(@PathVariable String exportId) {
        UserAccount actor = currentUserService.requireCurrentUser();
        require(actor, APPROVE);
        String id = validExportId(exportId);
        // The audit row needs the export's own id; a refusal body carries none, so it is read first, from the agent.
        BackupAgentClient.Reply current = agent.exchange(HttpMethod.GET, "/internal/exports/" + id, null);
        UUID exportUuid = current.ok() ? uuid(current.body().path("id").asText()) : null;
        BackupAgentClient.Reply reply = agent.exchange(HttpMethod.POST, "/internal/exports/" + id + "/approve", body("by", actor.getUsername()));
        if (exportUuid != null) {
            audit.logAs(actor, "BACKUP_EXPORT", id, exportUuid, reply.ok() ? "BACKUP_EXPORT_APPROVED" : "BACKUP_EXPORT_APPROVAL_REFUSED", "REQUESTED",
                    reply.ok() ? "APPROVED" : "REQUESTED", reply.ok() ? "Approved export " + id : "Approval refused: " + reply.body().path("code").asText("UNKNOWN"));
        }
        return reply(reply);
    }

    @PostMapping("/exports/{exportId}/reject")
    public ResponseEntity<JsonNode> reject(@PathVariable String exportId, @RequestBody DecisionRequest request) {
        UserAccount actor = currentUserService.requireCurrentUser();
        require(actor, APPROVE);
        String id = validExportId(exportId);
        String reason = reason(request == null ? null : request.reason(), "EXPORT_REASON_REQUIRED");
        BackupAgentClient.Reply reply = agent.exchange(HttpMethod.POST, "/internal/exports/" + id + "/reject", body("by", actor.getUsername(), "reason", reason));
        if (reply.ok()) {
            audit.logAs(actor, "BACKUP_EXPORT", id, uuid(reply.body().path("id").asText()), "BACKUP_EXPORT_REJECTED", "REQUESTED", "REJECTED", "Rejected export " + id + ". Reason: " + reason);
        }
        return reply(reply);
    }

    // ------------------------------------------------------------------ media

    @GetMapping("/media")
    public ResponseEntity<JsonNode> mediaList(@RequestParam(required = false) String search, @RequestParam(required = false) String status,
                                              @RequestParam(required = false) String kind,
                                              @RequestParam(defaultValue = "label") String sortBy, @RequestParam(defaultValue = "asc") String sortDirection,
                                              @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit) {
        require(currentUserService.requireCurrentUser(), MEDIA_VIEW, MEDIA_MANAGE, EXPORT);
        UriComponentsBuilder uri = UriComponentsBuilder.fromPath("/internal/media");
        Map<String, Object> vars = new LinkedHashMap<>();
        text(uri, vars, "search", search, 200);
        text(uri, vars, "status", status, 20);
        text(uri, vars, "kind", kind, 10);
        paging(uri, vars, sortBy, sortDirection, page, limit);
        return reply(agent.exchange(HttpMethod.GET, uri.buildAndExpand(vars).encode().toUriString(), null));
    }

    @GetMapping("/media/{id}")
    public ResponseEntity<JsonNode> mediaGet(@PathVariable UUID id) {
        require(currentUserService.requireCurrentUser(), MEDIA_VIEW, MEDIA_MANAGE);
        return reply(agent.exchange(HttpMethod.GET, "/internal/media/" + id, null));
    }

    @GetMapping("/media/{id}/events")
    public ResponseEntity<JsonNode> mediaEvents(@PathVariable UUID id) {
        require(currentUserService.requireCurrentUser(), MEDIA_VIEW, MEDIA_MANAGE);
        return reply(agent.exchange(HttpMethod.GET, "/internal/media/" + id + "/events", null));
    }

    @GetMapping("/media/{id}/packages")
    public ResponseEntity<JsonNode> mediaPackages(@PathVariable UUID id) {
        require(currentUserService.requireCurrentUser(), MEDIA_VIEW, MEDIA_MANAGE);
        return reply(agent.exchange(HttpMethod.GET, "/internal/media/" + id + "/packages", null));
    }

    @PostMapping("/media")
    public ResponseEntity<JsonNode> register(@RequestBody MediaRequest request) {
        UserAccount actor = currentUserService.requireCurrentUser();
        require(actor, MEDIA_MANAGE);
        Map<String, Object> body = body("by", actor.getUsername());
        body.put("label", clip(request.label(), 60));
        body.put("serialNumber", clip(request.serialNumber(), 120));
        body.put("kind", clip(request.kind(), 10));
        body.put("capacityBytes", request.capacityBytes());
        body.put("exportDir", clip(request.exportDir(), 64));
        body.put("expiresOn", clip(request.expiresOn(), 10));
        BackupAgentClient.Reply reply = agent.exchange(HttpMethod.POST, "/internal/media", body);
        if (reply.ok()) {
            audit.logAs(actor, "OFFLINE_MEDIA", reply.body().path("label").asText(), uuid(reply.body().path("id").asText()), "OFFLINE_MEDIA_REGISTERED", null, "AVAILABLE",
                    "Registered offline medium " + reply.body().path("label").asText() + " (" + reply.body().path("kind").asText() + ")");
        }
        return reply(reply);
    }

    @PostMapping("/media/{id}/handover")
    public ResponseEntity<JsonNode> handover(@PathVariable UUID id, @RequestBody HandoverRequest request) {
        UserAccount actor = currentUserService.requireCurrentUser();
        require(actor, MEDIA_MANAGE);
        BackupAgentClient.Reply reply = agent.exchange(HttpMethod.POST, "/internal/media/" + id + "/handover",
                body("holder", clip(request.holder(), 120), "location", clip(request.location(), 200), "by", actor.getUsername()));
        mediaAudit(actor, id, reply, "OFFLINE_MEDIA_HANDED_OVER", "IN_TRANSIT", "Recorded the handover of the medium to " + request.holder() + " at " + request.location());
        return reply(reply);
    }

    @PostMapping("/media/{id}/receive")
    public ResponseEntity<JsonNode> receive(@PathVariable UUID id) {
        UserAccount actor = currentUserService.requireCurrentUser();
        require(actor, MEDIA_MANAGE);
        BackupAgentClient.Reply reply = agent.exchange(HttpMethod.POST, "/internal/media/" + id + "/receive", body("by", actor.getUsername()));
        mediaAudit(actor, id, reply, "OFFLINE_MEDIA_RECEIVED", "STORED_OFFSITE", "Confirmed receipt of the medium");
        return reply(reply);
    }

    @PostMapping("/media/{id}/read-test")
    public ResponseEntity<JsonNode> readTest(@PathVariable UUID id, @RequestBody ReadTestRequest request) {
        UserAccount actor = currentUserService.requireCurrentUser();
        require(actor, MEDIA_MANAGE);
        BackupAgentClient.Reply reply = agent.exchange(HttpMethod.POST, "/internal/media/" + id + "/read-test",
                body("result", clip(request.result(), 10), "detail", clip(request.detail(), MAX_TEXT), "by", actor.getUsername()));
        mediaAudit(actor, id, reply, "OFFLINE_MEDIA_READ_TESTED", reply.body().path("status").asText(null), "Read test " + request.result() + ": " + clip(request.detail(), MAX_TEXT));
        return reply(reply);
    }

    @PostMapping("/media/{id}/recycle")
    public ResponseEntity<JsonNode> recycle(@PathVariable UUID id, @RequestBody RecycleRequest request) {
        UserAccount actor = currentUserService.requireCurrentUser();
        require(actor, MEDIA_MANAGE);
        BackupAgentClient.Reply reply = agent.exchange(HttpMethod.POST, "/internal/media/" + id + "/recycle",
                body("wipeConfirmed", Boolean.TRUE.equals(request.wipeConfirmed()), "reason", clip(request.reason(), MAX_TEXT), "by", actor.getUsername()));
        mediaAudit(actor, id, reply, "OFFLINE_MEDIA_RECYCLED", "AVAILABLE", "Medium wiped and returned to use. Reason: " + clip(request.reason(), MAX_TEXT));
        return reply(reply);
    }

    @PostMapping("/media/{id}/retire")
    public ResponseEntity<JsonNode> retire(@PathVariable UUID id, @RequestBody RetireRequest request) {
        UserAccount actor = currentUserService.requireCurrentUser();
        require(actor, MEDIA_MANAGE);
        BackupAgentClient.Reply reply = agent.exchange(HttpMethod.POST, "/internal/media/" + id + "/retire",
                body("destructionRecord", clip(request.destructionRecord(), 1000), "by", actor.getUsername()));
        mediaAudit(actor, id, reply, "OFFLINE_MEDIA_RETIRED", "RETIRED", "Medium retired. Destruction record: " + clip(request.destructionRecord(), 1000));
        return reply(reply);
    }

    // ------------------------------------------------------------------ helpers

    private void mediaAudit(UserAccount actor, UUID id, BackupAgentClient.Reply reply, String action, String toStatus, String comment) {
        if (reply.ok()) {
            audit.logAs(actor, "OFFLINE_MEDIA", reply.body().path("label").asText(), id, action, null, toStatus, comment);
        }
    }

    private void require(UserAccount actor, String... permissions) {
        if (!permissionEvaluationService.hasAnyPermission(actor, permissions)) {
            throw new AccessDeniedException("Permission " + permissions[0] + " required");
        }
    }

    private static String validBackupId(String id) {
        if (id == null || !BACKUP_ID.matcher(id).matches()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "BACKUP_NOT_FOUND");
        return id;
    }

    private static String validExportId(String id) {
        if (id == null || !EXPORT_ID.matcher(id).matches()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "EXPORT_NOT_FOUND");
        return id;
    }

    private static String reason(String text, String code) {
        String reason = text == null ? "" : text.trim();
        if (reason.isEmpty() || reason.length() > MAX_TEXT) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, code);
        return reason;
    }

    private static String clip(String value, int max) {
        if (value == null) return null;
        String t = value.trim();
        return t.length() > max ? t.substring(0, max) : t;
    }

    private static void text(UriComponentsBuilder uri, Map<String, Object> vars, String name, String value, int max) {
        if (value == null || value.isBlank()) return;
        uri.queryParam(name, "{" + name + "}");
        vars.put(name, clip(value, max));
    }

    private static void paging(UriComponentsBuilder uri, Map<String, Object> vars, String sortBy, String sortDirection, int page, int limit) {
        uri.queryParam("sortBy", "{sortBy}").queryParam("sortDirection", "{sortDirection}").queryParam("page", Math.max(page, 1)).queryParam("limit", Math.min(Math.max(limit, 1), 100));
        vars.put("sortBy", clip(sortBy, 30));
        vars.put("sortDirection", "asc".equalsIgnoreCase(sortDirection) ? "asc" : "desc");
    }

    private static Map<String, Object> body(Object... pairs) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i < pairs.length; i += 2) m.put((String) pairs[i], pairs[i + 1]);
        return m;
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
