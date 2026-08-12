package com.eqms.dto.document;

import java.util.UUID;

public record RevisionWorkspaceItemRequest(
        UUID documentId,
        UUID parentDocumentId,
        UUID sourceDocumentId,
        UUID sourceRevisionId,
        UUID targetRevisionId,
        String decision,
        Integer itemOrder,
        DocumentDraftCreateRequest draft
) {}
