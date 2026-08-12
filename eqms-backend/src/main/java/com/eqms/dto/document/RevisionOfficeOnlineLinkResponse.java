package com.eqms.dto.document;

public record RevisionOfficeOnlineLinkResponse(
        String url,
        String configuredScope,
        String effectiveScope,
        String fetchedAt
) {
}
