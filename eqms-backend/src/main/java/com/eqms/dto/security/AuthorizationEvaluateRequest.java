package com.eqms.dto.security;

import java.util.Map;
import java.util.UUID;

/** Simulator input for {@code POST /authorization/evaluate} (SECURITY_AUTHORIZATION_HYBRID_REFACTOR_PLAN.md §5.2). */
public record AuthorizationEvaluateRequest(
        UUID subjectUserId,
        String resourceType,
        UUID resourceId,
        String actionCode,
        Map<String, Object> context,
        /** The code a person knows the record by (a report template code), for the resource types whose id is made from it; used when resourceId is empty. */
        String resourceCode
) {}
