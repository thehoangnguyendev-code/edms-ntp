package com.eqms.dto.security;

import java.util.Map;

public record AuthorizationContext(
        String module,
        String workflow,
        String workflowState,
        String action,
        Map<String, Object> attributes
) {
    public static AuthorizationContext simple(String action) {
        return new AuthorizationContext(null, null, null, action, Map.of());
    }

    public static AuthorizationContext ofModule(String module, String action) {
        return new AuthorizationContext(module, null, null, action, Map.of());
    }

    public static AuthorizationContext workflow(String module, String workflow, String state, String action) {
        return new AuthorizationContext(module, workflow, state, action, Map.of());
    }
}
