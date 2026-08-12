package com.eqms.dto.security;

import com.eqms.entity.AuthorizationRelationDefinition;
import com.fasterxml.jackson.databind.JsonNode;

import java.time.Instant;
import java.util.UUID;

public record AuthorizationRelationDefinitionResponse(
        UUID id,
        String code,
        String displayName,
        String resourceType,
        String resolverCode,
        JsonNode resolverConfig,
        String description,
        boolean active,
        Instant updatedAt
) {
    public static AuthorizationRelationDefinitionResponse from(AuthorizationRelationDefinition d) {
        return new AuthorizationRelationDefinitionResponse(
                d.getId(), d.getCode(), d.getDisplayName(), d.getResourceType(), d.getResolverCode(),
                d.getResolverConfig(), d.getDescription(), d.isActive(), d.getUpdatedAt());
    }
}
