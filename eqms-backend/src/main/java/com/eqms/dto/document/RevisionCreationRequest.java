package com.eqms.dto.document;

public record RevisionCreationRequest(
        String changeDescription,
        String templateRevisionId,
        /** Start from the Word file of the Effective revision (DEC-DOC-2026-11-27-01). Not combined with an uploaded file or a template. */
        boolean useEffectiveSource
) {
    public RevisionCreationRequest(String changeDescription, String templateRevisionId) {
        this(changeDescription, templateRevisionId, false);
    }
}
