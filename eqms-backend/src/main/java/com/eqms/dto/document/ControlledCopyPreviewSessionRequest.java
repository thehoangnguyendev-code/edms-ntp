package com.eqms.dto.document;

import jakarta.validation.constraints.NotBlank;

public record ControlledCopyPreviewSessionRequest(@NotBlank String token, String password) {}
