package com.eqms.dto.user;

import java.util.List;

public record UserPermissionsResponse(
        String userId,
        String role,
        List<String> permissions
) {
}
