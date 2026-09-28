package com.eqms.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Tells every connected client, over the existing server-sent-events stream, that a Document, Revision or
 * Controlled Copy changed, so any screen showing it can refresh itself instead of staying stale until a
 * manual reload (e.g. the DCO's screen when a Reviewer completes review).
 *
 * The event carries ONLY the entity type and ids -- never document data. Each client re-fetches through its
 * own authorised API calls, so nobody learns anything they could not already read. Events are collected during
 * the transaction and sent once after it commits (one per entity, however many times it was saved), so a
 * rolled-back change is never announced and clients never re-fetch data that is not yet visible.
 */
@Component
public class EntityChangeBroadcaster {

    private static final Logger log = LoggerFactory.getLogger(EntityChangeBroadcaster.class);
    private static final Object PENDING_KEY = new Object();
    private static volatile EntityChangeBroadcaster instance;

    private final NotificationRealtimeService realtimeService;
    private final ControlledCopyPreviewRealtimeService previewRealtimeService;

    public EntityChangeBroadcaster(NotificationRealtimeService realtimeService,
                                   ControlledCopyPreviewRealtimeService previewRealtimeService) {
        this.realtimeService = realtimeService;
        this.previewRealtimeService = previewRealtimeService;
        instance = this;
    }

    /** Called from the JPA entity listener; safe to call when no Spring context/broadcaster exists (tests). */
    public static void changed(String entityType, UUID id, UUID documentId) {
        EntityChangeBroadcaster broadcaster = instance;
        if (broadcaster == null || entityType == null || id == null) {
            return;
        }
        try {
            broadcaster.register(entityType, id, documentId);
        } catch (RuntimeException ex) {
            log.debug("Could not queue entity change event for {} {}", entityType, id, ex);
        }
    }

    @SuppressWarnings("unchecked")
    private void register(String entityType, UUID id, UUID documentId) {
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("entityType", entityType);
        event.put("id", id.toString());
        if (documentId != null) {
            event.put("documentId", documentId.toString());
        }
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            publish(event);
            return;
        }
        Map<String, Map<String, Object>> pending =
                (Map<String, Map<String, Object>>) TransactionSynchronizationManager.getResource(PENDING_KEY);
        if (pending == null) {
            Map<String, Map<String, Object>> created = new LinkedHashMap<>();
            pending = created;
            TransactionSynchronizationManager.bindResource(PENDING_KEY, created);
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    created.values().forEach(EntityChangeBroadcaster.this::publish);
                }

                @Override
                public void afterCompletion(int status) {
                    if (TransactionSynchronizationManager.hasResource(PENDING_KEY)) {
                        TransactionSynchronizationManager.unbindResource(PENDING_KEY);
                    }
                }
            });
        }
        pending.put(entityType + ":" + id, event);
    }

    private void publish(Map<String, Object> event) {
        Map<String, Object> payload = new LinkedHashMap<>(event);
        payload.put("occurredAt", Instant.now().toString());
        realtimeService.publishGlobalEvent("entity-changed", payload);
        // Recipients viewing a controlled copy through its e-mail link have no session, so they listen on their own
        // grant-authorised stream (see ControlledCopyPreviewRealtimeService).
        if ("CONTROLLED_COPY".equals(payload.get("entityType"))) {
            try {
                previewRealtimeService.copyChanged(UUID.fromString(String.valueOf(payload.get("id"))));
            } catch (RuntimeException ex) {
                log.debug("Could not notify controlled copy viewers", ex);
            }
        }
    }
}
