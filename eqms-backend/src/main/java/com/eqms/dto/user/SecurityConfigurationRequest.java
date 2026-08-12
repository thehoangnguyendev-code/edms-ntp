package com.eqms.dto.user;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record SecurityConfigurationRequest(
        @NotNull
        @Min(1)
        @Max(1440)
        Integer sessionTimeoutMinutes
) {
}
