package com.eqms.dto.document;

public record RevisionCreationRequest(
        String changeDescription,
        String revisionType,
        String templateRevisionId
) {
}
