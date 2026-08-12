package com.eqms.dto.security;

/**
 * Module-neutral capability payload. Existing module-specific capability endpoints remain
 * available; this is the common contract for new consumers such as My Tasks and future modules.
 */
public record ResourceActionCapabilityResponse(
        boolean allowed,
        String reasonCode,
        String reasonMessage,
        String requiredPermissionCode,
        boolean requiresESignature
) {
}
