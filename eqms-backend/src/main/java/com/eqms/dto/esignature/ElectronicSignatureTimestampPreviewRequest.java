package com.eqms.dto.esignature;

public record ElectronicSignatureTimestampPreviewRequest(
        String signatureTimestampFormat,
        String signatureTimezone
) {}
