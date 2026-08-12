package com.eqms.dto.auth;

import java.util.List;

public record LoginChallengeResponse(
        boolean mfaRequired,
        String mfaToken,
        List<String> availableMethods,
        String maskedEmail,
        String username,
        long expiresIn,
        boolean rememberDeviceAllowed
) {
}
