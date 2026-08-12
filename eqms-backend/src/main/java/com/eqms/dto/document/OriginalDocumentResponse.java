package com.eqms.dto.document;

public record OriginalDocumentResponse(
        String id,
        String documentNumber,
        String documentName,
        String displayName,
        String title,
        String created,
        String openedBy,
        String author,
        String owner,
        String status,
        String statusCode,
        StatusResponse statusInfo,
        String validUntil,
        String reviewDate
) {
}
