package com.eqms.dto.email;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;

public record EmailTemplateRequest(
    @NotBlank(message = "Template name is required")
    @Size(max = 100, message = "Name must not exceed 100 characters")
    String name,

    @NotBlank(message = "Template type is required")
    @Size(max = 50, message = "Type must not exceed 50 characters")
    String type,

    @NotBlank(message = "Subject is required")
    @Size(max = 200, message = "Subject must not exceed 200 characters")
    String subject,

    @NotBlank(message = "Content body is required")
    String content,

    @NotBlank(message = "Status is required")
    @Size(max = 20, message = "Status must not exceed 20 characters")
    String status,

    List<String> variables,

    @Size(max = 500, message = "Description must not exceed 500 characters")
    String description,

    String logoUrl,

    @Size(max = 255, message = "Logo file name must not exceed 255 characters")
    String logoFileName,

    String copyright,

    @Size(max = 255, message = "Contact email must not exceed 255 characters")
    String contactEmail,

    @Size(max = 20, message = "Primary color must not exceed 20 characters")
    String primaryColor,

    String reason,

    String signatureToken
) {}
