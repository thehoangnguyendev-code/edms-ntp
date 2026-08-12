package com.eqms.exception;

import java.util.UUID;

public record RevisionWorkspaceValidationIssue(
        Integer itemOrder,
        UUID documentId,
        UUID parentDocumentId,
        UUID sourceDocumentId,
        UUID sourceRevisionId,
        String field,
        String message
) {}
