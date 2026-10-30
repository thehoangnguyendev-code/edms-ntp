package com.eqms.dto.user;

public record SecurityConfigurationResponse(
        int sessionTimeoutMinutes,
        boolean sessionTimeoutEnabled
) {
}
