package com.eqms.dto.document;

import java.util.List;

public record ControlledCopyDistributionBatchSummaryResponse(
        String id,
        String batchNumber,
        String controlledCopyNumber,
        String controlledCopyName,
        String primaryControlledCopyId,
        String documentId,
        String documentNumber,
        String documentTitle,
        String documentDisplayLabel,
        String revisionNumber,
        String sourceRevisionId,
        String validUntil,
        String expiryDate,
        Boolean hasExpiryDate,
        Integer quantity,
        Integer readyCount,
        Integer distributedCount,
        String status,
        String statusCode,
        String distributionList,
        String distributionMode,
        String distributionRecipients,
        String distributionScope,
        String location,
        String locationCode,
        String externalRecipients,
        String requestedBy,
        String requestedAt,
        String distributedBy,
        String distributedAt,
        String recallDate,
        String recallReason,
        List<String> copyIds
) {
}
