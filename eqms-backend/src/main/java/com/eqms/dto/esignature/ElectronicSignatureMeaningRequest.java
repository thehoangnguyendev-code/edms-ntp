package com.eqms.dto.esignature;

import java.util.List;

public record ElectronicSignatureMeaningRequest(
        String code,
        String displayName,
        String description,
        Boolean requiresReason,
        Boolean requiresComment,
        Boolean active,
        String commentRule,
        List<String> allowedReasons
) {
}
