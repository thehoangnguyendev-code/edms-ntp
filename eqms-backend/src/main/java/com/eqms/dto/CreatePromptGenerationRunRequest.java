package com.eqms.dto;

import jakarta.validation.constraints.Size;

public record CreatePromptGenerationRunRequest(
        @Size(max = 255)
        String targetFrontendPath,

        @Size(max = 255)
        String targetBackendPath,

        @Size(max = 255)
        String targetDatabasePath,

        String notes
) {
}
