package com.eqms.dto.email;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

import java.util.Map;

public record EmailTemplateTestSendRequest(
        @NotBlank
        @Email
        String to,
        Map<String, String> variables
) {
}
