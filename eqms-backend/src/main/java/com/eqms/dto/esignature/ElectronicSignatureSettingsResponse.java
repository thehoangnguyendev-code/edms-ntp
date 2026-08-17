package com.eqms.dto.esignature;

import java.util.List;

public record ElectronicSignatureSettingsResponse(
        String signatureTimestampFormat,
        String signatureTimezone,
        java.time.Instant timestampFormatEffectiveFrom,
        List<ElectronicSignatureMeaningResponse> meanings,
        String previewBlock
) {
}
