package com.eqms.dto.settings;

import java.util.List;

/**
 * Replace the individually-picked permissions of a role — the contents of its
 * auto-managed ROLE_<code> permission set. Empty codes detaches and deletes the set.
 */
public record ManagedPermissionsRequest(
        List<String> codes,
        String signatureToken,
        String reason
) {}
