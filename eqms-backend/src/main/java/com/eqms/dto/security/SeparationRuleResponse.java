package com.eqms.dto.security;

import java.util.UUID;

/** One "a different person" rule an administrator can switch on or off (V821). ON while its policy carries an active forbidden relation. */
public record SeparationRuleResponse(
        UUID id,
        String moduleKey,
        String moduleLabel,
        String workflowKey,
        String workflowLabel,
        String objectType,
        String actionCode,
        String actionLabel,
        String fromStatus,
        String fromStatusLabel,
        String relationCode,
        String relationLabel,
        String description,
        boolean enabled,
        UUID policyId,
        boolean policyActive
) {}
