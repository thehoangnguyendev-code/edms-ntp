package com.eqms.dto.document;

public record DocumentRevisionSummaryResponse(
        String id,
        String documentId,
        String revisionNumber,
        String created,
        String openedBy,
        String revisionName,
        String status,
        String statusCode,
        StatusResponse statusInfo,
        boolean canOpenAuthoringWorkspace
) {
}
