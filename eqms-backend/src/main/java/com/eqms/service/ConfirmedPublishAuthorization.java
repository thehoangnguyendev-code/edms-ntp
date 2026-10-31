package com.eqms.service;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;

/** Internal, typed authorization. Never accepted from a controller or deserialized from a request. */
final class ConfirmedPublishAuthorization {
    final UUID confirmationId;
    final UUID userId;
    final Instant confirmedAt;
    final java.util.Map<String,String> context;
    private final Set<UUID> revisions;

    ConfirmedPublishAuthorization(UUID confirmationId, UUID userId, Instant confirmedAt, Set<UUID> revisions,
            java.util.Map<String,String> context) {
        this.confirmationId = java.util.Objects.requireNonNull(confirmationId);
        this.userId = java.util.Objects.requireNonNull(userId);
        this.confirmedAt = java.util.Objects.requireNonNull(confirmedAt);
        this.revisions = Set.copyOf(revisions);
        this.context = java.util.Map.copyOf(context);
    }

    void require(UUID actorId, UUID revisionId) {
        if (!userId.equals(actorId) || !revisions.contains(revisionId)) {
            throw new org.springframework.security.access.AccessDeniedException("Publish confirmation does not cover this actor/revision");
        }
    }
}
