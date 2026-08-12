package com.eqms.dto.document;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RevisionWorkingNoteRequest(
        @NotBlank(message = "Working note is required")
        @Size(max = 4000, message = "Working note must not exceed 4000 characters")
        String content
) {
}
