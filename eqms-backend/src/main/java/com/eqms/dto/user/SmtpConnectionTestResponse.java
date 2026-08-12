package com.eqms.dto.user;

public record SmtpConnectionTestResponse(
        boolean success,
        String message
) {}
