package com.eqms.dto.security;

import java.time.Instant;
import java.util.UUID;

public record AuthorizationShadowMismatchResponse(
        UUID id, String resourceType, UUID resourceId, String actionCode, UUID subjectUserId,
        boolean policyAllowed, String policyReasonCode, boolean legacyAllowed, String legacyReasonCode,
        Instant createdAt
) {}
