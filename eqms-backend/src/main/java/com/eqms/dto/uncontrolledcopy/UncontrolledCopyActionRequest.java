package com.eqms.dto.uncontrolledcopy;

/** Body for approve / reject / generate / distribute / cancel. {@code reason} doubles as the comment. */
public record UncontrolledCopyActionRequest(
        String reason,
        String signatureToken
) {
}
