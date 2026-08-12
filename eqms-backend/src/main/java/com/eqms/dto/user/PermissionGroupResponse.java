package com.eqms.dto.user;

import java.util.List;

public record PermissionGroupResponse(
        String id,
        String name,
        String description,
        List<PermissionCatalogItemResponse> permissions
) {
}
