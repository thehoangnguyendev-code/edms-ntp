package com.eqms.dto.settings;

import java.util.List;
import java.util.UUID;

/** Bodies for access profile bulk assignment endpoints with e-sign payload. */
public final class AccessProfileAssignmentRequest {

    private AccessProfileAssignmentRequest() {}

    public record PermissionSets(List<UUID> permissionSetIds, String signatureToken, String reason) {}

    public record WorkflowRoles(List<String> roles, String signatureToken, String reason) {}
}
