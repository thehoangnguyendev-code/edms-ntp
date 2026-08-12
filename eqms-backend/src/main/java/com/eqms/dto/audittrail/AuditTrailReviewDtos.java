package com.eqms.dto.audittrail;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Request/response records for the periodic Audit Trail Review module. */
public final class AuditTrailReviewDtos {

    private AuditTrailReviewDtos() {}

    public record CampaignCreateRequest(
            String name,
            String description,
            LocalDate reviewPeriodStart,
            LocalDate reviewPeriodEnd
    ) {}

    public record ItemDecisionRequest(
            String decision,
            String note
    ) {}

    public record CampaignCompleteRequest(
            String signatureToken,
            String reason
    ) {}

    public record CampaignSummaryResponse(
            UUID id,
            String name,
            String description,
            LocalDate reviewPeriodStart,
            LocalDate reviewPeriodEnd,
            String status,
            String statusLabel,
            String reviewerName,
            Instant signedAt,
            UUID signatureId,
            long totalItems,
            long pendingItems,
            Instant createdAt
    ) {}

    public record ItemResponse(
            UUID id,
            UUID auditLogId,
            String timestamp,
            String userFullName,
            String employeeCode,
            String module,
            String action,
            String entityLabel,
            boolean electronicSignatureApplied,
            String decision,
            String decisionLabel,
            String decisionNote,
            Instant decidedAt
    ) {}

    public record CampaignDetailResponse(
            CampaignSummaryResponse campaign,
            List<ItemResponse> items
    ) {}
}
