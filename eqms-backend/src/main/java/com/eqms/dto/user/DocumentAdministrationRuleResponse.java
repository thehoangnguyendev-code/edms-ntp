package com.eqms.dto.user;

public record DocumentAdministrationRuleResponse(
        String code,
        String label,
        String description,
        boolean enabled
) {
}
