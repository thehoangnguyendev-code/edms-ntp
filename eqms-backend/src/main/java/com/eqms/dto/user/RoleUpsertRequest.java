package com.eqms.dto.user;

import jakarta.validation.constraints.NotBlank;

import java.util.List;

public record RoleUpsertRequest(
        @NotBlank String role,
        String code,
        String description,
        Boolean active,
        List<String> permissions,
        String signatureToken,
        String reason
) {
}
