package com.eqms.dto.document;

public record ControlledCopyPreviewResponse(
        String id,
        String controlledCopyNumber,
        String documentTitle,
        String documentNumber,
        String revisionNumber,
        String recipientName,
        int pageCount,
        String token,
        boolean allowDownload,
        boolean allowPrint,
        boolean downloadOnce,
        boolean printOnce,
        /** When the recipient's viewing session ends (ISO-8601); the viewer locks then. */
        String sessionExpiresAt
) {
}
