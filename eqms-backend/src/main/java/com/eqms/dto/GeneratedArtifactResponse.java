package com.eqms.dto;

import java.util.UUID;

public record GeneratedArtifactResponse(
        UUID id,
        String artifactType,
        String filePath,
        String contentHash,
        String createdAt
) {
}
