package com.eqms.dto.user;

import jakarta.validation.constraints.NotBlank;

public record CertificationRequest(
        @NotBlank String name,
        @NotBlank String issuingOrg,
        String issueDate,
        String expiryDate,
        String fileName,
        Long fileSize,
        String fileType,
        String fileUrl
) {
}
