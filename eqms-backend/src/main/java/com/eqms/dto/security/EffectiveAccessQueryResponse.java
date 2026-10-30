package com.eqms.dto.security;

import java.util.List;
import java.util.UUID;

/** Filtered evaluated matrix; totals describe the unfiltered authorized evaluation. */
public record EffectiveAccessQueryResponse(UUID accessProfileId, String accessProfileName, UUID documentTypeId,
        boolean objectAccessRulesApplicable, String objectAccessRulesNote, List<EffectiveAccessRowResponse> rows,
        Summary summary) {
    public record Summary(int total, long allowed, long denied) {}
}
