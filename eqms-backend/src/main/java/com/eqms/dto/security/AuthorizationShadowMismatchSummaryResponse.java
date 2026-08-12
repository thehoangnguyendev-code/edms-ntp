package com.eqms.dto.security;

/** Per-resource-type totals for the Engine Health tab summary cards -- independent of whatever
 * page/filter is currently applied to the mismatch table. */
public record AuthorizationShadowMismatchSummaryResponse(
        String resourceType,
        long total,
        long mismatches
) {}
