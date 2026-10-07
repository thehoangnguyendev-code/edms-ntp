package com.eqms.service;

import com.eqms.entity.UserAccount;
import com.eqms.repository.UserAccountRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Keeps the "System monitoring" cards of the administrative dashboard up to date without a Refresh button or a browser timer,
 * over the existing server-sent-events stream.
 *
 * <p>Like every realtime event of this system ({@link EntityChangeBroadcaster}) the event carries no data: it only says "the
 * figures moved on", and the screen reads them through its own authorised API ({@code GET /dashboard/system-monitoring}). It is sent
 * only to connected users who hold {@code dashboard.admin.view}, never broadcast to everybody, and only while such a user is
 * connected, so an idle system does no work. The permission is looked up at most once a minute per user.</p>
 */
@Service
public class SystemMonitoringRealtimeService {

    private static final Logger log = LoggerFactory.getLogger(SystemMonitoringRealtimeService.class);

    public static final String EVENT = "system-monitoring-changed";
    static final String PERMISSION = "dashboard.admin.view";
    static final long PUSH_INTERVAL_MS = 10_000;
    private static final long PERMISSION_CACHE_MS = 60_000;

    private record CachedPermission(boolean allowed, long expiresAt) {
    }

    private final NotificationRealtimeService realtimeService;
    private final UserAccountRepository userRepository;
    private final PermissionEvaluationService permissionEvaluationService;
    private final Clock clock;
    private final ConcurrentHashMap<UUID, CachedPermission> permissions = new ConcurrentHashMap<>();

    /** The constructor Spring uses; the one below only lets a test fix the clock. With two constructors Spring needs this marker. */
    @Autowired
    public SystemMonitoringRealtimeService(
            NotificationRealtimeService realtimeService,
            UserAccountRepository userRepository,
            PermissionEvaluationService permissionEvaluationService
    ) {
        this(realtimeService, userRepository, permissionEvaluationService, Clock.systemUTC());
    }

    SystemMonitoringRealtimeService(
            NotificationRealtimeService realtimeService,
            UserAccountRepository userRepository,
            PermissionEvaluationService permissionEvaluationService,
            Clock clock
    ) {
        this.realtimeService = realtimeService;
        this.userRepository = userRepository;
        this.permissionEvaluationService = permissionEvaluationService;
        this.clock = clock;
    }

    @Scheduled(fixedDelay = PUSH_INTERVAL_MS, initialDelay = PUSH_INTERVAL_MS)
    public void push() {
        try {
            long now = clock.millis();
            var connected = realtimeService.connectedUserIds();
            permissions.keySet().retainAll(connected);
            for (UUID userId : connected) {
                if (mayWatch(userId, now)) {
                    realtimeService.publishUserEvent(userId, EVENT);
                }
            }
        } catch (RuntimeException ex) {
            // A failed tick must never stop the schedule; the next one tries again.
            log.warn("System monitoring push failed", ex);
        }
    }

    private boolean mayWatch(UUID userId, long now) {
        CachedPermission cached = permissions.get(userId);
        if (cached != null && cached.expiresAt() > now) {
            return cached.allowed();
        }
        boolean allowed = userRepository.findById(userId)
                .map(this::holdsPermission)
                .orElse(false);
        permissions.put(userId, new CachedPermission(allowed, now + PERMISSION_CACHE_MS));
        return allowed;
    }

    private boolean holdsPermission(UserAccount user) {
        try {
            return permissionEvaluationService.hasPermission(user, PERMISSION);
        } catch (RuntimeException ex) {
            return false; // when in doubt nothing is sent
        }
    }
}
