package com.eqms.dto.esignature;

import java.util.UUID;

public record ElectronicSignatureMeaningResponse(
        UUID id,
        String code,
        String displayName
) {
}
