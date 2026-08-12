package com.eqms.dto.user;

public record CertificationResponse(
        String id,
        String name,
        String issuingOrg,
        String issueDate,
        String expiryDate,
        String fileName,
        Long fileSize,
        String fileType,
        String fileObjectUrl
) {
}
