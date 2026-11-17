package com.eqms.dto.audittrail;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Request/response records for the periodic Audit Trail Review module. */
public final class AuditTrailReviewDtos {

    private AuditTrailReviewDtos() {}

    /** {@code reviewerUserId} is the person who reviews the campaign; empty means the person who creates it. */
    public record CampaignCreateRequest(
            String name,
            String description,
            LocalDate reviewPeriodStart,
            LocalDate reviewPeriodEnd,
            java.util.UUID reviewerUserId
    ) {
        public CampaignCreateRequest(String name, String description, LocalDate reviewPeriodStart, LocalDate reviewPeriodEnd) {
            this(name, description, reviewPeriodStart, reviewPeriodEnd, null);
        }
    }

    /** A person who may be given a campaign to review. */
    public record ReviewerOption(java.util.UUID id, String name) {}

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
            String campaignNumber,
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
