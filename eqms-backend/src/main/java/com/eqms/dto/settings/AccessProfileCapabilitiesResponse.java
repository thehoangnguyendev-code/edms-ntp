package com.eqms.dto.settings;

import java.util.Map;
import java.util.UUID;

public record AccessProfileCapabilitiesResponse(
        UUID accessProfileId,
        Map<String, ActionCapability> actions
) {
    public record ActionCapability(
            boolean allowed,
            String reason,
            String requiredPermission
    ) {}
}
