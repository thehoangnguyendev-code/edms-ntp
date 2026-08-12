package com.eqms.dto.document;

import jakarta.validation.constraints.NotBlank;

public record DocumentObsoleteRequest(
        @NotBlank(message = "Obsolete reason is required")
        String reason,
        String obsoleteDate,
        String signatureToken
) {
}
