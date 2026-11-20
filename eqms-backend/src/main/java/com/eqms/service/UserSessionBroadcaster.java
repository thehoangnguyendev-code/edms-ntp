package com.eqms.service;

import com.eqms.entity.UserAccount;
import com.eqms.repository.UserAccountRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;

/**
 * Tells the people who may open "Logged in Users" that a session started, ended or was locked, so the screen
 * refreshes itself instead of staying stale until a manual reload.
 *
 * <ul>
 *   <li><b>Scoped:</b> the signal goes only to connected users who hold {@value #VIEW_PERMISSION}, never to every
 *       client. It carries only the entity type and the session id; the screen reads the rows again through its
 *       own authorised API, so nobody learns anything they could not already read.</li>
 *   <li><b>After commit, once per transaction:</b> a rolled-back change is never announced, and a flurry of saves
 *       in one transaction is one signal.</li>
 *   <li><b>Rate-limited:</b> at most one signal per {@value #MIN_INTERVAL_MS} ms; a login storm cannot flood the
 *       admins' screens. A signal skipped inside the window is not lost: the screen also refreshes on a slow timer.</li>
 *   <li><b>Cheap:</b> who may view is decided once per user and kept for {@value #VIEWER_CACHE_MS} ms; it only decides who
 *       receives an invalidation signal, the data itself is always authorised on read.</li>
 * </ul>
 */
@Component
public class UserSessionBroadcaster {

    static final String VIEW_PERMISSION = "settings.user.view";
    static final String ENTITY_TYPE = "USER_SESSION";
    static final long MIN_INTERVAL_MS = 1_000;
    static final long VIEWER_CACHE_MS = 30_000;

    private static final Logger log = LoggerFactory.getLogger(UserSessionBroadcaster.class);
    private static final Object PENDING_KEY = new Object();
    private static volatile UserSessionBroadcaster instance;

    private final NotificationRealtimeService realtime;
    private final UserAccountRepository users;
    private final PermissionEvaluationService permissions;

    private final AtomicLong lastSentAtMs = new AtomicLong();
    private final java.util.concurrent.ConcurrentHashMap<UUID, Boolean> decisions = new java.util.concurrent.ConcurrentHashMap<>();
    private volatile long decisionsFromMs;

    public UserSessionBroadcaster(NotificationRealtimeService realtime, UserAccountRepository users, PermissionEvaluationService permissions) {
        this.realtime = realtime;
        this.users = users;
        this.permissions = permissions;
        instance = this;
    }

    /** Called from the JPA listener of the session entity; safe to call when there is no Spring context (tests). */
    public static void changed(UUID sessionId) {
        UserSessionBroadcaster broadcaster = instance;
        if (broadcaster == null || sessionId == null) return;
        try {
            broadcaster.register(sessionId);
        } catch (RuntimeException ex) {
            log.debug("Could not queue the session change signal for {}", sessionId, ex);
        }
    }

    private void register(UUID sessionId) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            publish(sessionId);
            return;
        }
        if (TransactionSynchronizationManager.hasResource(PENDING_KEY)) return; // one signal per transaction
        TransactionSynchronizationManager.bindResource(PENDING_KEY, sessionId);
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                publish(sessionId);
            }

            @Override
            public void afterCompletion(int status) {
                if (TransactionSynchronizationManager.hasResource(PENDING_KEY)) {
                    TransactionSynchronizationManager.unbindResource(PENDING_KEY);
                }
            }
        });
    }

    void publish(UUID sessionId) {
        long now = System.currentTimeMillis();
        long previous = lastSentAtMs.get();
        if (now - previous < MIN_INTERVAL_MS || !lastSentAtMs.compareAndSet(previous, now)) return;
        Set<UUID> viewers = viewers(now);
        if (viewers.isEmpty()) return;
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("entityType", ENTITY_TYPE);
        payload.put("id", sessionId.toString());
        payload.put("occurredAt", Instant.now().toString());
        realtime.publishEventToUsers(viewers, "entity-changed", payload);
    }

    /**
     * Connected users who may open the screen. A decision is kept for {@value #VIEWER_CACHE_MS} ms; a user who has just
     * connected is evaluated at once, so nobody waits for the cache to expire to start receiving signals.
     */
    private Set<UUID> viewers(long now) {
        if (now - decisionsFromMs > VIEWER_CACHE_MS) {
            decisions.clear();
            decisionsFromMs = now;
        }
        Set<UUID> connected = realtime.connectedUserIds();
        List<UUID> unknown = connected.stream().filter(id -> !decisions.containsKey(id)).toList();
        if (!unknown.isEmpty()) {
            Set<UUID> found = new java.util.HashSet<>();
            for (UserAccount user : users.findAllById(unknown)) {
                found.add(user.getId());
                decisions.put(user.getId(), permissions.hasPermission(user, VIEW_PERMISSION));
            }
            unknown.stream().filter(id -> !found.contains(id)).forEach(id -> decisions.put(id, false));
        }
        return connected.stream().filter(id -> Boolean.TRUE.equals(decisions.get(id))).collect(Collectors.toSet());
    }
}
