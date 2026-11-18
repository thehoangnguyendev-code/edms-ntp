package com.eqms.dto.user;

/** Reset the multi-factor authentication of another person: why, and the electronic signature of the administrator who does it. */
public record ResetMfaRequest(String reason, String signatureToken) {
}
