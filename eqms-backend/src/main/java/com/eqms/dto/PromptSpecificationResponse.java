package com.eqms.dto;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public record PromptSpecificationResponse(
        UUID id,
        String moduleName,
        String promptTitle,
        String promptText,
        Map<String, Object> specPayload,
        String status,
        String createdAt,
        String updatedAt,
        List<PromptGenerationRunResponse> generationRuns
) {
}
