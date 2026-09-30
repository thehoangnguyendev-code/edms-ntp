package com.eqms.dto.uncontrolledcopy;

public record UncontrolledCopyResponse(
        String id,
        String uncontrolledCopyNumber,
        String documentId,
        String documentNumber,
        String documentTitle,
        String revisionId,
        String revisionNumber,
        String reason,
        String status,
        String statusCode,
        String requestedById,
        String requestedByName,
        String requestedAt,
        String approvedByName,
        String approvedAt,
        String rejectedByName,
        String rejectedAt,
        String rejectionReason,
        String generatedByName,
        String generatedAt,
        String distributedByName,
        String distributedAt,
        String cancelledByName,
        String cancelledAt,
        String cancelReason,
        String recipientType,
        String recipientName,
        /** E-mail of the system user holding the copy (never an external address used for access). */
        String recipientEmail,
        /** Display/audit label of an external party the holder hands the copy to; grants no access. */
        String externalRecipient,
        boolean markingApplied,
        boolean fileAvailable,
        String validUntil,
        boolean expired,
        int downloadCount,
        String lastDownloadedAt,
        String createdAt,
        String updatedAt,
        Capabilities capabilities
) {
    /** What the CURRENT user may do on this record right now (server-evaluated; the UI only mirrors it). */
    public record Capabilities(
            boolean canApprove,
            boolean canReject,
            boolean canGenerate,
            boolean canDistribute,
            boolean canCancel,
            boolean canPreview,
            boolean canDownload
    ) {
    }
}
