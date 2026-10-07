package com.eqms.dto.executedrecord;

import java.time.Instant;

/**
 * One record of a returned paper copy (the scan) or a legacy executed form. The {@code form*} field names are kept for API
 * compatibility; since recall-by-scan they describe the document the copy belongs to, whatever its type.
 */
public record ExecutedRecordResponse(
        String id,
        String recordNumber,
        String formDocumentId,
        String formDocumentNumber,
        String formDocumentTitle,
        String formRevisionId,
        String formRevisionNumber,
        String captureMethod,
        String status,
        String filledByUserId,
        String filledByName,
        Instant filledAt,
        String sourceControlledCopyId,
        String sourceControlledCopyNumber,
        boolean fileAvailable,
        String approvedByUserId,
        String approvedByName,
        String rejectedByUserId,
        String rejectedByName,
        Instant rejectedAt,
        String rejectedReason,
        Instant createdAt,
        /** The scan's original file name; null for records created before it was kept. */
        String fileName,
        /** What the browser can render: application/pdf, image/png or image/jpeg; null when unknown. */
        String contentType,
        Long fileSize,
        /** The recall-by-scan batch that produced the record; null for older records. */
        String recallBatchId
) {
}
