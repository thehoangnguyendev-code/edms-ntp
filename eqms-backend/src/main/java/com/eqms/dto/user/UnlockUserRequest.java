package com.eqms.dto.user;

public record UnlockUserRequest(
        String signatureToken,
        String reason
) {
}
