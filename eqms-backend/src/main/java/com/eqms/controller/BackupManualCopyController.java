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
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * The copy of the backups that a person makes by hand (the third copy of the 3-2-1 rule). The Backup Agent cannot see it, so the person
 * records it here. Viewing needs backup.admin.storage.view; recording needs backup.admin.manual_copy.manage.
 */
@RestController
@RequestMapping("/backup-restore/manual-copies")
public class BackupManualCopyController {

    static final String VIEW = "backup.admin.storage.view";
    static final String MANAGE = "backup.admin.manual_copy.manage";

    public record RecordBody(String copiedOn, String backupNumber, String place, String madeBy, String note) {
    }

    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissions;
    private final BackupAgentClient agent;
    private final AuditTrailService audit;

    public BackupManualCopyController(CurrentUserService currentUserService, PermissionEvaluationService permissions, BackupAgentClient agent, AuditTrailService audit) {
        this.currentUserService = currentUserService;
        this.permissions = permissions;
        this.agent = agent;
        this.audit = audit;
    }

    @GetMapping("/status")
    public ResponseEntity<JsonNode> status() {
        require(currentUserService.requireCurrentUser(), VIEW);
        return reply(agent.exchange(HttpMethod.GET, "/internal/manual-copies/status", null));
    }

    @GetMapping
    public ResponseEntity<JsonNode> list(@RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit) {
        require(currentUserService.requireCurrentUser(), VIEW);
        return reply(agent.exchange(HttpMethod.GET, "/internal/manual-copies?page=" + Math.max(page, 1) + "&limit=" + Math.min(Math.max(limit, 1), 100), null));
    }

    @PostMapping
    public ResponseEntity<JsonNode> record(@RequestBody RecordBody body) {
        UserAccount actor = currentUserService.requireCurrentUser();
        require(actor, MANAGE);
        if (body == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "MANUAL_COPY_DATE_REQUIRED");
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("copiedOn", cut(body.copiedOn(), 10));
        out.put("backupNumber", cut(body.backupNumber(), 40));
        out.put("place", cut(body.place(), 201));
        out.put("madeBy", cut(body.madeBy(), 121));
        out.put("note", cut(body.note(), 1001));
        out.put("by", actor.getUsername());
        BackupAgentClient.Reply reply = agent.exchange(HttpMethod.POST, "/internal/manual-copies", out);
        if (reply.ok()) {
            String id = reply.body().path("id").asText("");
            audit.logAs(actor, "BACKUP_MANUAL_COPY", id, BackupAuditIds.of("manual-copy", id), "MANUAL_COPY_RECORDED", null, "RECORDED",
                    "Recorded a manual copy made on " + out.get("copiedOn") + " at " + out.get("place") + " by " + out.get("madeBy")
                            + (out.get("backupNumber") == null ? "" : ", holding up to " + out.get("backupNumber")));
        }
        return reply(reply);
    }

    private void require(UserAccount actor, String permission) {
        if (!permissions.hasAnyPermission(actor, permission)) {
            throw new AccessDeniedException("Permission " + permission + " required");
        }
    }

    private static String cut(String value, int max) {
        if (value == null) return null;
        String t = value.trim();
        return t.length() > max ? t.substring(0, max) : t;
    }

    private static ResponseEntity<JsonNode> reply(BackupAgentClient.Reply reply) {
        return ResponseEntity.status(reply.status()).cacheControl(CacheControl.noStore()).body(reply.body());
    }
}
