package com.eqms.maintenance;

import com.eqms.service.BackupAgentClient;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * The maintenance window (SDS 11.5, 11.6). The Super Administrator is not an eQMS user: the password is checked by the Backup
 * Agent, which holds the account, and a Maintenance Pass is issued for the window. Every action here needs that pass.
 */
@RestController
@RequestMapping("/system")
public class MaintenanceController {

    private static final ObjectMapper JSON = new ObjectMapper();

    public record Credentials(String username, String password) {
    }

    public record NoticeBody(Integer minutes, String requestId) {
    }

    public record LockBody(boolean noUserConfirmed) {
    }

    private final BackupAgentClient agent;
    private final MaintenancePassService passes;
    private final MaintenanceGateFilter gate;
    private final MaintenanceAnnouncements announcements;
    private final com.eqms.service.SystemConfigurationService configuration;
    private final com.eqms.auth.CurrentUserService currentUser;
    private final com.eqms.service.PermissionEvaluationService permissions;
    private final com.eqms.service.SignatureTokenConsumptionService signatures;

    public MaintenanceController(BackupAgentClient agent, MaintenancePassService passes, MaintenanceGateFilter gate, MaintenanceAnnouncements announcements,
                                 com.eqms.service.SystemConfigurationService configuration, com.eqms.auth.CurrentUserService currentUser,
                                 com.eqms.service.PermissionEvaluationService permissions, com.eqms.service.SignatureTokenConsumptionService signatures) {
        this.agent = agent;
        this.passes = passes;
        this.gate = gate;
        this.announcements = announcements;
        this.configuration = configuration;
        this.currentUser = currentUser;
        this.permissions = permissions;
        this.signatures = signatures;
    }

    /**
     * Who is operating the window. Either the Maintenance Pass of the Super Administrator (the original path), or an eQMS session of a
     * person who holds the maintenance bypass together with a fresh electronic signature for this action (SDS 11.5, decision of
     * 2026-10-10). Returns the name of the operator, or null when neither is valid.
     */
    private String operator(String pass, String signatureToken) {
        String by = passes.verify(pass).orElse(null);
        if (by != null) return by;
        if (!org.springframework.util.StringUtils.hasText(signatureToken)) return null;
        try {
            com.eqms.entity.UserAccount user = currentUser.requireCurrentUser();
            if (!permissions.hasPermission(user, MaintenanceGateFilter.BYPASS_PERMISSION)) return null;
            signatures.requireAndConsume(signatureToken, user);
            return user.getUsername();
        } catch (RuntimeException e) {
            return null;
        }
    }

    /** The window itself has already changed; a failed announcement is logged, it does not undo or hide the change. */
    private static void safely(Runnable step) {
        try {
            step.run();
        } catch (RuntimeException e) {
            org.slf4j.LoggerFactory.getLogger(MaintenanceController.class).error("The maintenance announcement could not be written", e);
        }
    }

    private ResponseEntity<JsonNode> reply(BackupAgentClient.Reply reply) {
        return ResponseEntity.status(reply.status()).cacheControl(CacheControl.noStore()).body(reply.body());
    }

    /** Public, so the login page and every screen can show the state. Falls back to the lock file when the agent is unreachable. */
    @GetMapping("/maintenance-status")
    public ResponseEntity<Map<String, Object>> status() {
        Map<String, Object> out = new LinkedHashMap<>();
        BackupAgentClient.Reply reply = agent.exchange(HttpMethod.GET, "/internal/maintenance", null);
        if (reply.ok()) {
            out.put("state", reply.body().path("state").asText());
            out.put("endsAt", reply.body().path("endsAt").isNull() ? null : reply.body().path("endsAt").asText());
            out.put("serverNow", Instant.now().toString());
            out.put("source", "agent");
        } else {
            out.put("state", gate.isLocked() ? "LOCKED" : "UNKNOWN");
            out.put("endsAt", null);
            out.put("serverNow", Instant.now().toString());
            out.put("source", "lock-file");
        }
        out.put("locked", gate.isLocked());
        // the switch in System Administration > Configuration > General: when on, ordinary users see the maintenance page
        // whatever the window is doing; the page uses this to know whether it may leave when the window is open again
        out.put("manual", manualSwitch());
        return noStore(out);
    }

    /** A public read must not fail because the configuration cannot be read; the switch is then taken as off, and the window still applies. */
    private boolean manualSwitch() {
        try {
            return configuration.isMaintenanceModeEnabled();
        } catch (RuntimeException e) {
            org.slf4j.LoggerFactory.getLogger(MaintenanceController.class).warn("The maintenance switch could not be read", e);
            return false;
        }
    }

    /** The Super Administrator signs in here. A wrong user and a wrong password get the same answer. */
    @PostMapping("/maintenance/login")
    public ResponseEntity<Map<String, Object>> login(@RequestBody Credentials credentials) {
        if (!passes.configured()) {
            return noStore(Map.of("code", "MAINTENANCE_NOT_CONFIGURED", "message", "The maintenance pass is not configured on this server"), HttpStatus.SERVICE_UNAVAILABLE);
        }
        String username = credentials == null || credentials.username() == null ? "" : credentials.username().trim();
        String password = credentials == null || credentials.password() == null ? "" : credentials.password();
        if (username.isEmpty() || password.isEmpty() || username.length() > 80 || password.length() > 200) {
            return noStore(Map.of("code", "INVALID_CREDENTIALS", "message", "The user name or password is wrong"), HttpStatus.UNAUTHORIZED);
        }
        BackupAgentClient.Reply verified = agent.exchange(HttpMethod.POST, "/internal/super-admin/verify", Map.of("username", username, "password", password));
        if (verified.status() == HttpStatus.TOO_MANY_REQUESTS.value()) {
            return noStore(Map.of("code", "SUPER_ADMIN_LOCKED", "message", "Too many failed sign-in attempts. Wait 15 minutes and try again."), HttpStatus.TOO_MANY_REQUESTS);
        }
        if (!verified.ok()) {
            return noStore(Map.of("code", "INVALID_CREDENTIALS", "message", "The user name or password is wrong"), HttpStatus.UNAUTHORIZED);
        }
        MaintenancePassService.Issued pass = passes.issue(username.toLowerCase());
        return noStore(Map.of("pass", pass.token(), "username", username.toLowerCase(), "expiresAt", pass.expiresAt().toString()));
    }

    @GetMapping("/maintenance/current")
    public ResponseEntity<JsonNode> current(@RequestHeader(value = "X-Maintenance-Pass", required = false) String pass) {
        return forward(pass, HttpMethod.GET, "/internal/maintenance", null);
    }

    @PostMapping("/maintenance/notice")
    public ResponseEntity<JsonNode> notice(@RequestHeader(value = "X-Maintenance-Pass", required = false) String pass,
                                           @RequestHeader(value = "X-Signature-Token", required = false) String signatureToken, @RequestBody NoticeBody body) {
        String by = operator(pass, signatureToken);
        if (by == null) return refused();
        if (body == null || body.minutes() == null) return problem(HttpStatus.BAD_REQUEST, "MAINTENANCE_NOTICE_OUT_OF_RANGE", "The notice must be between 5 and 240 minutes");
        BackupAgentClient.Reply reply = agent.exchange(HttpMethod.POST, "/internal/maintenance/notice",
                Map.of("minutes", body.minutes(), "requestId", body.requestId() == null ? "" : body.requestId(), "by", by));
        if (reply.ok() && reply.body().path("endsAt").isTextual()) {
            // everyone is told through System Announcements (SDS 11.5.2 M1); the announcement ends after the window
            safely(() -> announcements.noticeStarted(reply.body().path("requestId").asText(), body.minutes(),
                    Instant.parse(reply.body().path("endsAt").asText()), by));
        }
        return reply(reply);
    }

    @PostMapping("/maintenance/cancel")
    public ResponseEntity<JsonNode> cancel(@RequestHeader(value = "X-Maintenance-Pass", required = false) String pass,
                                           @RequestHeader(value = "X-Signature-Token", required = false) String signatureToken) {
        String by = operator(pass, signatureToken);
        if (by == null) return refused();
        BackupAgentClient.Reply reply = agent.exchange(HttpMethod.POST, "/internal/maintenance/cancel", Map.of("by", by));
        if (reply.ok()) safely(() -> announcements.cancelled(reply.body().path("requestId").asText(), by));
        return reply(reply);
    }

    @PostMapping("/maintenance/lock")
    public ResponseEntity<JsonNode> lock(@RequestHeader(value = "X-Maintenance-Pass", required = false) String pass,
                                         @RequestHeader(value = "X-Signature-Token", required = false) String signatureToken, @RequestBody LockBody body) {
        String by = operator(pass, signatureToken);
        if (by == null) return refused();
        return forwardBy(by, HttpMethod.POST, "/internal/maintenance/lock", Map.of("by", by, "noUserConfirmed", body != null && body.noUserConfirmed()));
    }

    @PostMapping("/maintenance/unlock")
    public ResponseEntity<JsonNode> unlock(@RequestHeader(value = "X-Maintenance-Pass", required = false) String pass,
                                           @RequestHeader(value = "X-Signature-Token", required = false) String signatureToken) {
        String by = operator(pass, signatureToken);
        if (by == null) return refused();
        BackupAgentClient.Reply reply = agent.exchange(HttpMethod.POST, "/internal/maintenance/unlock", Map.of("by", by));
        if (reply.ok()) safely(() -> announcements.reopened(reply.body().path("requestId").asText(), by));
        return reply(reply);
    }

    private ResponseEntity<JsonNode> forward(String pass, HttpMethod method, String path, Object body) {
        String by = passes.verify(pass).orElse(null);
        if (by == null) return refused();
        return forwardBy(by, method, path, body);
    }

    private ResponseEntity<JsonNode> forwardBy(String by, HttpMethod method, String path, Object body) {
        BackupAgentClient.Reply reply = agent.exchange(method, path, body instanceof Map<?, ?> m ? castMap(m) : null);
        return ResponseEntity.status(reply.status()).cacheControl(CacheControl.noStore()).body(reply.body());
    }

    private static Map<String, Object> castMap(Map<?, ?> m) {
        Map<String, Object> out = new LinkedHashMap<>();
        m.forEach((k, v) -> out.put(String.valueOf(k), v));
        return out;
    }

    private static ResponseEntity<JsonNode> problem(HttpStatus status, String code, String message) {
        return ResponseEntity.status(status).cacheControl(CacheControl.noStore()).body(JSON.createObjectNode().put("code", code).put("message", message));
    }

    private static ResponseEntity<JsonNode> refused() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).cacheControl(CacheControl.noStore())
                .body(JSON.createObjectNode().put("code", "MAINTENANCE_PASS_REQUIRED").put("message", "A valid maintenance pass is required"));
    }

    private static ResponseEntity<Map<String, Object>> noStore(Map<String, Object> body) {
        return noStore(body, HttpStatus.OK);
    }

    private static ResponseEntity<Map<String, Object>> noStore(Map<String, Object> body, HttpStatus status) {
        return ResponseEntity.status(status).cacheControl(CacheControl.noStore()).body(body);
    }
}
