package com.eqms.dto.security;

/** Per-resource-type totals for the Engine Health tab summary cards -- independent of whatever
 * page/filter is currently applied to the mismatch table. {@code cutoverComplete} marks resource
 * types whose legacy evaluator was physically removed (not flag-gated): their totals are a frozen
 * historical snapshot, not evidence of ongoing live monitoring. */
public record AuthorizationShadowMismatchSummaryResponse(
        String resourceType,
        long total,
        long mismatches,
        boolean cutoverComplete
) {}
