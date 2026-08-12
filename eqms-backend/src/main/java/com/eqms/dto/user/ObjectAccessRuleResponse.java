package com.eqms.dto.user;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ObjectAccessRuleResponse(
    UUID id,
    String name,
    String description,
    UUID accessProfileId,
    String accessProfileName,
    String resourceType,
    UUID resourceId,
    String resourceName,
    List<String> actions,
    String effect,
    int priority,
    boolean active,
    Instant createdAt,
    Instant updatedAt
) {}
