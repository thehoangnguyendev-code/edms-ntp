package com.eqms.maintenance;

import com.eqms.entity.AuthSession;
import com.eqms.repository.AuthSessionRepository;
import com.eqms.service.BackupAgentClient;
import com.eqms.service.PermissionEvaluationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpMethod;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Signs everyone out when the window drains (SDS 11.5.2 M3). The gate already refuses every request, so this makes the sign-out real
 * in the database as well: every open session is marked revoked. It runs once per window, and the number revoked goes to the Backup
 * Agent's ledger. Sessions cannot be created again while the window is drained or locked.
 */
@Component
public class MaintenanceSessionRevoker {

    private static final Logger log = LoggerFactory.getLogger(MaintenanceSessionRevoker.class);

    private final BackupAgentClient agent;
    private final AuthSessionRepository sessions;
    private final TransactionTemplate tx;
    private final MaintenanceAdminAlerts alerts;
    private final PermissionEvaluationService permissions;
    private volatile String doneFor;

    public MaintenanceSessionRevoker(BackupAgentClient agent, AuthSessionRepository sessions, TransactionTemplate tx, MaintenanceAdminAlerts alerts,
                                     PermissionEvaluationService permissions) {
        this.agent = agent;
        this.sessions = sessions;
        this.tx = tx;
        this.alerts = alerts;
        this.permissions = permissions;
    }

    @Scheduled(fixedDelay = 5000, initialDelay = 20000)
    public void tick() {
        try {
            revokeIfDrained();
        } catch (RuntimeException e) {
            log.warn("Maintenance sign-out check failed; it will be tried again", e);
        }
    }

    /** @return the number of sessions revoked by this call (0 when nothing to do or already done for this window). */
    public int revokeIfDrained() {
        BackupAgentClient.Reply status = agent.exchange(HttpMethod.GET, "/internal/maintenance", null);
        if (!status.ok()) return 0;
        String state = status.body().path("state").asText("");
        if (!"DRAINED".equals(state) && !state.startsWith("LOCKED")) {
            doneFor = null;
            return 0;
        }
        String requestId = status.body().path("requestId").asText("");
        String windowKey = requestId + "|" + status.body().path("changedAt").asText("");
        if (windowKey.equals(doneFor)) return 0;

        Integer revoked = tx.execute(s -> {
            // the administrator exception (SDS 11.5.3): a person with the bypass keeps the session
            List<AuthSession> open = new ArrayList<>();
            for (AuthSession session : sessions.findAllByRevokedAtIsNull()) {
                if (session.getUser() != null && permissions.hasPermission(session.getUser(), MaintenanceGateFilter.BYPASS_PERMISSION)) continue;
                open.add(session);
            }
            Instant now = Instant.now();
            for (AuthSession session : open) {
                session.setRevokedAt(now);
                session.setStatus(AuthSession.SessionStatus.REVOKED);
            }
            sessions.saveAll(open);
            return open.size();
        });
        int count = revoked == null ? 0 : revoked;
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("event", "MAINTENANCE_SESSIONS_REVOKED");
        body.put("requestId", requestId);
        body.put("by", "system");
        body.put("detail", Map.of("sessionsRevoked", count, "state", state));
        BackupAgentClient.Reply recorded = agent.exchange(HttpMethod.POST, "/internal/maintenance/event", body);
        if (!recorded.ok()) {
            // the ledger did not take it: leave the window open for a retry, so the record is not lost
            log.warn("The sign-out of {} sessions could not be recorded in the ledger; it will be retried", count);
            return count;
        }
        doneFor = windowKey;
        log.info("Maintenance window {} drained: {} session(s) signed out", requestId, count);
        try {
            alerts.drained(requestId, count);
        } catch (RuntimeException e) {
            // the window and the sign-out stand; the administrators are told by the log only in this case
            log.error("The administrators could not be told that window {} drained", requestId, e);
        }
        return count;
    }
}
