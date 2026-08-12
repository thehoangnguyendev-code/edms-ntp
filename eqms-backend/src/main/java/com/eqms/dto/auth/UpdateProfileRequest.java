package com.eqms.dto.auth;

public record UpdateProfileRequest(
        String fullName,
        String phone,
        String avatar,
        String email
) {
}
