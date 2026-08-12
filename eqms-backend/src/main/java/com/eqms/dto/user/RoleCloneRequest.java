package com.eqms.dto.user;

public record RoleCloneRequest(
        String role,
        String code,
        String reason,
        String signatureToken
) {
}
