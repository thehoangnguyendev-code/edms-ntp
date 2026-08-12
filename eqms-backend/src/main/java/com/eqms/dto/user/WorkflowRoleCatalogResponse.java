package com.eqms.dto.user;

import java.time.Instant;
import java.util.UUID;

public record WorkflowRoleCatalogResponse(
    UUID id,
    String code,
    String label,
    String moduleKey,
    String description,
    int displayOrder,
    boolean active,
    boolean system,
    Instant createdAt,
    Instant updatedAt
) {}
