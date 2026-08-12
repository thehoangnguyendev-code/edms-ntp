package com.eqms.dto.user;

import java.util.Map;

public record UserActionCapabilitiesResponse(
        String userId,
        Map<String, ActionCapability> actions
) {
    public record ActionCapability(
            boolean allowed,
            String reason,
            String requiredPermission
    ) {}
}
