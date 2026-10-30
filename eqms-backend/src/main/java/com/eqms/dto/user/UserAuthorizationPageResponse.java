package com.eqms.dto.user;

import java.util.List;
import java.util.UUID;

/** Selection IDs describe the whole assignment; accessProfiles contains only the requested page. */
public record UserAuthorizationPageResponse(UUID userId,
        List<UserAuthorizationSummaryResponse.AccessProfile> accessProfiles,
        int effectivePermissionCount, List<UUID> assignedProfileIds, PaginationResponse pagination) {}
