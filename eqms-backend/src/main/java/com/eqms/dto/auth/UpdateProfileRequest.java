package com.eqms.dto.auth;

import jakarta.validation.constraints.Size;

public record UpdateProfileRequest(
        String fullName,
        String phone,
        // Defense-in-depth: the crop UI always exports a fixed 256x256 image (a few hundred KB of
        // base64 at most), but this endpoint has no client-side enforcement -- a direct API call
        // could otherwise submit an arbitrarily large payload. 2,000,000 chars (~1.5MB decoded) is
        // generous headroom above any legitimate cropped avatar.
        @Size(max = 2_000_000, message = "Avatar image is too large") String avatar,
        String email
) {
}
