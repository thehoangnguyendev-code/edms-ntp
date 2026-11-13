package com.eqms.dto.user;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Request/response records for the Access Review module (RBAC master plan section 17). */
public final class AccessReviewDtos {

    private AccessReviewDtos() {}

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

    public record CodeLabelResponse(
            String value,
            String label
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
              Instant createdAt,
              Instant updatedAt
    ) {}

    public record ItemResponse(
            UUID id,
            UUID userId,
            String employeeCode,
            String username,
            String fullName,
            String userStatus,
            String userStatusLabel,
            String accessProfiles,
            int permissionCount,
            boolean superAdmin,
            String decision,
            String decisionLabel,
            String decisionNote,
            Instant decidedAt,
            String decidedByName
    ) {}

    public record CampaignDetailResponse(
            CampaignSummaryResponse campaign,
            List<ItemResponse> items
    ) {}
}
