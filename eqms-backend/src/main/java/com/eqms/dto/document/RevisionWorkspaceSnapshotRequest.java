package com.eqms.dto.document;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record RevisionWorkspaceSnapshotRequest(
        UUID workspaceId,
        @NotNull UUID sourceRevisionId,
        UUID parentDocumentId,
        UUID sourceDocumentId,
        @NotBlank String workspaceMode,
        String workspaceState,
        @NotBlank String payloadJson,
        String status
) {}
