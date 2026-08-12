package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.document.DocumentDetailResponse;
import com.eqms.dto.document.DocumentRelationResponse;
import com.eqms.dto.document.DocumentRevisionSummaryResponse;
import com.eqms.dto.document.RevisionDetailResponse;
import com.eqms.dto.document.RevisionUpgradeContinueRequest;
import com.eqms.dto.document.RevisionUpgradeImpactItemResponse;
import com.eqms.dto.document.RevisionUpgradeSessionResponse;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.RevisionUpgradeSession;
import com.eqms.entity.UserAccount;
import com.eqms.repository.RevisionUpgradeSessionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@Service
public class RevisionUpgradeSessionService {

    private static final String WORKSPACE_MODE = "upgrade";
    private static final Set<String> IN_PROGRESS_STATUS_CODES = Set.of(
            "DRAFT",
            "PENDING_REVIEW",
            "PENDING_APPROVAL",
            "PENDING_TRAINING",
            "READY_FOR_PUBLISHING"
    );

    private final RevisionUpgradeSessionRepository sessionRepository;
    private final DocumentService documentService;
    private final RevisionService revisionService;
    private final CurrentUserService currentUserService;
    private final ObjectMapper objectMapper;

    public RevisionUpgradeSessionService(
            RevisionUpgradeSessionRepository sessionRepository,
            DocumentService documentService,
            RevisionService revisionService,
            CurrentUserService currentUserService,
            ObjectMapper objectMapper
    ) {
        this.sessionRepository = sessionRepository;
        this.documentService = documentService;
        this.revisionService = revisionService;
        this.currentUserService = currentUserService;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public RevisionUpgradeSessionResponse createSession(UUID documentId) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        revisionService.validateUpgradeableDocument(documentId);

        String sessionKey = buildSessionKey(documentId);
        RevisionUpgradeSession existing = sessionRepository.findBySessionKey(sessionKey).orElse(null);
        if (existing != null && StringUtils.hasText(existing.getPayloadJson())) {
            return readSession(existing);
        }

        DocumentDetailResponse sourceDocument = documentService.getDocumentDetail(documentId);
        RevisionDetailResponse currentEffectiveRevision = revisionService.getCurrentEffectiveRevision(documentId);
        List<RevisionUpgradeImpactItemResponse> relatedDocuments = buildImpactItems(
                sourceDocument.relatedDocuments(),
                true
        );
        List<RevisionUpgradeImpactItemResponse> correlatedDocuments = buildImpactItems(
                sourceDocument.correlatedDocuments(),
                false
        );

        RevisionUpgradeSession session = existing == null ? new RevisionUpgradeSession() : existing;
        Instant now = Instant.now();
        if (session.getId() == null) {
            session.setId(UUID.randomUUID());
            session.setCreatedAt(now);
            session.setCreatedBy(currentUser);
        }
        session.setSessionKey(sessionKey);
        session.setSourceDocument(requireDocument(documentId));
        session.setSourceRevision(revisionService.requireCurrentEffectiveRevisionForSnapshot(documentId));
        session.setWorkspaceMode(WORKSPACE_MODE);
        session.setStatus("DRAFT");

        RevisionUpgradeSessionResponse response = buildResponse(
                session.getId(),
                documentId,
                sourceDocument,
                currentEffectiveRevision,
                relatedDocuments,
                correlatedDocuments,
                List.of(),
                "DRAFT",
                null,
                now,
                now
        );

        session.setPayloadJson(writeSession(response));
        session.setUpdatedBy(currentUser);
        session.setUpdatedAt(now);
        sessionRepository.save(session);

        return response;
    }

    @Transactional(readOnly = true)
    public RevisionUpgradeSessionResponse getSession(UUID documentId, UUID sessionId) {
        RevisionUpgradeSession session = sessionRepository.findByIdAndSourceDocument_Id(sessionId, documentId)
                .orElseThrow(() -> new IllegalArgumentException("Upgrade session not found"));
        return readSession(session);
    }

    @Transactional
    public RevisionUpgradeSessionResponse continueSession(
            UUID documentId,
            UUID sessionId,
            RevisionUpgradeContinueRequest request
    ) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        RevisionUpgradeSession session = sessionRepository.findByIdAndSourceDocument_Id(sessionId, documentId)
                .orElseThrow(() -> new IllegalArgumentException("Upgrade session not found"));
        if (!Objects.equals("DRAFT", normalizeStatus(session.getStatus()))) {
            throw new IllegalStateException("Upgrade session has already been completed");
        }

        RevisionUpgradeSessionResponse sessionResponse = readSession(session);
        Set<UUID> eligibleRelatedIds = sessionResponse.relatedDocuments() == null
                ? Set.of()
                : sessionResponse.relatedDocuments().stream()
                .filter(RevisionUpgradeImpactItemResponse::eligible)
                .map(item -> tryParseUuid(item.id()))
                .filter(Objects::nonNull)
                .collect(java.util.stream.Collectors.toCollection(HashSet::new));

        List<UUID> selectedRelatedDocumentIds = request == null || request.relatedDocumentIds() == null
                ? List.of()
                : request.relatedDocumentIds().stream()
                .filter(Objects::nonNull)
                .distinct()
                .toList();

        for (UUID relatedDocumentId : selectedRelatedDocumentIds) {
            if (!eligibleRelatedIds.contains(relatedDocumentId)) {
                throw new IllegalArgumentException("Selected related document is not eligible for upgrade");
            }
        }

        List<RevisionDetailResponse> createdRevisions = new ArrayList<>();
        createdRevisions.add(revisionService.upgradeDocumentRevision(documentId, sessionId));
        for (UUID relatedDocumentId : selectedRelatedDocumentIds) {
            createdRevisions.add(revisionService.upgradeDocumentRevision(relatedDocumentId, sessionId));
        }

        List<RevisionUpgradeImpactItemResponse> updatedRelatedDocuments = updateRelatedActions(
                sessionResponse.relatedDocuments(),
                selectedRelatedDocumentIds
        );

        Instant now = Instant.now();
        RevisionUpgradeSessionResponse updatedResponse = buildResponse(
                session.getId(),
                documentId,
                sessionResponse.sourceDocument(),
                sessionResponse.currentEffectiveRevision(),
                updatedRelatedDocuments,
                sessionResponse.correlatedDocuments(),
                createdRevisions,
                "COMPLETED",
                request == null || !StringUtils.hasText(request.reasonForChange())
                        ? sessionResponse.reasonForChange()
                        : request.reasonForChange().trim(),
                session.getCreatedAt(),
                now
        );

        session.setStatus("COMPLETED");
        session.setPayloadJson(writeSession(updatedResponse));
        session.setUpdatedBy(currentUser);
        session.setUpdatedAt(now);
        sessionRepository.save(session);

        return updatedResponse;
    }

    private List<RevisionUpgradeImpactItemResponse> updateRelatedActions(
            List<RevisionUpgradeImpactItemResponse> relatedDocuments,
            List<UUID> selectedRelatedDocumentIds
    ) {
        if (relatedDocuments == null || relatedDocuments.isEmpty()) {
            return List.of();
        }

        Set<String> selectedIds = selectedRelatedDocumentIds == null
                ? Set.of()
                : selectedRelatedDocumentIds.stream()
                .filter(Objects::nonNull)
                .map(UUID::toString)
                .collect(java.util.stream.Collectors.toSet());

        List<RevisionUpgradeImpactItemResponse> updated = new ArrayList<>(relatedDocuments.size());
        for (RevisionUpgradeImpactItemResponse item : relatedDocuments) {
            if (item == null) {
                continue;
            }
            String action = selectedIds.contains(item.id()) ? "UPGRADE" : "KEEP";
            updated.add(new RevisionUpgradeImpactItemResponse(
                    item.id(),
                    item.documentNumber(),
                    item.documentName(),
                    item.displayLabel(),
                    item.version(),
                    item.status(),
                    item.statusInfo(),
                    item.type(),
                    item.businessUnit(),
                    item.department(),
                    item.author(),
                    item.openedBy(),
                    item.created(),
                    item.effectiveDate(),
                    item.validUntil(),
                    item.relationType(),
                    item.hasRelatedDocuments(),
                    item.hasCorrelatedDocuments(),
                    item.isTemplate(),
                    item.currentEffectiveRevisionId(),
                    item.currentEffectiveRevisionNumber(),
                    item.newDraftRevisionNumber(),
                    action,
                    item.eligible(),
                    item.disabledReason()
            ));
        }
        return updated;
    }

    private List<RevisionUpgradeImpactItemResponse> buildImpactItems(
            List<DocumentRelationResponse> relations,
            boolean selectable
    ) {
        if (relations == null || relations.isEmpty()) {
            return List.of();
        }

        List<RevisionUpgradeImpactItemResponse> results = new ArrayList<>();
        for (DocumentRelationResponse relation : relations) {
            if (relation == null || !StringUtils.hasText(relation.id())) {
                continue;
            }

            DocumentDetailResponse targetDetail = null;
            try {
                targetDetail = documentService.getDocumentDetailForSnapshot(UUID.fromString(relation.id()));
            } catch (Exception ex) {
                results.add(buildFallbackImpactItem(relation, selectable, "Cannot load related document."));
                continue;
            }

            results.add(buildImpactItem(relation, targetDetail, selectable));
        }
        return results;
    }

    private RevisionUpgradeImpactItemResponse buildFallbackImpactItem(
            DocumentRelationResponse relation,
            boolean selectable,
            String disabledReason
    ) {
        return new RevisionUpgradeImpactItemResponse(
                relation.id(),
                relation.documentNumber(),
                relation.documentName(),
                relation.displayLabel(),
                relation.version(),
                relation.status(),
                null,
                relation.type(),
                relation.businessUnit(),
                relation.department(),
                relation.author(),
                relation.openedBy(),
                relation.created(),
                relation.effectiveDate(),
                relation.validUntil(),
                relation.relationType(),
                false,
                false,
                false,
                null,
                null,
                null,
                selectable ? "KEEP" : "INFO",
                false,
                disabledReason
        );
    }

    private RevisionUpgradeImpactItemResponse buildImpactItem(
            DocumentRelationResponse relation,
            DocumentDetailResponse targetDocument,
            boolean selectable
    ) {
        DocumentRevisionSummaryResponse effectiveRevision = findEffectiveRevision(targetDocument);
        DocumentRevisionSummaryResponse latestRevision = findLatestRevision(targetDocument);

        String documentStatusCode = targetDocument == null || targetDocument.statusInfo() == null
                ? null
                : targetDocument.statusInfo().code();
        boolean activeDocument = "ACTIVE".equalsIgnoreCase(normalizeStatus(documentStatusCode));
        boolean hasEffectiveRevision = effectiveRevision != null;
        boolean inProgressRevision = latestRevision != null
                && IN_PROGRESS_STATUS_CODES.contains(normalizeStatus(latestRevision.statusCode()));
        boolean eligible = selectable && activeDocument && hasEffectiveRevision && !inProgressRevision;

        String disabledReason = null;
        if (selectable && !eligible) {
            if (!activeDocument) {
                disabledReason = "Cannot upgrade: document is not active.";
            } else if (inProgressRevision) {
                disabledReason = "Cannot upgrade: revision already in progress.";
            } else {
                disabledReason = "Cannot upgrade: no effective revision.";
            }
        }

        String currentEffectiveRevisionNumber = effectiveRevision == null ? null : effectiveRevision.revisionNumber();
        String newDraftRevisionNumber = eligible && StringUtils.hasText(currentEffectiveRevisionNumber)
                ? revisionService.resolveNextDraftRevisionNumberFromEffectiveValue(currentEffectiveRevisionNumber)
                : null;

        return new RevisionUpgradeImpactItemResponse(
                targetDocument == null ? relation.id() : targetDocument.id(),
                targetDocument == null ? relation.documentNumber() : targetDocument.documentNumber(),
                targetDocument == null ? relation.documentName() : targetDocument.documentName(),
                targetDocument == null
                        ? relation.displayLabel()
                        : formatDocumentLabel(targetDocument.documentNumber(), targetDocument.documentName()),
                currentEffectiveRevisionNumber,
                targetDocument == null ? relation.status() : targetDocument.status(),
                targetDocument == null ? null : targetDocument.statusInfo(),
                targetDocument == null ? relation.type() : targetDocument.type(),
                targetDocument == null ? relation.businessUnit() : targetDocument.businessUnit(),
                targetDocument == null ? relation.department() : targetDocument.department(),
                targetDocument == null ? relation.author() : targetDocument.author(),
                targetDocument == null ? relation.openedBy() : targetDocument.openedBy(),
                targetDocument == null ? relation.created() : targetDocument.created(),
                targetDocument == null ? relation.effectiveDate() : targetDocument.effectiveDate(),
                targetDocument == null ? relation.validUntil() : targetDocument.validUntil(),
                relation.relationType(),
                targetDocument != null && targetDocument.hasRelatedDocuments(),
                targetDocument != null && targetDocument.hasCorrelatedDocuments(),
                targetDocument != null && targetDocument.isTemplate(),
                effectiveRevision == null ? null : effectiveRevision.id(),
                currentEffectiveRevisionNumber,
                newDraftRevisionNumber,
                selectable ? "KEEP" : "INFO",
                eligible,
                disabledReason
        );
    }

    private DocumentRevisionSummaryResponse findEffectiveRevision(DocumentDetailResponse document) {
        if (document == null || document.revisions() == null) {
            return null;
        }
        return document.revisions().stream()
                .filter(revision -> "EFFECTIVE".equalsIgnoreCase(normalizeStatus(revision.statusCode())))
                .findFirst()
                .orElse(null);
    }

    private DocumentRevisionSummaryResponse findLatestRevision(DocumentDetailResponse document) {
        if (document == null || document.revisions() == null || document.revisions().isEmpty()) {
            return null;
        }
        return document.revisions().get(0);
    }

    private String formatDocumentLabel(String documentNumber, String documentName) {
        if (!StringUtils.hasText(documentNumber)) {
            return documentName;
        }
        if (!StringUtils.hasText(documentName)) {
            return documentNumber;
        }
        return documentNumber + " - " + documentName;
    }

    private RevisionUpgradeSessionResponse readSession(RevisionUpgradeSession session) {
        if (session == null || !StringUtils.hasText(session.getPayloadJson())) {
            throw new IllegalArgumentException("Upgrade session not found");
        }
        try {
            RevisionUpgradeSessionResponse payload = objectMapper.readValue(
                    session.getPayloadJson(),
                    RevisionUpgradeSessionResponse.class
            );
            return new RevisionUpgradeSessionResponse(
                    session.getId(),
                    payload.sourceDocumentId(),
                    payload.sourceRevisionId(),
                    payload.workspaceMode(),
                    session.getStatus(),
                    payload.reasonForChange(),
                    payload.sourceDocumentNumber(),
                    payload.sourceDocumentName(),
                    payload.currentEffectiveRevisionNumber(),
                    payload.newDraftRevisionNumber(),
                    payload.sourceDocument(),
                    payload.currentEffectiveRevision(),
                    payload.relatedDocuments(),
                    payload.correlatedDocuments(),
                    payload.createdRevisions(),
                    session.getCreatedAt(),
                    session.getUpdatedAt()
            );
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to load upgrade session", ex);
        }
    }

    private RevisionUpgradeSessionResponse buildResponse(
            UUID sessionId,
            UUID documentId,
            DocumentDetailResponse sourceDocument,
            RevisionDetailResponse currentEffectiveRevision,
            List<RevisionUpgradeImpactItemResponse> relatedDocuments,
            List<RevisionUpgradeImpactItemResponse> correlatedDocuments,
            List<RevisionDetailResponse> createdRevisions,
            String status,
            String reasonForChange,
            Instant createdAt,
            Instant updatedAt
    ) {
        String currentEffectiveRevisionNumber = currentEffectiveRevision == null ? null : currentEffectiveRevision.revisionNumber();
        String newDraftRevisionNumber = currentEffectiveRevisionNumber == null
                ? null
                : revisionService.resolveNextDraftRevisionNumberFromEffectiveValue(currentEffectiveRevisionNumber);
        return new RevisionUpgradeSessionResponse(
                sessionId,
                documentId,
                currentEffectiveRevision == null ? null : tryParseUuid(currentEffectiveRevision.id()),
                WORKSPACE_MODE,
                status,
                StringUtils.hasText(reasonForChange) ? reasonForChange.trim() : null,
                sourceDocument == null ? null : sourceDocument.documentNumber(),
                sourceDocument == null ? null : sourceDocument.documentName(),
                currentEffectiveRevisionNumber,
                newDraftRevisionNumber,
                sourceDocument,
                currentEffectiveRevision,
                relatedDocuments == null ? List.of() : relatedDocuments,
                correlatedDocuments == null ? List.of() : correlatedDocuments,
                createdRevisions == null ? List.of() : createdRevisions,
                createdAt,
                updatedAt
        );
    }

    private String writeSession(RevisionUpgradeSessionResponse response) {
        try {
            return objectMapper.writeValueAsString(response);
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to serialise upgrade session", ex);
        }
    }

    private DocumentRecord requireDocument(UUID documentId) {
        return revisionService.requireDocumentForSnapshot(documentId);
    }

    private UUID tryParseUuid(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        try {
            return UUID.fromString(value.trim());
        } catch (Exception ex) {
            return null;
        }
    }

    private String buildSessionKey(UUID documentId) {
        return documentId + ":" + WORKSPACE_MODE;
    }

    private String normalizeStatus(String value) {
        return StringUtils.hasText(value) ? value.trim().toUpperCase(Locale.ROOT) : null;
    }
}
