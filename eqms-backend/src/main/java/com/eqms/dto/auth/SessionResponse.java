package com.eqms.dto.auth;

public record SessionResponse(
        String sessionId,
        String device,
        String ipAddress,
        String lastActivity,
        boolean current
) {
}
