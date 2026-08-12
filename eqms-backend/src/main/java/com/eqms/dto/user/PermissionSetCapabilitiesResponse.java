package com.eqms.dto.user;

import java.util.Map;
import java.util.UUID;

public record PermissionSetCapabilitiesResponse(
        UUID permissionSetId,
        Map<String, ActionCapability> actions
) {
    public record ActionCapability(
            boolean allowed,
            String reason,
            String requiredPermission
    ) {}
}
