package com.eqms.dto.auth;

public record PasswordPolicyResponse(
        int passwordMinLength,
        boolean requireUppercase,
        boolean requireLowercase,
        boolean requireNumbers,
        boolean requireSpecialChars
) {
}
