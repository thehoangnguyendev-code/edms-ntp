package com.eqms.dto.security;

import java.util.Map;
import java.util.UUID;

public record ControlledCopyActionCapabilitiesResponse(
        UUID controlledCopyId,
        UUID batchId,
        UUID revisionId,
        UUID documentId,
        String copyStatus,
        String batchStatus,
        String previewObjectType,
        String previewStatus,
        String previewVersionToken,
        String generatedAt,
        Map<String, ControlledCopyActionCapabilityDecisionResponse> actions
) {
}
