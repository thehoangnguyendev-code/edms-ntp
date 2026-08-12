package com.eqms.dto.settings;

import java.util.List;
import java.util.UUID;

/** Access Profile assignment coverage report. */
public record AccessProfileMigrationReportResponse(
        long totalUsers,
        long usersWithProfile,
        long usersWithoutAccessProfile,
        long usersWithSuperAdmin,
        long usersWithoutAnyPermission,
        long inactiveUsersWithActiveAccess,
        boolean accessProfilesEnforced,
        List<UnassignedUser> unassignedUsers
) {
    public record UnassignedUser(UUID id, String username, String fullName, String status) {}
}
