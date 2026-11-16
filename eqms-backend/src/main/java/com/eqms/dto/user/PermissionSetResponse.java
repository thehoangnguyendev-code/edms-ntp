package com.eqms.dto.user;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record PermissionSetResponse(
    UUID id,
    String name,
    String code,
    String description,
    boolean active,
    boolean system,
    /** A DEV/UAT/test set (display badge only). */
    boolean testData,
    int permissionCount,
    List<String> permissionCodes,
    /** Distinct module keys covered by this set (server-computed for filtering/display). */
    List<String> modules,
    /** Derived category bucket (server-computed, mirrors list filter options). */
    String category,
    Instant createdAt,
    Instant updatedAt,
        PermissionSetCapabilitiesResponse capabilities
) {
    /** Compatibility constructor for existing detail/mutation responses. */
    public PermissionSetResponse(
            UUID id,
            String name,
            String code,
            String description,
            boolean active,
            boolean system,
            boolean testData,
            int permissionCount,
            List<String> permissionCodes,
            List<String> modules,
            String category,
            Instant createdAt,
            Instant updatedAt) {
        this(id, name, code, description, active, system, testData, permissionCount, permissionCodes, modules, category, createdAt, updatedAt, null);
    }

    public PermissionSetResponse withCapabilities(PermissionSetCapabilitiesResponse capabilities) {
        return new PermissionSetResponse(id, name, code, description, active, system, testData, permissionCount, permissionCodes, modules, category, createdAt, updatedAt, capabilities);
    }
}
