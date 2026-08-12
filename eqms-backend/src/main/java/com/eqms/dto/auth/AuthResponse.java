package com.eqms.dto.auth;

import java.util.List;

public record AuthResponse(
        AuthUserResponse user,
        String accessToken,
        String refreshToken,
        long expiresIn
) {
}
