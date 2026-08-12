package com.eqms.dto.user;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

public record SmtpConnectionTestRequest(
        @NotBlank String smtpHost,
        @Min(1) int smtpPort,
        @NotBlank String smtpUsername,
        @NotBlank String smtpPassword,
        @Email @NotBlank String senderEmail,
        @NotBlank String senderName,
        boolean useSSL
) {}
