package com.eqms.dto.document;

import java.util.List;
import java.util.UUID;

public record RevisionWorkspaceBatchResponse(
        UUID workspaceId,
        String workspaceKey,
        UUID parentDocumentId,
        String workspaceMode,
        String workspaceState,
        String status,
        List<RevisionWorkspaceBatchItemResponse> items
) {}
