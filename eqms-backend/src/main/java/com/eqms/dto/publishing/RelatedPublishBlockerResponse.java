package com.eqms.dto.publishing;

/** A Related Document whose revision in progress has not reached Ready for Publishing, so the package cannot publish together. */
public record RelatedPublishBlockerResponse(
        String documentId,
        String documentNumber,
        String documentName,
        String revisionId,
        String revisionNumber,
        String statusCode,
        String statusLabel
) {}
