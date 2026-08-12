package com.eqms.dto.email;

import java.util.List;
import java.util.UUID;

public record EmailTemplateResponse(
    UUID id,
    String name,
    String type,
    String subject,
    String content,
    String status,
    List<String> variables,
    String description,
    String logoUrl,
    String logoFileName,
    String copyright,
    String contactEmail,
    String primaryColor,
    int usageCount,
    String lastUsed,
    String createdDate,
    String updatedDate,
    String createdBy,
    String updatedBy,
    Integer latestVersionNumber
) {}
