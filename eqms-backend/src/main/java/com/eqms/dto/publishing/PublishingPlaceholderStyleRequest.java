package com.eqms.dto.publishing;

import com.eqms.service.PublishingPlaceholderStyleConfig;
import jakarta.validation.constraints.NotBlank;

public record PublishingPlaceholderStyleRequest(
        @NotBlank String componentType,
        @NotBlank String layout,
        @NotBlank String placeholderKey,
        String placeholderToken,
        String placeholderType,
        PublishingPlaceholderStyleConfig style
) {}
