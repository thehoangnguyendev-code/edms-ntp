package com.eqms.dto.user;

import java.util.List;

public record PermissionCatalogItemResponse(
        String code,
        String name,
        String description,
        String module,
        String group,
        int order,
        boolean requiresAudit,
        List<PermissionLifecycleUsageResponse> lifecycleUsages
) {
}
