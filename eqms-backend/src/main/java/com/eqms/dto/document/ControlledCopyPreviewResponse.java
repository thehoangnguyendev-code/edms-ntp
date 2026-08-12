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
        boolean printOnce
) {
}
