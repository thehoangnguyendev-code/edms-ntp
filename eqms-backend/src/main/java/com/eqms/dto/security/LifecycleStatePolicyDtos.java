package com.eqms.dto.security;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** DTOs for the Lifecycle State Policy admin API. */
public final class LifecycleStatePolicyDtos {

    private LifecycleStatePolicyDtos() {}

    public record LifecycleStatePolicyResponse(
            UUID id,
            String moduleKey,
            String objectType,
            String capabilityCode,
            String statusCode,
            String statusLabel,
            UUID documentTypeId,
            String documentTypeName,
            String actorScope,
            String requiredPermissionCode,
            int priority,
            boolean active,
            boolean system,
            String description,
            Instant createdAt,
            Instant updatedAt
    ) {}

    public record LifecycleStatePolicyRequest(
            String capabilityCode,
            String statusCode,
            UUID documentTypeId,
            String actorScope,
            String requiredPermissionCode,
            Integer priority,
            Boolean active,
            String description,
            String reason,
            String signatureToken
    ) {}

    public record OptionItem(String value, String label) {}

    public record LifecycleStatePolicyOptionsResponse(
            List<String> capabilities,
            List<String> actorScopes,
            List<OptionItem> statuses,
            List<OptionItem> permissions,
            List<OptionItem> documentTypes
    ) {}
}
