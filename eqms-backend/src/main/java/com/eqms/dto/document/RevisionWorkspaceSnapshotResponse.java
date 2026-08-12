package com.eqms.dto.document;

import java.time.Instant;
import java.util.UUID;

public record RevisionWorkspaceSnapshotResponse(
        UUID workspaceId,
        String workspaceKey,
        UUID sourceRevisionId,
        UUID parentDocumentId,
        UUID sourceDocumentId,
        String workspaceMode,
        String workspaceState,
        String status,
        String payloadJson,
        Instant createdAt,
        Instant updatedAt
) {}
