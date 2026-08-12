package com.eqms.dto.security;

import java.time.Instant;
import java.util.UUID;

public record ControlledCopyAuthorizationContext(
        UUID controlledCopyId,
        UUID batchId,
        UUID requestId,
        UUID revisionId,
        UUID documentId,
        String documentStatus,
        String revisionStatus,
        String copyStatus,
        String obsoleteReason,
        String batchStatus,
        String requestStatus,
        UUID requesterUserId,
        UUID recipientUserId,
        Instant expiryAt,
        boolean downloadAllowed,
        boolean portalViewAllowed,
        boolean printAllowed,
        boolean batchAction
) {
    public static ControlledCopyAuthorizationContext forCopy(
            UUID controlledCopyId,
            UUID batchId,
            UUID revisionId,
            UUID documentId,
            String documentStatus,
            String revisionStatus,
            String copyStatus,
            String obsoleteReason,
            UUID requesterUserId,
            UUID recipientUserId,
            Instant expiryAt,
            boolean downloadAllowed,
            boolean portalViewAllowed,
            boolean printAllowed
    ) {
        return new ControlledCopyAuthorizationContext(
                controlledCopyId,
                batchId,
                null,
                revisionId,
                documentId,
                documentStatus,
                revisionStatus,
                copyStatus,
                obsoleteReason,
                null,
                null,
                requesterUserId,
                recipientUserId,
                expiryAt,
                downloadAllowed,
                portalViewAllowed,
                printAllowed,
                false
        );
    }

    public static ControlledCopyAuthorizationContext forBatch(
            UUID batchId,
            UUID revisionId,
            UUID documentId,
            String batchStatus,
            UUID requesterUserId,
            Instant expiryAt
    ) {
        return new ControlledCopyAuthorizationContext(
                null,
                batchId,
                null,
                revisionId,
                documentId,
                null,
                null,
                null,
                null,
                batchStatus,
                null,
                requesterUserId,
                null,
                expiryAt,
                false,
                false,
                false,
                true
        );
    }

    public static ControlledCopyAuthorizationContext forRequest(
            UUID documentId,
            UUID revisionId,
            String documentStatus,
            String revisionStatus,
            UUID requesterUserId
    ) {
        return new ControlledCopyAuthorizationContext(
                null,
                null,
                null,
                revisionId,
                documentId,
                documentStatus,
                revisionStatus,
                null,
                null,
                null,
                null,
                requesterUserId,
                null,
                null,
                false,
                false,
                false,
                false
        );
    }
}
