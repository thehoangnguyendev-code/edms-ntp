package com.eqms.dto.document;

import java.util.Map;

public record ControlledCopyDistributeRequest(
        String distributedTo,
        String distributedAt,
        String location,
        String comment,
        String signatureToken,
        Map<String, String> customPlaceholderValues
) {
}
