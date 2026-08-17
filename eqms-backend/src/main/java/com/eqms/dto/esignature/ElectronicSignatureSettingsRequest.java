package com.eqms.dto.esignature;

import java.util.List;

public record ElectronicSignatureSettingsRequest(
        String signatureTimestampFormat,
        String signatureTimezone,
        List<ElectronicSignatureMeaningRequest> meanings
) {
}
