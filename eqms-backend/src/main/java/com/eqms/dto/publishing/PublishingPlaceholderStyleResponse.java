package com.eqms.dto.publishing;

import com.eqms.service.PublishingPlaceholderStyleConfig;
import java.time.Instant;
import java.util.UUID;

public record PublishingPlaceholderStyleResponse(
        UUID id,
        UUID templateId,
        UUID templateVersionId,
        Integer templateVersionNumber,
        String componentType,
        String layout,
        String placeholderKey,
        String placeholderToken,
        String placeholderType,
        PublishingPlaceholderStyleConfig style,
        Instant createdAt,
        Instant updatedAt,
        String createdBy,
        String updatedBy
) {}
