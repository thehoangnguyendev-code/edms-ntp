package com.eqms.dto.document;

import java.util.UUID;

public record RevisionWorkspaceBatchItemResponse(
        UUID workspaceItemId,
        Integer itemOrder,
        UUID documentId,
        UUID parentDocumentId,
        UUID sourceDocumentId,
        UUID sourceRevisionId,
        UUID targetRevisionId,
        String decision,
        String documentNumber,
        String documentName,
        String revisionNumber,
        String nextRevisionNumber,
        String itemStatus,
        String revisionStatus,
        String fileName,
        String filePath,
        String previewFilePath,
        String errorCode,
        String errorMessage
) {}
