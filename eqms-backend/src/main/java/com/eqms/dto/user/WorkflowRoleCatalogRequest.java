package com.eqms.dto.user;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record WorkflowRoleCatalogRequest(
    @NotBlank @Size(max = 100) String code,
    @NotBlank @Size(max = 255) String label,
    @Size(max = 100) String moduleKey,
    @Size(max = 2000) String description,
    Integer displayOrder,
    boolean active,
    String signatureToken,
    @Size(max = 2000) String reason
) {}
