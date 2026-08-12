package com.eqms.dto.document;

import java.util.Map;

/** Read-only, immutable provenance for a revision created from a document template. */
public record TemplateLineageResponse(
        String sourceDocumentId,
        String sourceDocumentNumber,
        String sourceDocumentName,
        String sourceRevisionId,
        String sourceRevisionNumber,
        String sourceFileChecksum,
        String targetFileChecksum,
        String selectedBy,
        String selectedAt,
        Map<String, Object> placeholderSnapshot
) {
}
