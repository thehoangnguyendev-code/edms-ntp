package com.eqms.dto.esignature;

import java.time.Instant;
import java.util.UUID;

public record ElectronicSignatureRecordResponse(
        UUID id,
        String entityType,
        UUID entityId,
        UUID documentId,
        UUID revisionId,
        UUID workflowStepId,
        UUID userId,
        String username,
        String fullName,
        String position,
        String email,
        String department,
        String meaning,
        String displayMeaning,
        String reason,
        String comment,
        Instant signedAt,
        String timezone,
        String authenticationMethod,
        String signatureId,
        String verificationId,
        String status,
        String ipAddress,
        String userAgent,
        String documentChecksumBeforeSign,
        String documentChecksumAfterSign,
        String sourceFileVersionId,
        String reviewPdfVersionId,
        String publishedPdfVersionId,
        Instant createdAt
) {
}
