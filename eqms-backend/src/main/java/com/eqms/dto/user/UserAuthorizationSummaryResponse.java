package com.eqms.dto.user;

import java.util.List;
import java.util.UUID;

/** Read-only explanation of the Access Profiles that currently grant a user's access. */
public record UserAuthorizationSummaryResponse(
        UUID userId,
        List<AccessProfile> accessProfiles,
        int effectivePermissionCount
) {
    public record AccessProfile(
            UUID id,
            String code,
            String name,
            boolean active,
            String businessUnitScope,
            String departmentScope,
            List<String> workflowRoles,
            List<PermissionSet> permissionSets
    ) {}

    public record PermissionSet(UUID id, String code, String name, boolean active, int permissionCount) {}
}
