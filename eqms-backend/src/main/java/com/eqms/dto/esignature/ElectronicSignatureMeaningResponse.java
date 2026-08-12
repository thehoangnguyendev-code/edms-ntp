package com.eqms.dto.esignature;

import java.util.List;
import java.util.UUID;

public record ElectronicSignatureMeaningResponse(
        UUID id,
        String code,
        String displayName,
        String description,
        boolean requiresReason,
        boolean requiresComment,
        boolean active,
        String commentRule,
        List<String> allowedReasons
) {
}
