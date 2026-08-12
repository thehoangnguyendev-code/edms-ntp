package com.eqms.dto.document;

public record KnowledgeBaseDocumentResponse(
        String id,
        String documentNumber,
        String documentName,
        String revisionNumber,
        String revisionStatus,
        String documentStatus,
        String documentType,
        String businessUnit,
        String department,
        String openedBy,
        String created,
        String effectiveDate,
        String validUntil,
        boolean hasRelatedDocuments,
        boolean hasCorrelatedDocuments,
        boolean isTemplate
) {
}
