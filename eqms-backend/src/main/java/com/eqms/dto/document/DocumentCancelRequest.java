package com.eqms.dto.document;

import jakarta.validation.constraints.NotBlank;

public record DocumentCancelRequest(
        @NotBlank(message = "Activity summary is required")
        String activitySummary
) {
}
