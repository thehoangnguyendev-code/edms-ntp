package com.eqms.dto.email;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record EmailTemplateVersionResponse(
        UUID id,
        UUID templateId,
        int versionNumber,
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
        String changeSummary,
        String createdBy,
        Instant createdAt,
        String publishedBy,
        Instant publishedAt
) {}
