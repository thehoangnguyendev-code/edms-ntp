package com.eqms.dto.user;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public record ObjectAccessRuleOptionsResponse(
        List<String> resourceTypes,
        List<String> actions,
        List<String> effects,
        /** Selectable resource names per resource type — pickers instead of typed names. */
        Map<String, List<String>> resourceValues,
        List<AccessProfileOption> accessProfiles
) {
    public record AccessProfileOption(UUID id, String name, String code) {}
}
