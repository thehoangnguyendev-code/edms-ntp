package com.eqms.dto.user;

public record UserResetPasswordRequest(
        Boolean sendEmail,
        String newPassword,
        String signatureToken,
        String reason
) {
}
