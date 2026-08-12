package com.eqms.dto.security;

import java.util.Map;
import java.util.UUID;

/** Common read-only authorization contract for a concrete business resource. */
public record ResourceCapabilitiesResponse(
        String resourceType,
        String resourceId,
        String state,
        String generatedAt,
        Map<String, ResourceActionCapabilityResponse> actions
) {
}
