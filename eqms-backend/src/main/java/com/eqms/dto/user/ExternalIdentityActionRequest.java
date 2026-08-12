package com.eqms.dto.user;

import jakarta.validation.constraints.NotBlank;

public record ExternalIdentityActionRequest(@NotBlank String reason) {}
