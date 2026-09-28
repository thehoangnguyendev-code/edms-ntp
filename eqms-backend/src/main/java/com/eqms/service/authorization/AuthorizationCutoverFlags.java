package com.eqms.service.authorization;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Phase 1-2.5 feature flag (SECURITY_AUTHORIZATION_HYBRID_REFACTOR_PLAN.md §7 cutover rule 3):
 * per-resource-type switch deciding whether the real enforcement decision comes from
 * {@link AuthorizationEngineService} (flag on) or the legacy evaluator (flag off, default).
 *
 * <p>Deliberately environment-variable-driven rather than DB-backed: the Authorization Console
 * (Phase 4) that would let an admin toggle this from a UI doesn't exist yet, and an env var gives
 * the same rollback guarantee (unset + restart) with far less surface area in the meantime.
 *
 * <p><b>This rollback guarantee no longer holds for every resource type.</b> REVISION
 * ({@link com.eqms.service.RevisionWorkflowAuthorizationService}) and USER's
 * SUSPEND/TERMINATE/DELETE actions ({@link com.eqms.service.UserManagementService
 * #requireUserActionAllowed}) have had their legacy decision trees physically deleted after
 * real-traffic shadow evaluation confirmed zero mismatches -- both call
 * {@link AuthorizationEngineService} unconditionally and never consult this class. Unsetting the
 * env var and restarting does nothing for those two; a genuine rollback there would require
 * restoring the deleted legacy code, not just flipping this flag. Every other resource type
 * (DOCUMENT, CONTROLLED_COPY, CONTROLLED_COPY_BATCH, and USER's non-lifecycle actions) still has
 * its legacy evaluator intact and is governed by this flag as originally designed.
 */
@Component
public class AuthorizationCutoverFlags {

    private final Set<String> enabledResourceTypes;

    public AuthorizationCutoverFlags(
            @Value("${app.authorization.hybrid-engine.enabled-resource-types:}") String enabledResourceTypesRaw
    ) {
        this.enabledResourceTypes = enabledResourceTypesRaw == null || enabledResourceTypesRaw.isBlank()
                ? Set.of()
                : Arrays.stream(enabledResourceTypesRaw.split(","))
                        .map(String::trim)
                        .filter(s -> !s.isBlank())
                        .map(s -> s.toUpperCase(Locale.ROOT))
                        .collect(Collectors.toUnmodifiableSet());
    }

    public boolean isEnabled(String resourceType) {
        return resourceType != null && enabledResourceTypes.contains(resourceType.toUpperCase(Locale.ROOT));
    }
}
