package com.eqms.dto.document;

import java.util.List;

public record ControlledCopyDistributionBatchSummaryResponse(
        String id,
        String batchNumber,
        String controlledCopyNumber,
        String controlledCopyName,
        String revisionName,
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
        // Batches distributed to multiple departments/business units at once (locationIds is a
        // list at request time) can have member copies that don't all share one value -- null
        // when no copy has one, the shared value when every copy agrees, or "Multiple" when they
        // don't. Only populated when the caller already loaded the member copies (detail view);
        // list rows leave these null since Business Unit/Department aren't shown there anyway.
        String businessUnitName,
        String departmentName,
        List<String> copyIds,
        // When a batch's member copies were last touched by a workflow action (Distribute/Recall/
        // Cancel Batch, or any of those on a single member copy inside it). Lets the register be
        // sorted/scanned for "what changed recently" instead of only "what was created recently" --
        // a batch created months ago that was just Obsoleted today would otherwise stay buried by
        // the default created-date sort with no visual cue anything happened.
        String lastUpdatedAt
) {
}
