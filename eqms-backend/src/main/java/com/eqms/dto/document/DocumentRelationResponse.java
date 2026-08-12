package com.eqms.dto.document;

import com.fasterxml.jackson.annotation.JsonProperty;

public record DocumentRelationResponse(
        String id,
        String documentNumber,
        String documentName,
        String displayLabel,
        @JsonProperty("revisionNumber")
        String version,
        String status,
        String type,
        String businessUnit,
        String department,
        String author,
        String openedBy,
        String created,
        String effectiveDate,
        String validUntil,
        String relationType,
        boolean hasRelatedDocuments,
        boolean hasCorrelatedDocuments,
        boolean isTemplate
) {
}
