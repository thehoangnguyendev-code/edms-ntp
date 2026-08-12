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
        boolean canStartInitialAuthoring
) {
}
