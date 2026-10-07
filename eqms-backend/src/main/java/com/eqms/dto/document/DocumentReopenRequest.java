package com.eqms.dto.document;

import jakarta.validation.constraints.NotBlank;

/** Reopen of a closed Document: why, and the one-time e-signature token that signs it. */
public record DocumentReopenRequest(
        @NotBlank(message = "Reopen reason is required")
        String reason,
        String signatureToken
) {
}
