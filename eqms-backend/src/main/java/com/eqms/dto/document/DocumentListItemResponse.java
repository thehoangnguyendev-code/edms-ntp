package com.eqms.dto.document;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public record DocumentListItemResponse(
        String id,
        String documentNumber,
        String documentName,
        @JsonProperty("revisionNumber")
        String version,
        String currentEffectiveRevisionNumber,
        String currentEffectiveRevisionId,
        boolean hasEffectiveRevision,
        String status,
        StatusResponse statusInfo,
        String type,
        String businessUnit,
        String department,
        String author,
        String owner,
        String openedBy,
        String created,
        String createdDate,
        String effectiveDate,
        String validUntil,
        String reviewDate,
        boolean hasRelatedDocuments,
        boolean hasCorrelatedDocuments,
        boolean isTemplate,
        String lastModifiedDate,
        String lastModifiedBy,
        List<DocumentRelationResponse> relatedDocuments,
        List<DocumentRelationResponse> correlatedDocuments,
        boolean hasAnyRevision,
        boolean canStartInitialAuthoring,
        /** NONE/REQUIRED resolved server-side from the Sub-Type Dictionary
         * (DocumentService#resolveDocumentReviewRequirement) -- authoritative, so the FE never
         * has to re-derive it from a client-side Sub-Type lookup snapshot that can go stale the
         * moment the user re-selects a different Sub-Type and saves. */
        String reviewRequirement,
        /** True for the Author of an Active document whose upgrade the DCO has already configured
         *  ("Edit Revision for Upgrade" saved), so "Edit Document" (-> Upload Revision) may be offered. */
        boolean canEditForUpgrade
) {
}
