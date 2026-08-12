package com.eqms.dto.esignature;

import java.util.List;

public record ElectronicSignatureSettingsResponse(
        boolean requirePasswordBeforeSigning,
        boolean requireReason,
        String commentRule,
        String allowedAuthMethod,
        boolean showAuditTrailSummary,
        String signatureTimestampFormat,
        String signatureTimezone,
        java.time.Instant timestampFormatEffectiveFrom,
        List<ElectronicSignatureMeaningResponse> meanings,
        String previewBlock
) {
}
