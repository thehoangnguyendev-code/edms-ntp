package com.eqms.service;

import com.eqms.dto.notification.NotificationStreamEventResponse;
import jakarta.annotation.PreDestroy;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;

@Service
public class NotificationRealtimeService {

    private static final long EMITTER_TIMEOUT_MS = 0L;
    private final ConcurrentHashMap<UUID, CopyOnWriteArraySet<SseEmitter>> emittersByUser = new ConcurrentHashMap<>();

    public SseEmitter register(UUID userId) {
        SseEmitter emitter = new SseEmitter(EMITTER_TIMEOUT_MS);
        CopyOnWriteArraySet<SseEmitter> emitters = emittersByUser.computeIfAbsent(userId, ignored -> new CopyOnWriteArraySet<>());
        emitters.add(emitter);

        Runnable cleanup = () -> removeEmitter(userId, emitter);
        emitter.onCompletion(cleanup);
        emitter.onTimeout(cleanup);
        emitter.onError(error -> cleanup.run());

        try {
            emitter.send(SseEmitter.event()
                    .name("connected")
                    .data(new NotificationStreamEventResponse("connected", Instant.now().toString())));
        } catch (IOException ignored) {
            cleanup.run();
        }

        return emitter;
    }

    public void publishUserEvent(UUID userId, String eventName) {
        publishUserEvent(userId, eventName, new NotificationStreamEventResponse(eventName, Instant.now().toString()));
    }

    public void publishUserEvent(UUID userId, String eventName, Object payload) {
        if (userId == null || eventName == null || eventName.isBlank()) {
            return;
        }
        CopyOnWriteArraySet<SseEmitter> emitters = emittersByUser.get(userId);
        if (emitters == null || emitters.isEmpty()) {
            return;
        }

        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event().name(eventName).data(payload));
            } catch (IOException error) {
                removeEmitter(userId, emitter);
            }
        }
    }

    /** Broadcasts a non-sensitive invalidation signal to connected clients. */
    public void publishGlobalEvent(String eventName) {
        if (eventName == null || eventName.isBlank()) return;
        NotificationStreamEventResponse payload = new NotificationStreamEventResponse(eventName, Instant.now().toString());
        emittersByUser.values().forEach(emitters -> emitters.forEach(emitter -> {
            try {
                emitter.send(SseEmitter.event().name(eventName).data(payload));
            } catch (IOException error) {
                emitters.remove(emitter);
            }
        }));
    }

    @Scheduled(fixedRate = 25000)
    public void heartbeat() {
        NotificationStreamEventResponse payload = new NotificationStreamEventResponse("ping", Instant.now().toString());
        for (var entry : emittersByUser.entrySet()) {
            UUID userId = entry.getKey();
            Set<SseEmitter> emitters = entry.getValue();
            if (emitters == null || emitters.isEmpty()) {
                continue;
            }
            for (SseEmitter emitter : emitters) {
                try {
                    emitter.send(SseEmitter.event().name("ping").data(payload));
                } catch (IOException error) {
                    removeEmitter(userId, emitter);
                }
            }
        }
    }

    @PreDestroy
    public void shutdown() {
        emittersByUser.values().forEach(Set::clear);
        emittersByUser.clear();
    }

    private void removeEmitter(UUID userId, SseEmitter emitter) {
        CopyOnWriteArraySet<SseEmitter> emitters = emittersByUser.get(userId);
        if (emitters == null) {
            return;
        }
        emitters.remove(emitter);
        if (emitters.isEmpty()) {
            emittersByUser.remove(userId);
        }
    }
}
