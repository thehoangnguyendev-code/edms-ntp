package com.eqms.dto.settings;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Aggregate "save role configuration" payload — the full desired state of a role,
 * applied in one transaction under one e-signature. `expectedUpdatedAt` is the
 * profile's updatedAt the admin loaded; a mismatch means another admin saved in
 * between and the request is rejected with 409 (optimistic concurrency).
 *
 * Null sections are left untouched (e.g. general == null means "don't change basics"),
 * so callers only send what their screen edits. Non-null lists are replace-semantics.
 */
public record AccessProfileConfigurationRequest(
        Instant expectedUpdatedAt,
        General general,
        List<String> managedPermissionCodes,
        List<UUID> sharedPermissionSetIds,
        List<String> workflowRoles,
        List<UUID> userIds,
        String signatureToken,
        String reason
) {
    public record General(
            String name,
            String description,
            boolean active,
            String businessUnitScope,
            String departmentScope
    ) {}
}
