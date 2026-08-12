package com.eqms.dto.security;

import java.util.List;
import java.util.UUID;

/**
 * Response for {@code GET /security/access-profiles/{id}/effective-access}.
 *
 * When {@code documentTypeId} is not supplied, Object Access Rules are not evaluated at all
 * ({@code objectAccessRulesApplicable = false}) — every "allowed" row can still be further
 * restricted by an Object Access Rule once applied to a real document/revision. See
 * {@code objectAccessRulesNote} for the exact caveat to surface to the admin.
 */
public record EffectiveAccessResponse(
        UUID accessProfileId,
        String accessProfileName,
        UUID documentTypeId,
        boolean objectAccessRulesApplicable,
        String objectAccessRulesNote,
        List<EffectiveAccessRowResponse> rows
) {
}
