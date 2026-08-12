package com.eqms.dto.security;

import java.util.Map;
import java.util.UUID;

public record RevisionActionCapabilitiesResponse(
        UUID revisionId,
        UUID documentId,
        String revisionStatus,
        String previewObjectType,
        String previewStatus,
        String previewVersionToken,
        String generatedAt,
        Map<String, RevisionActionCapabilityDecisionResponse> actions
) {
}
