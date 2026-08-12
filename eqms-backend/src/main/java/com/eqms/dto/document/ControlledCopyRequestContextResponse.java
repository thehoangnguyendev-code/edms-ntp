package com.eqms.dto.document;

public record ControlledCopyRequestContextResponse(
        String documentId,
        String documentNumber,
        String documentName,
        String documentType,
        String businessUnit,
        String documentStatus,
        String currentEffectiveRevisionId,
        String revisionNumber,
        String revisionName,
        String revisionStatus,
        String effectiveDate,
        String validUntil,
        boolean canRequest,
        boolean canRequestForOthers,
        String message
) {
}
