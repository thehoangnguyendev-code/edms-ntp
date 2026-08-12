package com.eqms.dto.document;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.UUID;

public record RevisionWorkspaceBatchRequest(
        UUID workspaceId,
        @NotNull UUID sourceRevisionId,
        UUID parentDocumentId,
        UUID sourceDocumentId,
        @NotBlank String workspaceMode,
        String workspaceState,
        String status,
        String payloadJson,
        String reasonForChange,
        Integer currentDocIndex,
        String activeTab,
        String reviewFlowType,
        @Valid List<RevisionWorkspaceItemRequest> items
) {}
