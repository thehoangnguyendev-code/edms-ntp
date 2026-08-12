package com.eqms.dto.settings;

/**
 * Re-authentication payload for critical security administration changes.
 * The signature token is minted by POST /auth/verify-signature.
 */
public record SecurityChangeRequest(
        String signatureToken,
        String reason
) {
    public static SecurityChangeRequest empty() {
        return new SecurityChangeRequest(null, null);
    }

    public static SecurityChangeRequest orEmpty(SecurityChangeRequest request) {
        return request == null ? empty() : request;
    }
}
