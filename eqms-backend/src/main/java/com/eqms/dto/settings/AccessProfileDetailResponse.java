package com.eqms.dto.settings;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record AccessProfileDetailResponse(
        UUID id,
        String code,
        String name,
        String description,
        String type,
        boolean active,
        boolean system,
        boolean testData,
        String businessUnitScope,
        String departmentScope,
        List<PermissionSetSummary> permissionSets,
        List<String> workflowRoles,
        /** VIEW_EVERYTHING, INCOMPLETE or NAMED_IN_FLOW (computed from the permissions the profile grants). */
        String documentControlVisibility,
        List<AssignedUserSummary> assignedUsers,
        Instant createdAt,
        Instant updatedAt,
        /** Who created (or duplicated) the profile, from the audit trail; null for profiles seeded by the system. */
        String createdBy
) {
    public record PermissionSetSummary(UUID id, String code, String name, String description, int permissionCount, boolean system) {}
    public record AssignedUserSummary(UUID id, String fullName, String employeeCode, String email, String department, String status, Instant assignedAt) {}
}
