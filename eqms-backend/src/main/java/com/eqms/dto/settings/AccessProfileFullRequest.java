package com.eqms.dto.settings;

import java.util.List;
import java.util.UUID;

/**
 * Atomic "create role in one shot" payload for the New Role wizard:
 * profile basics + optional individually-picked permission codes (stored in an
 * auto-managed ROLE_<code> permission set) + shared permission set attachments
 * + workflow roles + initial user assignments — all under a single e-signature.
 */
public record AccessProfileFullRequest(
        String name,
        String description,
        boolean active,
        String businessUnitScope,
        String departmentScope,
        List<String> permissionCodes,
        List<UUID> permissionSetIds,
        List<String> workflowRoles,
        List<UUID> userIds,
        String signatureToken,
        String reason
) {}
