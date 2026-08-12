package com.eqms.dto;

import java.util.UUID;

public record PromptSpecificationSummaryResponse(
        UUID id,
        String moduleName,
        String promptTitle,
        String status,
        String createdAt,
        String updatedAt,
        int generationRunCount
) {
}
