package com.eqms.dto.executedrecord;

import java.time.Instant;

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
        Instant createdAt
) {
}
