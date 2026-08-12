package com.eqms.dto.esignature;

import java.util.List;

public record ElectronicSignatureSettingsRequest(
        Boolean requirePasswordBeforeSigning,
        Boolean requireReason,
        String commentRule,
        String allowedAuthMethod,
        Boolean showAuditTrailSummary,
        String signatureTimestampFormat,
        String signatureTimezone,
        List<ElectronicSignatureMeaningRequest> meanings
) {
}
