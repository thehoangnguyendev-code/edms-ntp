package com.eqms.dto.publishing;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record PublishingTemplateComponentResponse(
        UUID id,
        String componentType,
        String layout,
        String objectKey,
        String fileName,
        String checksum,
        Integer versionNumber,
        String status,
        List<String> detectedPlaceholders,
        boolean previewAvailable,
        Instant uploadedAt,
        String uploadedBy
) {}
