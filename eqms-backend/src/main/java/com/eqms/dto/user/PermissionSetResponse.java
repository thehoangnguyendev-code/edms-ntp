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
    int permissionCount,
    List<String> permissionCodes,
    /** Distinct module keys covered by this set (server-computed for filtering/display). */
    List<String> modules,
    /** Derived category bucket (server-computed, mirrors list filter options). */
    String category,
    Instant createdAt,
    Instant updatedAt
) {}
