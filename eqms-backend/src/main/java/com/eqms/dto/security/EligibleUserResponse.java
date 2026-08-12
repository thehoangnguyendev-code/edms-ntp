package com.eqms.dto.security;

import java.util.UUID;

/**
 * Reduced user shape returned by the "eligible users by permission" endpoint.
 * Intentionally not the full UserResponse — pickers only need enough to display and select.
 */
public record EligibleUserResponse(
        UUID id,
        String employeeCode,
        String fullName,
        String position,
        String email,
        String department
) {
}
