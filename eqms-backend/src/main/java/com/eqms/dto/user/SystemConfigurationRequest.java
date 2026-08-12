package com.eqms.dto.user;

import com.fasterxml.jackson.databind.JsonNode;

public record SystemConfigurationRequest(
        JsonNode general,
        JsonNode security,
        JsonNode documents,
        JsonNode notifications,
        JsonNode integrations,
        JsonNode features
) {
}
