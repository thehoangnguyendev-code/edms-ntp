package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.security.FileAccessContext;
import com.eqms.dto.security.FileAccessDecision;
import com.eqms.dto.security.RevisionActionCapabilitiesResponse;
import com.eqms.dto.security.RevisionActionCapabilityDecisionResponse;
import com.eqms.dto.security.RevisionWorkflowAuthorizationContext;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.UserAccount;
import com.eqms.enums.FileAccessAction;
import com.eqms.enums.FileObjectType;
import com.eqms.enums.RevisionWorkflowAction;
import com.eqms.repository.DocumentRevisionRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class RevisionActionCapabilityService {

    private final CurrentUserService currentUserService;
    private final DocumentRevisionRepository documentRevisionRepository;
    private final DocumentAuthorizationService documentAuthorizationService;
    private final RevisionWorkflowAuthorizationService revisionWorkflowAuthorizationService;
    private final SecureFileAccessService secureFileAccessService;
    private final RevisionService revisionService;
    private final WorkflowActionPolicyService workflowActionPolicyService;

    public RevisionActionCapabilityService(
            CurrentUserService currentUserService,
            DocumentRevisionRepository documentRevisionRepository,
            DocumentAuthorizationService documentAuthorizationService,
            RevisionWorkflowAuthorizationService revisionWorkflowAuthorizationService,
            SecureFileAccessService secureFileAccessService,
            RevisionService revisionService,
            WorkflowActionPolicyService workflowActionPolicyService
    ) {
        this.currentUserService = currentUserService;
        this.documentRevisionRepository = documentRevisionRepository;
        this.documentAuthorizationService = documentAuthorizationService;
        this.revisionWorkflowAuthorizationService = revisionWorkflowAuthorizationService;
        this.secureFileAccessService = secureFileAccessService;
        this.revisionService = revisionService;
        this.workflowActionPolicyService = workflowActionPolicyService;
    }

    @Transactional(readOnly = true)
    public RevisionActionCapabilitiesResponse getCapabilities(UUID revisionId) {
        UserAccount user = currentUserService.requireCurrentUser();
        DocumentRevisionRecord revision = documentRevisionRepository.findById(revisionId)
                .orElseThrow(() -> new EntityNotFoundException("Revision not found"));

        documentAuthorizationService.requireCanViewRevision(user, revision);

        String currentStatus = revision.getStatus() == null ? null : revision.getStatus().getCode();
        Map<String, RevisionActionCapabilityDecisionResponse> actions = new LinkedHashMap<>();

        actions.put("preview", evaluatePreview(user, revision));
        actions.put("downloadSource", evaluateFileAction(user, revision, FileAccessAction.DOWNLOAD, FileObjectType.SOURCE_DOCX));
        actions.put("editOnline", evaluateEditOnline(user, revision));
        actions.put("uploadSource", evaluateSourceUpload(user, revision, FileAccessAction.UPLOAD));
        actions.put("replaceSource", evaluateSourceUpload(user, revision, FileAccessAction.REPLACE));
        actions.put("syncToOffice", evaluateOfficeAction(user, revision, FileAccessAction.SYNC_TO_OFFICE));
        actions.put("syncFromOffice", evaluateOfficeAction(user, revision, FileAccessAction.SYNC_FROM_OFFICE));

        actions.put("completeAuthoring", evaluateWorkflowAction(user, revision, RevisionWorkflowAction.COMPLETE_AUTHORING));
        actions.put("updateDraftMetadata", evaluateWorkflowAction(user, revision, RevisionWorkflowAction.UPDATE_DRAFT_METADATA));
        actions.put("openPublishingWorkspace", evaluateWorkflowAction(user, revision, RevisionWorkflowAction.OPEN_PUBLISHING_WORKSPACE));
        actions.put("generateReviewSnapshot", evaluateWorkflowAction(user, revision, RevisionWorkflowAction.GENERATE_REVIEW_SNAPSHOT));
        actions.put("regenerateSnapshot", evaluateWorkflowAction(user, revision, RevisionWorkflowAction.REGENERATE_SNAPSHOT));
        actions.put("submitForReview", evaluateWorkflowAction(user, revision, RevisionWorkflowAction.SUBMIT_FOR_REVIEW));
        actions.put("completeReview", evaluateWorkflowAction(user, revision, RevisionWorkflowAction.COMPLETE_REVIEW));
        actions.put("rejectReview", evaluateWorkflowAction(user, revision, RevisionWorkflowAction.REJECT_REVIEW));
        actions.put("completeApproval", evaluateWorkflowAction(user, revision, RevisionWorkflowAction.COMPLETE_APPROVAL));
        actions.put("rejectApproval", evaluateWorkflowAction(user, revision, RevisionWorkflowAction.REJECT_APPROVAL));
        actions.put("completeTraining", evaluateWorkflowAction(user, revision, RevisionWorkflowAction.COMPLETE_TRAINING));
        actions.put("publish", evaluateWorkflowAction(user, revision, RevisionWorkflowAction.PUBLISH));
        actions.put("cancel", evaluateWorkflowAction(user, revision, RevisionWorkflowAction.CANCEL));
        actions.put("upgradeRevision", evaluateWorkflowAction(user, revision, RevisionWorkflowAction.UPGRADE_REVISION));

        // No dedicated RevisionWorkflowAction/workflow_action_policy exists for these three —
        // exposed here as thin wrappers around the same checks the mutations already enforce
        // (documentAuthorizationService.canEditDraftRevision for workspace save/batch,
        // RevisionService.canCurrentUserWriteWorkingNotes for working notes), so UI and mutation
        // read from one source instead of the UI going without a capability signal at all.
        actions.put("saveWorkspace", evaluateWorkspaceSave(user, revision));
        actions.put("batchSaveSubmit", evaluateWorkspaceSave(user, revision));
        actions.put("addWorkingNote", evaluateWorkingNoteWrite(user, revision));
        actions.put("deleteWorkingNote", evaluateWorkingNoteWrite(user, revision));

        return new RevisionActionCapabilitiesResponse(
                revision.getId(),
                revision.getDocument() == null ? null : revision.getDocument().getId(),
                currentStatus,
                resolvePreviewObjectType(revision),
                currentStatus == null ? null : currentStatus,
                revision.getUpdatedAt() == null ? null : revision.getUpdatedAt().toString(),
                Instant.now().toString(),
                actions
        );
    }

    private RevisionActionCapabilityDecisionResponse evaluateWorkflowAction(
            UserAccount user,
            DocumentRevisionRecord revision,
            RevisionWorkflowAction action
    ) {
        var decision = revisionWorkflowAuthorizationService.check(
                user,
                revision,
                action,
                RevisionWorkflowAuthorizationContext.of(revision)
        );
        return toDecision(decision, resolveRequiredPermissionCode(action, revision));
    }

    private RevisionActionCapabilityDecisionResponse evaluateFileAction(
            UserAccount user,
            DocumentRevisionRecord revision,
            FileAccessAction action,
            FileObjectType objectType
    ) {
        FileAccessContext context = FileAccessContext.ofRevision(revision);
        FileAccessDecision decision = secureFileAccessService.check(
                user,
                action,
                objectType,
                revision.getId(),
                context
        );
        return toDecision(decision, resolveRequiredPermissionCode(action, objectType));
    }

    private RevisionActionCapabilityDecisionResponse evaluateWorkspaceSave(
            UserAccount user,
            DocumentRevisionRecord revision
    ) {
        if (!documentAuthorizationService.canEditDraftRevision(user, revision)) {
            return RevisionActionCapabilityDecisionResponse.deny(
                    "NOT_REVISION_AUTHOR",
                    "Only the assigned Author or Co-Author can save this revision workspace.",
                    null
            );
        }
        return RevisionActionCapabilityDecisionResponse.allow(null);
    }

    private RevisionActionCapabilityDecisionResponse evaluateWorkingNoteWrite(
            UserAccount user,
            DocumentRevisionRecord revision
    ) {
        if (!revisionService.canCurrentUserWriteWorkingNotes(revision, user)) {
            return RevisionActionCapabilityDecisionResponse.deny(
                    "NOT_PENDING_PARTICIPANT",
                    "Working notes can only be written by the currently pending Reviewer or Approver.",
                    null
            );
        }
        return RevisionActionCapabilityDecisionResponse.allow(null);
    }

    private RevisionActionCapabilityDecisionResponse evaluateSourceUpload(
            UserAccount user,
            DocumentRevisionRecord revision,
            FileAccessAction action
    ) {
        String permissionCode = resolveRequiredPermissionCode(action, FileObjectType.SOURCE_DOCX);
        if (!documentAuthorizationService.canUploadRevisionSource(user, revision)) {
            return RevisionActionCapabilityDecisionResponse.deny(
                    "NOT_REVISION_AUTHOR",
                    "Only the assigned Author can upload or replace the revision source file.",
                    permissionCode
            );
        }
        return evaluateFileAction(user, revision, action, FileObjectType.SOURCE_DOCX);
    }

    private RevisionActionCapabilityDecisionResponse evaluateOfficeAction(
            UserAccount user,
            DocumentRevisionRecord revision,
            FileAccessAction action
    ) {
        if (!isOfficeEditableFormat(revision.getFileName())) {
            return RevisionActionCapabilityDecisionResponse.deny(
                    "UNSUPPORTED_FILE_FORMAT",
                    "Only DOC/DOCX files can be edited via Office Online.",
                    resolveRequiredPermissionCode(action, FileObjectType.SOURCE_DOCX)
            );
        }

        // SYNC_TO_OFFICE is the action that creates the Office Online workspace in the first
        // place, so it must not require one to already exist — but once it exists, offering
        // "upload" again makes no sense (Edit Online / Sync From Office take over from there).
        // SYNC_FROM_OFFICE requires an existing workspace to pull from.
        boolean hasWorkspace = hasOfficeWorkspace(revision);
        if (action == FileAccessAction.SYNC_TO_OFFICE && hasWorkspace) {
            return RevisionActionCapabilityDecisionResponse.deny(
                    "ALREADY_SYNCED",
                    "The revision file has already been uploaded to Office Online.",
                    resolveRequiredPermissionCode(action, FileObjectType.SOURCE_DOCX)
            );
        }
        if (action != FileAccessAction.SYNC_TO_OFFICE && !hasWorkspace) {
            return RevisionActionCapabilityDecisionResponse.deny(
                    "FILE_NOT_FOUND",
                    "Revision file has not been uploaded to Office Online.",
                    resolveRequiredPermissionCode(action, FileObjectType.SOURCE_DOCX)
            );
        }
        return toDecision(secureFileAccessService.check(
                user,
                action,
                FileObjectType.SOURCE_DOCX,
                revision.getId(),
                FileAccessContext.ofRevision(revision)
        ), resolveRequiredPermissionCode(action, FileObjectType.SOURCE_DOCX));
    }

    private RevisionActionCapabilityDecisionResponse evaluateEditOnline(
            UserAccount user,
            DocumentRevisionRecord revision
    ) {
        if (!isOfficeEditableFormat(revision.getFileName())) {
            return RevisionActionCapabilityDecisionResponse.deny(
                    "UNSUPPORTED_FILE_FORMAT",
                    "Only DOC/DOCX files can be edited via Office Online.",
                    resolveRequiredPermissionCode(FileAccessAction.EDIT_ONLINE, FileObjectType.SOURCE_DOCX)
            );
        }
        if (!hasOfficeWorkspace(revision)) {
            return RevisionActionCapabilityDecisionResponse.deny(
                    "FILE_NOT_FOUND",
                    "Revision file has not been uploaded to Office Online.",
                    resolveRequiredPermissionCode(FileAccessAction.EDIT_ONLINE, FileObjectType.SOURCE_DOCX)
            );
        }
        return toDecision(secureFileAccessService.check(
                user,
                FileAccessAction.EDIT_ONLINE,
                FileObjectType.SOURCE_DOCX,
                revision.getId(),
                FileAccessContext.ofRevision(revision)
        ), resolveRequiredPermissionCode(FileAccessAction.EDIT_ONLINE, FileObjectType.SOURCE_DOCX));
    }

    private RevisionActionCapabilityDecisionResponse evaluatePreview(
            UserAccount user,
            DocumentRevisionRecord revision
    ) {
        FileObjectType objectType = resolvePreviewObjectTypeAsEnum(revision);
        if (objectType == null) {
            return RevisionActionCapabilityDecisionResponse.deny(
                    "INVALID_WORKFLOW_STATE",
                    "Preview is not available for the current revision state.",
                    resolveRequiredPermissionCode(FileAccessAction.VIEW_PREVIEW, FileObjectType.REVIEW_SNAPSHOT)
            );
        }

        if (!hasPreviewSource(revision, objectType)) {
            return RevisionActionCapabilityDecisionResponse.deny(
                    "FILE_NOT_FOUND",
                    "The preview file is not available yet.",
                    resolveRequiredPermissionCode(FileAccessAction.VIEW_PREVIEW, objectType)
            );
        }

        FileAccessDecision decision = secureFileAccessService.check(
                user,
                FileAccessAction.VIEW_PREVIEW,
                objectType,
                revision.getId(),
                FileAccessContext.ofRevision(revision)
        );
        return toDecision(decision, resolveRequiredPermissionCode(FileAccessAction.VIEW_PREVIEW, objectType));
    }

    private RevisionActionCapabilityDecisionResponse toDecision(
            FileAccessDecision decision,
            String requiredPermissionCode
    ) {
        if (decision == null || decision.allowed()) {
            return RevisionActionCapabilityDecisionResponse.allow(requiredPermissionCode);
        }
        return RevisionActionCapabilityDecisionResponse.deny(
                decision.reasonCode(),
                decision.message(),
                StringUtils.hasText(decision.permissionCode()) ? decision.permissionCode() : requiredPermissionCode
        );
    }

    private RevisionActionCapabilityDecisionResponse toDecision(
            com.eqms.dto.security.WorkflowAuthorizationDecision decision,
            String requiredPermissionCode
    ) {
        if (decision == null || decision.allowed()) {
            return RevisionActionCapabilityDecisionResponse.allow(requiredPermissionCode);
        }
        return RevisionActionCapabilityDecisionResponse.deny(
                decision.reasonCode(),
                decision.message(),
                StringUtils.hasText(decision.permissionCode()) ? decision.permissionCode() : requiredPermissionCode
        );
    }

    private String resolvePreviewObjectType(DocumentRevisionRecord revision) {
        String status = normalizeStatus(revision);
        if (status == null) {
            return null;
        }
        if (isDraft(status)) {
            return FileObjectType.SOURCE_DOCX.name();
        }
        if (isReviewStage(status)) {
            return FileObjectType.REVIEW_SNAPSHOT.name();
        }
        if (isPublishedStage(status)) {
            return FileObjectType.PUBLISHED_PDF.name();
        }
        return null;
    }

    private FileObjectType resolvePreviewObjectTypeAsEnum(DocumentRevisionRecord revision) {
        String value = resolvePreviewObjectType(revision);
        if (!StringUtils.hasText(value)) {
            return null;
        }
        try {
            return FileObjectType.valueOf(value);
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private boolean hasPreviewSource(DocumentRevisionRecord revision, FileObjectType objectType) {
        if (revision == null || objectType == null) {
            return false;
        }
        return switch (objectType) {
            case SOURCE_DOCX -> StringUtils.hasText(revision.getFilePath())
                    || StringUtils.hasText(revision.getSourceStorageObjectKey())
                    || StringUtils.hasText(revision.getStorageEditUrl())
                    || StringUtils.hasText(revision.getStorageViewUrl());
            case REVIEW_SNAPSHOT -> StringUtils.hasText(revision.getPreviewFilePath())
                    || StringUtils.hasText(revision.getStoragePdfUrl());
            case PUBLISHED_PDF -> StringUtils.hasText(revision.getPreviewFilePath())
                    || StringUtils.hasText(revision.getStoragePdfUrl());
            default -> false;
        };
    }

    private static final Set<String> OFFICE_EDITABLE_EXTENSIONS = Set.of(".doc", ".docx");

    /** Office Online (SharePoint Word Online) can only open/edit Word documents — a revision
     * whose source file is a PDF (or any other format) must never offer Upload/Edit Online. */
    private boolean isOfficeEditableFormat(String fileName) {
        if (!StringUtils.hasText(fileName)) {
            return false;
        }
        String normalized = fileName.toLowerCase(Locale.ROOT);
        return OFFICE_EDITABLE_EXTENSIONS.stream().anyMatch(normalized::endsWith);
    }

    private boolean hasOfficeWorkspace(DocumentRevisionRecord revision) {
        return revision != null && (
                StringUtils.hasText(revision.getStorageEditUrl())
                        || StringUtils.hasText(revision.getStorageItemId())
                        || StringUtils.hasText(revision.getStorageDriveId())
                        || StringUtils.hasText(revision.getStorageWebUrl())
        );
    }

    /**
     * F-07: read the required permission from the same {@code workflow_action_policies} row
     * that {@link RevisionWorkflowAuthorizationService#check} enforces, instead of a hardcoded
     * switch kept in sync by hand. That switch has drifted from the DB before — V159 seeded
     * SUBMIT_FOR_REVIEW with {@code documents.revision.submit_review}, and V290 changed the
     * policy to {@code documents.workspace.manage} via a one-off UPDATE specifically because
     * this hardcoded copy needed to match. An admin can also repoint a policy's required
     * permission at runtime through the Workflow Authorization UI; the capability response must
     * reflect that immediately, not the value baked into this Java file at build time.
     */
    private String resolveRequiredPermissionCode(RevisionWorkflowAction action, DocumentRevisionRecord revision) {
        String fromStatus = normalizeStatus(revision);
        UUID documentTypeId = revision == null || revision.getDocument() == null
                || revision.getDocument().getDocumentType() == null
                ? null
                : revision.getDocument().getDocumentType().getId();
        return workflowActionPolicyService.resolvePolicy(action, fromStatus, documentTypeId)
                .map(com.eqms.entity.WorkflowActionPolicy::getRequiredPermissionCode)
                .orElse(null);
    }

    private String resolveRequiredPermissionCode(FileAccessAction action, FileObjectType objectType) {
        return switch (action) {
            case VIEW_PREVIEW -> "documents.revision.preview";
            case DOWNLOAD -> "documents.revision.download_source";
            case UPLOAD -> "documents.revision.upload_source";
            case REPLACE -> "documents.revision.upload_source";
            case EDIT_ONLINE -> "documents.revision.edit_online";
            case SYNC_TO_OFFICE, SYNC_FROM_OFFICE -> "documents.revision.upload_office_online";
            default -> objectType == FileObjectType.SOURCE_DOCX
                    ? "documents.revision.download_source"
                    : "documents.revision.preview";
        };
    }

    private boolean isDraft(String status) {
        return "DRAFT".equalsIgnoreCase(status);
    }

    private boolean isReviewStage(String status) {
        return "PENDING_REVIEW".equalsIgnoreCase(status)
                || "PENDING_APPROVAL".equalsIgnoreCase(status)
                || "PENDING_TRAINING".equalsIgnoreCase(status)
                || "READY_FOR_PUBLISHING".equalsIgnoreCase(status);
    }

    private boolean isPublishedStage(String status) {
        return "EFFECTIVE".equalsIgnoreCase(status)
                || "OBSOLETED".equalsIgnoreCase(status);
    }

    private String normalizeStatus(DocumentRevisionRecord revision) {
        return revision == null || revision.getStatus() == null ? null : revision.getStatus().getCode();
    }
}
