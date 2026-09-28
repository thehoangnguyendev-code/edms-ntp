package com.eqms.service;

import java.util.UUID;

/**
 * Published after a revision workflow action (or the explicit "Refresh Published PDF" action)
 * commits, so regenerating the Publishing preview PDF (Microsoft Graph DOCX->PDF conversion) can
 * run asynchronously without holding the triggering request's DB transaction/connection open for
 * the whole round trip. Mirrors {@link RevisionSnapshotEvent}, which does the same for the
 * separate pre-publish review-snapshot pipeline.
 */
public record PublishingSnapshotRegenerationEvent(
        UUID revisionId,
        UUID userId,
        String actionLabel,
        UUID requestId
) {}
