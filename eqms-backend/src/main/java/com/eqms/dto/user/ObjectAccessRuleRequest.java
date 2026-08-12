package com.eqms.dto.user;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

public record ObjectAccessRuleRequest(
    @NotBlank @Size(max = 255) String name,
    @Size(max = 2000) String description,
    UUID accessProfileId,
    @NotBlank @Size(max = 100) String resourceType,
    UUID resourceId,
    @Size(max = 255) String resourceName,
    List<String> actions,
    @Size(max = 50) String effect,
    int priority,
    boolean active,
    String signatureToken,
    @Size(max = 2000) String reason
) {}
