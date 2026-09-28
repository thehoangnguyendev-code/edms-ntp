package com.eqms.dto.user;

/**
 * One (object type, from-status, action) tuple that requires the enclosing permission code, surfaced
 * so an Admin configuring a Permission Set/Access Profile can see at a glance which lifecycle states
 * a permission actually applies to -- without leaving the Permission Catalog/permission-picker screen
 * to cross-reference the separate Workflow Authorization screen.
 */
public record PermissionLifecycleUsageResponse(
        String objectType,
        String objectTypeLabel,
        String fromStatus,
        String fromStatusLabel,
        String action,
        String actionLabel
) {
}
