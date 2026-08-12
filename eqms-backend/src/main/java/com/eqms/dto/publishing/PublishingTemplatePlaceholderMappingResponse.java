package com.eqms.dto.publishing;

public record PublishingTemplatePlaceholderMappingResponse(
        String placeholder,
        String revisionField,
        String label,
        String sampleValue,
        String sourceSection
) {}
