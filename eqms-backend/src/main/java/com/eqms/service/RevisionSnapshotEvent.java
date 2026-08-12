package com.eqms.service;

import java.util.UUID;

/**
 * Published after a revision workflow action commits so that publishing snapshot
 * regeneration can run asynchronously without blocking the HTTP response.
 */
public record RevisionSnapshotEvent(
        UUID revisionId,
        UUID userId,
        String actionLabel,
        UUID requestId,
        String sourceChecksum,
        int reviewRound
) {}
