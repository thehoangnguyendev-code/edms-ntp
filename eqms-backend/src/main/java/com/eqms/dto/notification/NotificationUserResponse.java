package com.eqms.dto.notification;

import java.util.UUID;

public record NotificationUserResponse(
        UUID id,
        String username,
        String fullName,
        String employeeCode,
        String email,
        String roleName,
        String position,
        String department,
        String businessUnit
) {
}
