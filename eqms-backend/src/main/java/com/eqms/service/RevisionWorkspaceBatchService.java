package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.document.DocumentDraftCreateRequest;
import com.eqms.dto.document.RevisionCreationRequest;
import com.eqms.dto.document.RevisionWorkspaceBatchItemResponse;
import com.eqms.dto.document.RevisionWorkspaceBatchRequest;
import com.eqms.dto.document.RevisionWorkspaceBatchResponse;
import com.eqms.dto.document.RevisionWorkspaceItemRequest;
import com.eqms.dto.document.RevisionWorkflowActionRequest;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.RevisionWorkspaceItem;
import com.eqms.entity.UserAccount;
import com.eqms.exception.RevisionWorkspaceBatchValidationException;
import com.eqms.exception.RevisionWorkspaceValidationIssue;
import com.eqms.repository.RevisionWorkspaceItemRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.HashSet;

@Service
public class RevisionWorkspaceBatchService {

    private final RevisionService revisionService;
    private final RevisionWorkspaceSnapshotService workspaceSnapshotService;
    private final RevisionWorkspaceItemRepository itemRepository;
    private final FileStorageService fileStorageService;
    private final CurrentUserService currentUserService;
    private final ObjectMapper objectMapper;

    public RevisionWorkspaceBatchService(
            RevisionService revisionService,
            RevisionWorkspaceSnapshotService workspaceSnapshotService,
            RevisionWorkspaceItemRepository itemRepository,
            FileStorageService fileStorageService,
            CurrentUserService currentUserService,
            ObjectMapper objectMapper
    ) {
        this.revisionService = revisionService;
        this.workspaceSnapshotService = workspaceSnapshotService;
        this.itemRepository = itemRepository;
        this.fileStorageService = fileStorageService;
        this.currentUserService = currentUserService;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public RevisionWorkspaceBatchResponse saveWorkspaceBatch(RevisionWorkspaceBatchRequest request, List<MultipartFile> files) {
        return processWorkspaceBatch(request, files, false);
    }

    @Transactional
    public RevisionWorkspaceBatchResponse submitWorkspaceBatch(RevisionWorkspaceBatchRequest request, List<MultipartFile> files) {
        return processWorkspaceBatch(request, files, true);
    }

    private RevisionWorkspaceBatchResponse processWorkspaceBatch(
            RevisionWorkspaceBatchRequest request,
            List<MultipartFile> files,
            boolean submit
    ) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        String workspaceMode = normalizeMode(request.workspaceMode());
        String workspaceKey = buildWorkspaceKey(request.sourceRevisionId(), workspaceMode);
        UUID parentDocumentId = request.parentDocumentId() != null ? request.parentDocumentId() : request.sourceDocumentId();
        String workspaceStateJson = resolveWorkspaceStateJson(request);

        List<RevisionWorkspaceValidationIssue> validationIssues = validateWorkspaceBatch(request, files, submit);
        if (!validationIssues.isEmpty()) {
            throw new RevisionWorkspaceBatchValidationException(validationIssues);
        }

        workspaceSnapshotService.saveSnapshot(new com.eqms.dto.document.RevisionWorkspaceSnapshotRequest(
                request.workspaceId(),
                request.sourceRevisionId(),
                parentDocumentId,
                request.sourceDocumentId(),
                workspaceMode,
                workspaceStateJson,
                workspaceStateJson,
                submit ? "SUBMITTED" : "SAVED"
        ));

        itemRepository.deleteAllByWorkspaceKey(workspaceKey);

        List<RevisionWorkspaceBatchItemResponse> responses = new ArrayList<>();
        Set<UUID> touchedRevisions = new HashSet<>();
        Set<UUID> newlyCreatedRevisions = new HashSet<>();
        List<String> cleanupPaths = new ArrayList<>();

        try {
            List<RevisionWorkspaceItemRequest> items = request.items() == null ? List.of() : request.items();
            for (int index = 0; index < items.size(); index++) {
                RevisionWorkspaceItemRequest item = items.get(index);
                MultipartFile file = files != null && index < files.size() ? files.get(index) : null;
                RevisionWorkspaceBatchItemResponse response = processItem(
                        workspaceKey,
                        workspaceMode,
                        item,
                        file,
                        request.reasonForChange(),
                        submit,
                        currentUser,
                        touchedRevisions,
                        newlyCreatedRevisions,
                        cleanupPaths
                );
                responses.add(response);
            }
        } catch (RuntimeException | IOException ex) {
            cleanupArtifacts(cleanupPaths, newlyCreatedRevisions);
            throw ex instanceof RuntimeException ? (RuntimeException) ex : new IllegalStateException(ex.getMessage(), ex);
        }

        return new RevisionWorkspaceBatchResponse(
                request.workspaceId(),
                workspaceKey,
                parentDocumentId,
                workspaceMode,
                workspaceStateJson,
                submit ? "SUBMITTED" : "SAVED",
                responses
        );
    }

    private List<RevisionWorkspaceValidationIssue> validateWorkspaceBatch(
            RevisionWorkspaceBatchRequest request,
            List<MultipartFile> files,
            boolean submit
    ) {
        List<RevisionWorkspaceValidationIssue> issues = new ArrayList<>();
        if (request == null) {
            issues.add(new RevisionWorkspaceValidationIssue(null, null, null, null, null, "request", "Workspace batch request is missing"));
            return issues;
        }

        List<RevisionWorkspaceItemRequest> items = request.items() == null ? List.of() : request.items();
        if (items.isEmpty()) {
            issues.add(new RevisionWorkspaceValidationIssue(null, null, null, null, null, "items", "Workspace batch must contain at least one item"));
            return issues;
        }

        for (int index = 0; index < items.size(); index++) {
            RevisionWorkspaceItemRequest item = items.get(index);
            String itemFieldPrefix = "items[" + index + "]";
            if (item == null) {
                issues.add(new RevisionWorkspaceValidationIssue(index, null, null, null, null, itemFieldPrefix, "Workspace item payload is missing"));
                continue;
            }

            UUID documentId = item.documentId();
            UUID parentDocumentId = item.parentDocumentId();
            UUID sourceDocumentId = item.sourceDocumentId();
            UUID sourceRevisionId = item.sourceRevisionId();
            UUID targetRevisionId = item.targetRevisionId();

            if (targetRevisionId == null && sourceRevisionId == null && sourceDocumentId == null && parentDocumentId == null) {
                issues.add(new RevisionWorkspaceValidationIssue(index, documentId, parentDocumentId, sourceDocumentId, sourceRevisionId, itemFieldPrefix, "Workspace item must contain either targetRevisionId, sourceRevisionId, sourceDocumentId, or parentDocumentId"));
                continue;
            }

            String itemLabel = buildItemLabel(index, documentId, parentDocumentId, sourceDocumentId, sourceRevisionId);

            if (targetRevisionId != null) {
                try {
                    DocumentRevisionRecord target = revisionService.requireRevisionForSnapshot(targetRevisionId);
                    String currentStatus = target.getStatus() == null ? null : target.getStatus().getCode();
                    if (currentStatus == null || !"DRAFT".equalsIgnoreCase(currentStatus)) {
                        issues.add(new RevisionWorkspaceValidationIssue(index, documentId, parentDocumentId, sourceDocumentId, sourceRevisionId, itemFieldPrefix + ".targetRevisionId", itemLabel + ": Revision must be in DRAFT state before it can be updated"));
                    }
                } catch (RuntimeException ex) {
                    issues.add(new RevisionWorkspaceValidationIssue(index, documentId, parentDocumentId, sourceDocumentId, sourceRevisionId, itemFieldPrefix + ".targetRevisionId", itemLabel + ": " + safeMessage(ex)));
                }
            } else if (sourceRevisionId != null) {
                try {
                    revisionService.validateUpgradeableRevision(sourceRevisionId);
                } catch (RuntimeException ex) {
                    issues.add(new RevisionWorkspaceValidationIssue(index, documentId, parentDocumentId, sourceDocumentId, sourceRevisionId, itemFieldPrefix + ".sourceRevisionId", itemLabel + ": " + safeMessage(ex)));
                }
            } else if (sourceDocumentId != null) {
                try {
                    revisionService.requireDocumentForSnapshot(sourceDocumentId);
                } catch (RuntimeException ex) {
                    issues.add(new RevisionWorkspaceValidationIssue(index, documentId, parentDocumentId, sourceDocumentId, sourceRevisionId, itemFieldPrefix + ".sourceDocumentId", itemLabel + ": " + safeMessage(ex)));
                }
            }

            if (submit) {
                if (files == null || index >= files.size() || files.get(index) == null || files.get(index).isEmpty()) {
                    issues.add(new RevisionWorkspaceValidationIssue(index, documentId, parentDocumentId, sourceDocumentId, sourceRevisionId, itemFieldPrefix + ".file", itemLabel + ": Revision file is required before submitting for review"));
                }
            }

            DocumentDraftCreateRequest draft = item.draft();
            if (submit && draft == null) {
                issues.add(new RevisionWorkspaceValidationIssue(index, documentId, parentDocumentId, sourceDocumentId, sourceRevisionId, itemFieldPrefix + ".draft", itemLabel + ": Draft payload is required before submitting for review"));
                continue;
            }
            if (draft != null) {
                validateDraftPayload(draft, index, documentId, sourceDocumentId, sourceRevisionId, itemLabel, submit, issues);
            }
        }

        return issues;
    }

    private void validateDraftPayload(
            DocumentDraftCreateRequest draft,
            int index,
            UUID documentId,
            UUID sourceDocumentId,
            UUID sourceRevisionId,
            String itemLabel,
            boolean submit,
            List<RevisionWorkspaceValidationIssue> issues
    ) {
        String itemFieldPrefix = "items[" + index + "].draft";
        if (submit) {
            addIfBlank(issues, index, documentId, sourceDocumentId, sourceRevisionId, itemFieldPrefix + ".documentName", itemLabel + ": Revision Name is required", draft.documentName());
            addIfBlank(issues, index, documentId, sourceDocumentId, sourceRevisionId, itemFieldPrefix + ".type", itemLabel + ": Document Type is required", draft.documentType());
            addIfBlank(issues, index, documentId, sourceDocumentId, sourceRevisionId, itemFieldPrefix + ".author", itemLabel + ": Author is required", draft.author());
            addIfBlank(issues, index, documentId, sourceDocumentId, sourceRevisionId, itemFieldPrefix + ".businessUnit", itemLabel + ": Business Unit is required", draft.businessUnit());
            addIfBlank(issues, index, documentId, sourceDocumentId, sourceRevisionId, itemFieldPrefix + ".description", itemLabel + ": Note is required", draft.description());
            if (!isPositiveNumber(draft.periodicReviewCycle())) {
                addIssue(issues, index, documentId, sourceDocumentId, sourceRevisionId, itemFieldPrefix + ".periodicReviewCycle", itemLabel + ": Periodic Review Cycle (Months) is required");
            }
            if (!isPositiveNumber(draft.periodicReviewNotification())) {
                addIssue(issues, index, documentId, sourceDocumentId, sourceRevisionId, itemFieldPrefix + ".periodicReviewNotification", itemLabel + ": Periodic Review Notification (Days) is required");
            }
        }
    }

    private void addIfBlank(
            List<RevisionWorkspaceValidationIssue> issues,
            int index,
            UUID documentId,
            UUID sourceDocumentId,
            UUID sourceRevisionId,
            String field,
            String message,
            String value
    ) {
        if (!StringUtils.hasText(value)) {
            addIssue(issues, index, documentId, sourceDocumentId, sourceRevisionId, field, message);
        }
    }

    private void addIssue(
            List<RevisionWorkspaceValidationIssue> issues,
            int index,
            UUID documentId,
            UUID sourceDocumentId,
            UUID sourceRevisionId,
            String field,
            String message
    ) {
        issues.add(new RevisionWorkspaceValidationIssue(index, documentId, null, sourceDocumentId, sourceRevisionId, field, message));
    }

    private boolean isPositiveNumber(Integer value) {
        return value != null && value > 0;
    }

    private String buildItemLabel(int index, UUID documentId, UUID sourceDocumentId, UUID sourceRevisionId) {
        StringBuilder builder = new StringBuilder("Item ").append(index + 1);
        UUID resolvedId = documentId != null ? documentId : (sourceDocumentId != null ? sourceDocumentId : sourceRevisionId);
        if (resolvedId != null) {
            builder.append(" (").append(resolvedId).append(")");
        }
        return builder.toString();
    }

    private String buildItemLabel(int index, UUID documentId, UUID parentDocumentId, UUID sourceDocumentId, UUID sourceRevisionId) {
        StringBuilder builder = new StringBuilder("Item ").append(index + 1);
        UUID resolvedId = documentId != null
                ? documentId
                : (parentDocumentId != null ? parentDocumentId : (sourceDocumentId != null ? sourceDocumentId : sourceRevisionId));
        if (resolvedId != null) {
            builder.append(" (").append(resolvedId).append(")");
        }
        return builder.toString();
    }

    private String safeMessage(RuntimeException ex) {
        if (ex == null || !StringUtils.hasText(ex.getMessage())) {
            return "Invalid workspace item";
        }
        return ex.getMessage();
    }

    private RevisionWorkspaceBatchItemResponse processItem(
            String workspaceKey,
            String workspaceMode,
            RevisionWorkspaceItemRequest item,
            MultipartFile file,
            String batchReason,
            boolean submit,
            UserAccount currentUser,
            Set<UUID> touchedRevisions,
            Set<UUID> newlyCreatedRevisions,
            List<String> cleanupPaths
    ) throws IOException {
        if (item == null) {
            throw new IllegalArgumentException("Workspace item payload is missing");
        }

        DocumentRevisionRecord targetRevision;
        boolean createdNewRevision = false;
        if (item.targetRevisionId() != null) {
            targetRevision = revisionService.requireRevisionForSnapshot(item.targetRevisionId());
            if (targetRevision.getStatus() == null || !"DRAFT".equalsIgnoreCase(targetRevision.getStatus().getCode())) {
                throw new IllegalStateException("Revision must be in DRAFT state before it can be updated");
            }
        } else if (item.sourceRevisionId() != null) {
            var upgraded = revisionService.upgradeRevision(item.sourceRevisionId());
            targetRevision = revisionService.requireRevisionForSnapshot(UUID.fromString(upgraded.id()));
            createdNewRevision = true;
        } else if (item.sourceDocumentId() != null) {
            var created = revisionService.createRevisionFromDocument(
                    item.sourceDocumentId(),
                    new RevisionCreationRequest(StringUtils.hasText(batchReason) ? batchReason : null, "Major", null)
            );
            targetRevision = revisionService.requireRevisionForSnapshot(UUID.fromString(created.id()));
            createdNewRevision = true;
        } else {
            throw new IllegalArgumentException("Workspace item must contain either targetRevisionId, sourceRevisionId, or sourceDocumentId");
        }

        if (targetRevision == null) {
            throw new IllegalStateException("Unable to resolve target revision for workspace item");
        }

        touchedRevisions.add(targetRevision.getId());
        if (createdNewRevision) {
            newlyCreatedRevisions.add(targetRevision.getId());
        }

        DocumentDraftCreateRequest draft = item.draft();
        if (draft != null) {
            revisionService.updateRevision(targetRevision.getId(), draft);
        }

        if (file != null && !file.isEmpty()) {
            revisionService.uploadRevisionFile(targetRevision.getId(), file);
        }

        RevisionService.RevisionStoragePaths storageInfo = revisionService.getRevisionStoragePaths(targetRevision.getId());
        if (file != null && !file.isEmpty() && !StringUtils.hasText(storageInfo.filePath())) {
            throw new IllegalStateException("Revision file was not stored successfully");
        }

        if (StringUtils.hasText(storageInfo.filePath())) {
            cleanupPaths.add(storageInfo.filePath());
        }
        if (StringUtils.hasText(storageInfo.previewFilePath())) {
            cleanupPaths.add(storageInfo.previewFilePath());
        }

        if (submit) {
            revisionService.submitForReview(targetRevision.getId(), new RevisionWorkflowActionRequest(batchReason, batchReason, null));
        }

        persistWorkspaceItem(workspaceKey, workspaceMode, item, targetRevision, currentUser, resolveWorkspaceDocumentId(item, targetRevision), submit);

        UUID parentDocumentId = resolveParentDocumentId(item, targetRevision);

        return new RevisionWorkspaceBatchItemResponse(
                null,
                item.itemOrder(),
                item.documentId(),
                parentDocumentId,
                item.sourceDocumentId(),
                item.sourceRevisionId(),
                targetRevision.getId(),
                item.decision(),
                targetRevision.getDocumentNumber(),
                targetRevision.getDocumentName(),
                targetRevision.getRevisionNumber(),
                targetRevision.getRevisionNumber(),
                submit ? "SUBMITTED" : "SAVED",
                targetRevision.getStatus() == null ? null : targetRevision.getStatus().getCode(),
                targetRevision.getFileName(),
                targetRevision.getFilePath(),
                targetRevision.getPreviewFilePath(),
                null,
                null
        );
    }

    private void persistWorkspaceItem(
            String workspaceKey,
            String workspaceMode,
            RevisionWorkspaceItemRequest item,
            DocumentRevisionRecord revision,
            UserAccount currentUser,
            UUID workspaceDocumentId,
            boolean submit
    ) {
        UUID documentId = workspaceDocumentId != null ? workspaceDocumentId : (revision.getDocument() == null ? null : revision.getDocument().getId());
        RevisionWorkspaceItem entity = documentId == null
                ? new RevisionWorkspaceItem()
                : itemRepository.findByWorkspaceKeyAndDocument_Id(workspaceKey, documentId)
                .orElseGet(RevisionWorkspaceItem::new);
        entity.setId(entity.getId() == null ? UUID.randomUUID() : entity.getId());
        entity.setWorkspaceKey(workspaceKey);
        entity.setWorkspaceMode(workspaceMode);
        entity.setItemOrder(item.itemOrder() == null ? 0 : item.itemOrder());
        entity.setDocument(revision.getDocument());
        entity.setSourceDocument(revision.getDocument());
        entity.setSourceRevision(revision.getParentRevision());
        entity.setTargetRevision(revision);
        entity.setDecision(item.decision());
        entity.setItemStatus(submit ? "SUBMITTED" : "SAVED");
        entity.setRevisionStatus(revision.getStatus() == null ? null : revision.getStatus().getCode());
        entity.setDocumentNumber(revision.getDocumentNumber());
        entity.setDocumentName(revision.getDocumentName());
        entity.setRevisionNumber(revision.getRevisionNumber());
        entity.setNextRevisionNumber(revision.getRevisionNumber());
        entity.setPayloadJson(serializeSafely(item));
        entity.setFileName(revision.getFileName());
        entity.setFilePath(revision.getFilePath());
        entity.setPreviewFilePath(revision.getPreviewFilePath());
        entity.setErrorMessage(null);
        entity.setCreatedBy(currentUser);
        entity.setUpdatedBy(currentUser);
        itemRepository.save(entity);
    }

    private UUID resolveWorkspaceDocumentId(RevisionWorkspaceItemRequest item, DocumentRevisionRecord revision) {
        if (item == null) {
            return revision == null || revision.getDocument() == null ? null : revision.getDocument().getId();
        }
        if (item.documentId() != null) {
            return item.documentId();
        }
        if (item.parentDocumentId() != null) {
            return item.parentDocumentId();
        }
        if (item.sourceDocumentId() != null) {
            return item.sourceDocumentId();
        }
        return revision == null || revision.getDocument() == null ? null : revision.getDocument().getId();
    }

    private UUID resolveParentDocumentId(RevisionWorkspaceItemRequest item, DocumentRevisionRecord revision) {
        if (item != null) {
            if (item.parentDocumentId() != null) {
                return item.parentDocumentId();
            }
            if (item.documentId() != null) {
                return item.documentId();
            }
            if (item.sourceDocumentId() != null) {
                return item.sourceDocumentId();
            }
        }
        return revision == null || revision.getDocument() == null ? null : revision.getDocument().getId();
    }

    private void cleanupArtifacts(List<String> cleanupPaths, Set<UUID> newlyCreatedRevisions) {
        for (String path : cleanupPaths) {
            try {
                fileStorageService.deleteStoredFile(path);
            } catch (Exception ignored) {
                // best effort cleanup
            }
        }
        for (UUID revisionId : newlyCreatedRevisions) {
            try {
                fileStorageService.deleteRevisionStorageDirectory(revisionId);
            } catch (Exception ignored) {
                // best effort cleanup
            }
        }
    }

    private String buildWorkspaceKey(UUID sourceRevisionId, String workspaceMode) {
        return sourceRevisionId + ":" + normalizeMode(workspaceMode);
    }

    private String normalizeMode(String workspaceMode) {
        if (!StringUtils.hasText(workspaceMode)) {
            return "multi";
        }
        String normalized = workspaceMode.trim().toLowerCase(Locale.ROOT);
        return "standalone".equals(normalized) ? "standalone" : "multi";
    }

    private String serializeSafely(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception ex) {
            return "{}";
        }
    }

    private String resolveWorkspaceStateJson(RevisionWorkspaceBatchRequest request) {
        if (request == null) {
            return "{}";
        }
        if (StringUtils.hasText(request.workspaceState())) {
            return request.workspaceState();
        }
        if (StringUtils.hasText(request.payloadJson())) {
            return request.payloadJson();
        }
        return serializeSafely(request);
    }

}
