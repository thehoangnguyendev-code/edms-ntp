package com.eqms.dto.user;

/** Flat (non-grouped) row for paginated, sortable permission-catalog browsing. */
public record PermissionCatalogFlatResponse(
        String code,
        String name,
        String description,
        String module,
        String groupName,
        boolean requiresAudit
) {
}
