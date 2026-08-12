package com.eqms.dto.auth;

public record LogoutRequest(
        String refreshToken
) {
}
