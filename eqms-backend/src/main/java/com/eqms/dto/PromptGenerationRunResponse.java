package com.eqms.dto;

import java.util.List;
import java.util.UUID;

public record PromptGenerationRunResponse(
        UUID id,
        String status,
        String targetFrontendPath,
        String targetBackendPath,
        String targetDatabasePath,
        String generatedAt,
        String notes,
        List<GeneratedArtifactResponse> artifacts
) {
}
