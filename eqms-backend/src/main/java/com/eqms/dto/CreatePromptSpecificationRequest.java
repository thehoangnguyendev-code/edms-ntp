package com.eqms.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.LinkedHashMap;
import java.util.Map;

public record CreatePromptSpecificationRequest(
        @NotBlank
        @Size(max = 120)
        String moduleName,

        @NotBlank
        @Size(max = 200)
        String promptTitle,

        @NotBlank
        String promptText,

        @NotNull
        Map<String, Object> specPayload
) {
    public CreatePromptSpecificationRequest {
        specPayload = specPayload == null ? new LinkedHashMap<>() : new LinkedHashMap<>(specPayload);
    }
}
