package com.eqms.dto.user;

import jakarta.validation.constraints.NotBlank;

/**
 * A suspension or a termination. {@code suspensionKind} (suspension only): LONG_LEAVE (the person is away for a long time: leave, maternity, sickness) or OTHER (a security or
 * administrative reason). Training Management reads it to know whether the return of the person asks for a training review (SOP.0003 5.1.1); absent means it is not said.
 */
public record StatusActionRequest(
        @NotBlank String reason,
        String date,
        @NotBlank String signatureToken,
        String suspensionKind
) {
    public StatusActionRequest(String reason, String date, String signatureToken) {
        this(reason, date, signatureToken, null);
    }
}
