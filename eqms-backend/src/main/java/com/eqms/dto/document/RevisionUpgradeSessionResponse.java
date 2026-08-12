package com.eqms.dto.document;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record RevisionUpgradeSessionResponse(
        UUID sessionId,
        UUID sourceDocumentId,
        UUID sourceRevisionId,
        String workspaceMode,
        String status,
        String reasonForChange,
        String sourceDocumentNumber,
        String sourceDocumentName,
        String currentEffectiveRevisionNumber,
        String newDraftRevisionNumber,
        DocumentDetailResponse sourceDocument,
        RevisionDetailResponse currentEffectiveRevision,
        List<RevisionUpgradeImpactItemResponse> relatedDocuments,
        List<RevisionUpgradeImpactItemResponse> correlatedDocuments,
        List<RevisionDetailResponse> createdRevisions,
        Instant createdAt,
        Instant updatedAt
) {}
