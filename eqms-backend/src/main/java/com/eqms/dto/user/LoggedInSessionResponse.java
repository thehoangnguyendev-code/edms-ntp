package com.eqms.dto.user;

import java.time.Instant;
import java.util.UUID;

/** One live session row for the "Logged in Users" admin screen. */
public record LoggedInSessionResponse(
        UUID sessionId,
        UUID userId,
        String employeeCode,
        String fullName,
        String username,
        String email,
        String department,
        String position,
        String deviceName,
        String ipAddress,
        String userAgent,
        boolean currentSession,
        /** Active session AND activity within the last 5 minutes -- same "Online" definition
         *  UserManagementService already uses for the User Management list's Online filter. */
        boolean online,
        Instant lastLoginAt,
        Instant createdAt,
        Instant lastActivityAt,
        Instant expiresAt
) {
}
