package com.eqms.dto.knowledge;

import java.time.Instant;
import java.util.UUID;

public final class KnowledgeComponentDtos {

    private KnowledgeComponentDtos() {}

    public record ComponentRequest(String name, String sourceField, String description, Boolean active) {}

    public record ComponentResponse(
            UUID id,
            String name,
            String sourceField,
            String sourceLabel,
            String description,
            boolean active,
            boolean systemDefined,
            boolean determinatorEligible,
            long usedByHierarchies,
            Instant createdAt,
            Instant updatedAt,
            String updatedByName
    ) {}

    public record SourceOption(String value, String label, boolean determinatorEligible) {}
}
