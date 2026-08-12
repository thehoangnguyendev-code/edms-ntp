package com.eqms.dto.user;

import com.fasterxml.jackson.databind.JsonNode;

public record SystemConfigurationResponse(
        JsonNode general,
        JsonNode security,
        JsonNode documents,
        JsonNode notifications,
        JsonNode integrations,
        JsonNode features
) {
}
