package com.eqms.dto.settings;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record AccessProfileResponse(
        UUID id,
        String code,
        String name,
        String description,
        String type,
        boolean active,
        boolean system,
        /** A DEV/UAT/test profile (display badge only). */
        boolean testData,
        int permissionSetCount,
        int workflowRoleCount,
        int assignedUserCount,
        List<String> workflowRoles,
        /** How much of Document Control the profile lets its people see: VIEW_EVERYTHING, INCOMPLETE or NAMED_IN_FLOW (computed from its permissions). */
        String documentControlVisibility,
        Instant createdAt,
        Instant updatedAt,
        /** Server-formatted "dd/MM/yyyy HH:mm:ss" — frontend renders this as-is, no client-side formatting. */
        String createdAtDisplay,
        AccessProfileCapabilitiesResponse capabilities
) {
    /** Compatibility constructor for existing detail/mutation responses. */
    public AccessProfileResponse(
            UUID id,
            String code,
            String name,
            String description,
            String type,
            boolean active,
            boolean system,
            boolean testData,
            int permissionSetCount,
            int workflowRoleCount,
            int assignedUserCount,
            List<String> workflowRoles,
            String documentControlVisibility,
            Instant createdAt,
            Instant updatedAt,
            String createdAtDisplay) {
        this(id, code, name, description, type, active, system, testData, permissionSetCount, workflowRoleCount, assignedUserCount, workflowRoles, documentControlVisibility, createdAt, updatedAt, createdAtDisplay, null);
    }

    public AccessProfileResponse withCapabilities(AccessProfileCapabilitiesResponse capabilities) {
        return new AccessProfileResponse(id, code, name, description, type, active, system, testData, permissionSetCount, workflowRoleCount, assignedUserCount, workflowRoles, documentControlVisibility, createdAt, updatedAt, createdAtDisplay, capabilities);
    }
}
