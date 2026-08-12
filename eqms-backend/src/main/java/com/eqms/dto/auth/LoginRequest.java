package com.eqms.dto.auth;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotBlank;

public record LoginRequest(
        @JsonAlias({"username", "email"})
        @NotBlank(message = "Username or email is required")
        String identifier,
        @NotBlank(message = "Password is required")
        String password
) {
}
