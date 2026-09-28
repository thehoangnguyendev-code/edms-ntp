package com.eqms.service;

import com.eqms.entity.ControlledCopyRecord;
import com.eqms.exception.ControlledCopyNotAvailableException;
import com.eqms.repository.ControlledCopyRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * Server-sent events for the recipient's controlled-copy viewer (the token/password portal page, which has no eQMS
 * session and therefore cannot use the signed-in users' notification stream).
 *
 * A viewer subscribes with the short-lived, copy-bound preview grant it already holds. When the copy is recalled,
 * cancelled, made obsolete or expires, every viewer of that copy receives a {@code state} event carrying the same
 * availability message the API would answer with, so the open page can lock itself immediately instead of staying
 * viewable until the user reloads. No document content is ever sent.
 */
@Service
public class ControlledCopyPreviewRealtimeService {

    private static final Logger log = LoggerFactory.getLogger(ControlledCopyPreviewRealtimeService.class);
    /**
     * Upper bound for a stream. In practice it ends with the viewing session: the grant's expiry (the policy's external
     * viewer session length) closes it with a {@code session} event, and dead connections are dropped by the heartbeat.
     */
    private static final long MAX_EMITTER_TIMEOUT_MS = Duration.ofHours(12).toMillis();
    private static final int MAX_SUBSCRIBERS_PER_COPY = 50;

    private final ConcurrentHashMap<UUID, CopyOnWriteArraySet<SseEmitter>> subscribersByCopy = new ConcurrentHashMap<>();
    private final ControlledCopyRepository controlledCopyRepository;
    private final ControlledCopyAuthorizationService authorizationService;
    private final ControlledCopyPreviewGrantService grantService;
    private final TransactionTemplate readTransaction;
    private final ScheduledExecutorService expiryTimer = Executors.newSingleThreadScheduledExecutor(runnable -> {
        Thread thread = new Thread(runnable, "controlled-copy-preview-expiry");
        thread.setDaemon(true);
        return thread;
    });

    public ControlledCopyPreviewRealtimeService(
            ControlledCopyRepository controlledCopyRepository,
            ControlledCopyAuthorizationService authorizationService,
            ControlledCopyPreviewGrantService grantService,
            PlatformTransactionManager transactionManager
    ) {
        this.controlledCopyRepository = controlledCopyRepository;
        this.authorizationService = authorizationService;
        this.grantService = grantService;
        this.readTransaction = new TransactionTemplate(transactionManager);
        this.readTransaction.setReadOnly(true);
        // The caller may be inside another transaction's after-commit callback; always use a fresh one.
        this.readTransaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    /** Opens a stream for a viewer holding a valid preview grant for this copy. */
    public SseEmitter subscribe(UUID copyId, String grant) {
        Map<String, Object> initialState = readTransaction.execute(status -> {
            ControlledCopyRecord copy = controlledCopyRepository.findById(copyId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Controlled copy not found"));
            // Only the grant is checked here (not the status): a viewer whose copy was just recalled must still be able to
            // learn that, and the state event is exactly what tells it.
            grantService.require(copy, grant);
            scheduleExpiryCheck(copy);
            return evaluate(copy);
        });
        Instant sessionEnd = grantService.expiresAt(grant);

        CopyOnWriteArraySet<SseEmitter> subscribers = subscribersByCopy.computeIfAbsent(copyId, ignored -> new CopyOnWriteArraySet<>());
        if (subscribers.size() >= MAX_SUBSCRIBERS_PER_COPY) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Too many open viewers for this controlled copy");
        }
        long untilSessionEnd = sessionEnd == null ? MAX_EMITTER_TIMEOUT_MS : Duration.between(Instant.now(), sessionEnd).toMillis();
        SseEmitter emitter = new SseEmitter(Math.max(1000L, Math.min(MAX_EMITTER_TIMEOUT_MS, untilSessionEnd + 5000L)));
        subscribers.add(emitter);
        Runnable cleanup = () -> remove(copyId, emitter);
        emitter.onCompletion(cleanup);
        emitter.onTimeout(cleanup);
        emitter.onError(error -> cleanup.run());
        send(emitter, copyId, initialState);
        if (sessionEnd != null) {
            expiryTimer.schedule(() -> endSession(copyId, emitter), Math.max(0L, untilSessionEnd), TimeUnit.MILLISECONDS);
        }
        return emitter;
    }

    /** The viewing session is over: tell the page to lock and close the stream. */
    private void endSession(UUID copyId, SseEmitter emitter) {
        try {
            emitter.send(SseEmitter.event().name("session").data(Map.of("ended", true, "occurredAt", Instant.now().toString())));
            emitter.complete();
        } catch (IOException | IllegalStateException ex) {
            // already closed by the client
        } finally {
            remove(copyId, emitter);
        }
    }

    /** Called after a controlled copy changed (see {@link EntityChangeBroadcaster}); re-evaluates and tells its viewers. */
    public void copyChanged(UUID copyId) {
        if (copyId == null || !hasSubscribers(copyId)) {
            return;
        }
        try {
            Map<String, Object> state = readTransaction.execute(status -> controlledCopyRepository.findById(copyId)
                    .map(this::evaluate)
                    .orElseGet(() -> unavailable("This controlled copy is no longer available.", null, null)));
            broadcast(copyId, state);
        } catch (RuntimeException ex) {
            log.debug("Could not evaluate controlled copy {} for its preview viewers", copyId, ex);
        }
    }

    @Scheduled(fixedRate = 25000)
    public void heartbeat() {
        Map<String, Object> ping = Map.of("ping", Instant.now().toString());
        subscribersByCopy.forEach((copyId, emitters) -> emitters.forEach(emitter -> {
            try {
                emitter.send(SseEmitter.event().name("ping").data(ping));
            } catch (IOException | IllegalStateException ex) {
                remove(copyId, emitter);
            }
        }));
    }

    /** Time-based expiry does not change the record, so it is announced by a timer set when the viewer connects. */
    private void scheduleExpiryCheck(ControlledCopyRecord copy) {
        Instant expiry = authorizationService.previewExpiryInstant(copy);
        if (expiry == null) {
            return;
        }
        long delayMs = Duration.between(Instant.now(), expiry).toMillis() + 500;
        if (delayMs <= 0 || delayMs > MAX_EMITTER_TIMEOUT_MS) {
            return;
        }
        UUID copyId = copy.getId();
        expiryTimer.schedule(() -> copyChanged(copyId), delayMs, TimeUnit.MILLISECONDS);
    }

    private Map<String, Object> evaluate(ControlledCopyRecord copy) {
        try {
            authorizationService.requireNotExpired(copy);
            authorizationService.requireStatusAllowedForPreview(copy);
            Map<String, Object> state = new LinkedHashMap<>();
            state.put("available", true);
            return state;
        } catch (ControlledCopyNotAvailableException ex) {
            return unavailable(ex.getMessage(), ex.getStatusCode(), ex.getObsoleteReason());
        }
    }

    private Map<String, Object> unavailable(String message, String statusCode, String reason) {
        Map<String, Object> state = new LinkedHashMap<>();
        state.put("available", false);
        state.put("status", statusCode);
        state.put("reason", reason);
        state.put("occurredAt", Instant.now().toString());
        state.put("message", message);
        return state;
    }

    private boolean hasSubscribers(UUID copyId) {
        CopyOnWriteArraySet<SseEmitter> emitters = subscribersByCopy.get(copyId);
        return emitters != null && !emitters.isEmpty();
    }

    private void broadcast(UUID copyId, Map<String, Object> state) {
        CopyOnWriteArraySet<SseEmitter> emitters = subscribersByCopy.get(copyId);
        if (emitters != null) {
            emitters.forEach(emitter -> send(emitter, copyId, state));
        }
    }

    private void send(SseEmitter emitter, UUID copyId, Map<String, Object> state) {
        try {
            emitter.send(SseEmitter.event().name("state").data(state));
        } catch (IOException | IllegalStateException ex) {
            remove(copyId, emitter);
        }
    }

    private void remove(UUID copyId, SseEmitter emitter) {
        CopyOnWriteArraySet<SseEmitter> emitters = subscribersByCopy.get(copyId);
        if (emitters != null) {
            emitters.remove(emitter);
            if (emitters.isEmpty()) {
                subscribersByCopy.remove(copyId, emitters);
            }
        }
    }
}
