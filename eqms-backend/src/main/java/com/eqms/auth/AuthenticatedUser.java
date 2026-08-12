package com.eqms.auth;

import java.util.Set;
import java.util.UUID;

public record AuthenticatedUser(
        UUID userId,
        UUID sessionId,
        String username,
        String role,
        Set<String> permissions
) {
}
