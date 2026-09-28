package com.eqms.dto.knowledge;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class KnowledgeHierarchyDtos {

    private KnowledgeHierarchyDtos() {}

    /** One level of the desired final list; id is null for a level that does not exist yet. */
    public record LevelInput(UUID id, String fieldCode) {}

    /**
     * levels, when not null, is the complete desired level list in order and is saved together with the
     * header fields in one transaction; null leaves the levels untouched.
     */
    public record HierarchyRequest(String name, String description, String determinatorField, Boolean active,
                                   List<LevelInput> levels) {
        public HierarchyRequest(String name, String description, String determinatorField, Boolean active) {
            this(name, description, determinatorField, active, null);
        }
    }

    public record LevelRequest(String fieldCode, Integer displayOrder) {}

    public record LevelResponse(UUID id, String fieldCode, String fieldLabel, int displayOrder) {}

    public record HierarchyResponse(
            UUID id,
            String name,
            String description,
            String determinatorField,
            String determinatorLabel,
            boolean active,
            boolean isDefault,
            List<LevelResponse> levels,
            Instant createdAt,
            Instant updatedAt,
            String updatedByName
    ) {}

    public record FieldOption(String value, String label, boolean determinatorEligible) {}

    public record ReorderRequest(List<UUID> levelIds) {}
}
