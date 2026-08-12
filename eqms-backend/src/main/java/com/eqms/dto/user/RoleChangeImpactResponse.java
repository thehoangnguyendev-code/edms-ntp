package com.eqms.dto.user;

import java.util.List;

public record RoleChangeImpactResponse(
        List<String> addedPermissions,
        List<String> removedPermissions,
        int affectedUserCount,
        List<String> criticalChanges,
        boolean requiresESign
) {
}
