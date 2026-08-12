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
        String businessUnitScope,
        String departmentScope,
        List<PermissionSetSummary> permissionSets,
        List<String> workflowRoles,
        List<AssignedUserSummary> assignedUsers,
        Instant createdAt,
        Instant updatedAt
) {
    public record PermissionSetSummary(UUID id, String code, String name, String description, int permissionCount, boolean system) {}
    public record AssignedUserSummary(UUID id, String fullName, String email, String department, String status, Instant assignedAt) {}
}
