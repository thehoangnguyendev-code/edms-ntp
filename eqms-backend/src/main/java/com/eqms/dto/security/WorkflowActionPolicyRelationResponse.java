package com.eqms.dto.security;

import java.util.UUID;

/** One relation requirement on a WorkflowActionPolicy (§3.1) -- distinct from the legacy {@code actors} list. */
public record WorkflowActionPolicyRelationResponse(
        UUID id,
        UUID relationDefinitionId,
        String relationCode,
        String relationDisplayName,
        String resolverCode,
        int priority
) {}
