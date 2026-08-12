package com.eqms.dto.user;

import java.util.List;

public record RoleSummaryResponse(
        String id,
        String code,
        String role,
        String description,
        String type,
        boolean active,
        long userCount,
        List<String> permissions,
        String createdDate,
        String modifiedDate
) {
}
