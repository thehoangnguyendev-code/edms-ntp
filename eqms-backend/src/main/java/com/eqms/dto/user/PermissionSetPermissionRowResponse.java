package com.eqms.dto.user;

import java.util.List;

/** One permission of one Permission Set, as the Permission Set dialog lists it. */
public record PermissionSetPermissionRowResponse(
        String code,
        String name,
        String description,
        String module,
        boolean requiresAudit,
        List<PermissionLifecycleUsageResponse> lifecycleUsages
) {
}
