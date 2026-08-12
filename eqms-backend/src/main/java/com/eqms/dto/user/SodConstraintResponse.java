package com.eqms.dto.user;

import java.time.Instant;
import java.util.UUID;

public record SodConstraintResponse(
    UUID id,
    String name,
    String description,
    String permissionCodeA,
    String permissionCodeB,
    String permissionNameA,
    String permissionNameB,
    String severity,
    String regulationRef,
    boolean active,
    boolean system,
    Instant createdAt,
    Instant updatedAt
) {}
