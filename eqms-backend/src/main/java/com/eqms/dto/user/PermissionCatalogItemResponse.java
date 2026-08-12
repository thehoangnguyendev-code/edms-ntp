package com.eqms.dto.user;

public record PermissionCatalogItemResponse(
        String code,
        String name,
        String description,
        String module,
        String group,
        int order,
        boolean requiresAudit
) {
}
