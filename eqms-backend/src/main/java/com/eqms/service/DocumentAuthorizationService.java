package com.eqms.service;

import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.dto.security.RevisionWorkflowAuthorizationContext;
import com.eqms.entity.RevisionWorkflowParticipant;
import com.eqms.entity.UserAccount;
import com.eqms.enums.RevisionWorkflowAction;
import com.eqms.repository.DocumentRelationRepository;
import com.eqms.repository.DocumentRevisionRepository;
import com.eqms.repository.DocumentWorkflowParticipantRepository;
import com.eqms.repository.RevisionWorkflowParticipantRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Service
public class DocumentAuthorizationService {

    @Value("${app.security.participant-visibility-strict:false}")
    private boolean strictVisibility;

    private final DocumentWorkflowParticipantRepository documentWorkflowParticipantRepository;
    private final RevisionWorkflowParticipantRepository revisionWorkflowParticipantRepository;
    private final DocumentRevisionRepository documentRevisionRepository;
    private final PermissionEvaluationService permissionEvaluationService;
    private final ObjectAccessEvaluationService objectAccessEvaluationService;
    private final LifecycleStatePolicyEvaluator lifecycleStatePolicyEvaluator;
    private final DocumentRelationRepository documentRelationRepository;
    private final DocumentMasterWorkflowAuthorizationService documentMasterWorkflowAuthorizationService;
    private final RevisionWorkflowAuthorizationService revisionWorkflowAuthorizationService;

    public DocumentAuthorizationService(
            DocumentWorkflowParticipantRepository documentWorkflowParticipantRepository,
            RevisionWorkflowParticipantRepository revisionWorkflowParticipantRepository,
            DocumentRevisionRepository documentRevisionRepository,
            PermissionEvaluationService permissionEvaluationService,
            ObjectAccessEvaluationService objectAccessEvaluationService,
            LifecycleStatePolicyEvaluator lifecycleStatePolicyEvaluator,
            DocumentRelationRepository documentRelationRepository,
            DocumentMasterWorkflowAuthorizationService documentMasterWorkflowAuthorizationService,
            RevisionWorkflowAuthorizationService revisionWorkflowAuthorizationService
    ) {
        this.documentWorkflowParticipantRepository = documentWorkflowParticipantRepository;
        this.revisionWorkflowParticipantRepository = revisionWorkflowParticipantRepository;
        this.documentRevisionRepository = documentRevisionRepository;
        this.permissionEvaluationService = permissionEvaluationService;
        this.objectAccessEvaluationService = objectAccessEvaluationService;
        this.lifecycleStatePolicyEvaluator = lifecycleStatePolicyEvaluator;
        this.documentRelationRepository = documentRelationRepository;
        this.documentMasterWorkflowAuthorizationService = documentMasterWorkflowAuthorizationService;
        this.revisionWorkflowAuthorizationService = revisionWorkflowAuthorizationService;
    }

    /** The sole blanket-view grant is the explicit permission; legacy DCO pool membership and
     *  workflow-role assignment are descriptive/assignable metadata only (see V172 parity notes). */
    public boolean canViewAllDocuments(UserAccount user) {
        if (user == null || user.getId() == null) {
            return false;
        }
        return hasDocumentAdministrationPermission(user);
    }

    public boolean canManageDocumentWorkspace(UserAccount user) {
        return permissionEvaluationService.hasPermission(user, "documents.workspace.manage");
    }

    public void requireCanManageDocumentWorkspace(UserAccount user) {
        if (!canManageDocumentWorkspace(user)) {
            throw new AccessDeniedException("Current user is not allowed to perform this action");
        }
    }

    /** Delegates Document Master lifecycle decisions to the policy-backed evaluator. */
    public void requireDocumentMasterLifecycleAction(UserAccount user, DocumentRecord document, String actionCode) {
        documentMasterWorkflowAuthorizationService.require(user, document, actionCode);
    }

    public boolean canPerformDocumentMasterLifecycleAction(UserAccount user, DocumentRecord document, String actionCode) {
        return documentMasterWorkflowAuthorizationService.isAllowed(user, document, actionCode);
    }

    public boolean canManageRevisionWorkspace(UserAccount user) {
        return canViewAllDocuments(user);
    }

    public boolean canPublishRevision(UserAccount user) {
        // The explicit workspace-management permission matches the policy row seeded
        // for PUBLISH. Role names are intentionally not part of this decision.
        return canManageDocumentWorkspace(user);
    }

    public void requireCanPublishRevision(UserAccount user) {
        if (!canPublishRevision(user)) {
            throw new AccessDeniedException("Current user is not authorized to publish revisions.");
        }
    }

    /** Checks for a genuine blanket "view all documents" grant only — operational permissions
     *  like document.create/edit_metadata do NOT imply this and must not be listed here. */
    private boolean hasDocumentAdministrationPermission(UserAccount user) {
        return permissionEvaluationService.hasAnyPermission(
                user,
                "documents.admin.view",
                "documents.admin.manage_workflow_roles",
                "documents.admin.manage_sod_constraints",
                "documents.document.view_all"
        );
    }

    public void requireCanManageRevisionWorkspace(UserAccount user) {
        if (!canManageRevisionWorkspace(user)) {
            throw new AccessDeniedException("Current user is not allowed to perform this action");
        }
    }

    public boolean canViewDocument(UserAccount user, DocumentRecord document) {
        if (user == null || user.getId() == null || document == null) {
            return false;
        }
        if (canViewAllDocuments(user)) {
            return true;
        }
        UUID currentUserId = user.getId();
        UUID authorId = document.getAuthor() == null ? null : document.getAuthor().getId();
        if (Objects.equals(authorId, currentUserId)) {
            return true;
        }
        boolean isParticipant = documentWorkflowParticipantRepository
                .findAllByDocument_IdOrderBySequenceOrderAsc(document.getId())
                .stream()
                .anyMatch(participant -> participant.getUser() != null && Objects.equals(participant.getUser().getId(), currentUserId))
                || revisionWorkflowParticipantRepository
                .countByRevision_Document_IdAndUser_Id(document.getId(), currentUserId) > 0;
        if (isParticipant) {
            return true;
        }
        // Strict-visibility is an ADDITIONAL grant (broadens access to terminal-status documents
        // for holders of the base view permission) -- it must never short-circuit ahead of the
        // author/participant checks above, or an assigned participant on a non-terminal document
        // gets wrongly denied just because they also happen to hold documents.document.view.
        if (strictVisibility && permissionEvaluationService.hasPermission(user, "documents.document.view")) {
            return documentRevisionRepository.existsByDocument_IdAndStatus_CodeIn(
                    document.getId(), java.util.List.of("EFFECTIVE", "OBSOLETED", "CLOSED_CANCELLED"));
        }
        return false;
    }

    public void requireCanViewDocument(UserAccount user, DocumentRecord document) {
        if (!canViewDocument(user, document)) {
            throw new AccessDeniedException("Document access denied");
        }
    }

    public boolean canViewDocumentRevisions(UserAccount user, DocumentRecord document) {
        return canViewDocument(user, document);
    }

    public void requireCanViewDocumentRevisions(UserAccount user, DocumentRecord document) {
        if (!canViewDocumentRevisions(user, document)) {
            throw new AccessDeniedException("Revision access denied");
        }
    }

    /**
     * True when the "strict view" rule (system-wide config flag + documents.document.view
     * permission) grants visibility of any revision whose status is EFFECTIVE, OBSOLETED, or
     * CLOSED_CANCELLED, independent of author/participant role. This is the same condition used
     * inline by {@link #canViewRevision}/{@link #canViewDocument} — exposed here so a caller that
     * needs to push authorization into a database query (rather than evaluate it per loaded row)
     * can query-time-check user + permission once and combine with a status filter, instead of
     * duplicating the strictVisibility flag or permission code.
     */
    public boolean isStrictViewEligible(UserAccount user) {
        return strictVisibility && permissionEvaluationService.hasPermission(user, "documents.document.view");
    }

    public boolean canViewRevision(UserAccount user, DocumentRevisionRecord revision) {
        if (user == null || user.getId() == null || revision == null) {
            return false;
        }
        if (canViewAllDocuments(user)) {
            return true;
        }

        UUID currentUserId = user.getId();
        UUID authorId = revision.getAuthor() == null ? null : revision.getAuthor().getId();
        if (Objects.equals(authorId, currentUserId)) {
            return true;
        }

        boolean isParticipant = revisionWorkflowParticipantRepository
                .findAllByRevision_IdAndParticipantTypeOrderBySequenceOrderAsc(revision.getId(), "CO_AUTHOR")
                .stream()
                .anyMatch(participant -> participant.getUser() != null && Objects.equals(participant.getUser().getId(), currentUserId))
                || revisionWorkflowParticipantRepository
                .findAllByRevision_IdAndParticipantTypeOrderBySequenceOrderAsc(revision.getId(), "REVIEWER")
                .stream()
                .anyMatch(participant -> participant.getUser() != null && Objects.equals(participant.getUser().getId(), currentUserId))
                || revisionWorkflowParticipantRepository
                .findAllByRevision_IdAndParticipantTypeOrderBySequenceOrderAsc(revision.getId(), "APPROVER")
                .stream()
                .anyMatch(participant -> participant.getUser() != null && Objects.equals(participant.getUser().getId(), currentUserId));
        if (isParticipant) {
            return true;
        }

        // Strict-visibility is an ADDITIONAL grant (broadens access to terminal-status revisions
        // for holders of the base view permission) -- it must never short-circuit ahead of the
        // author/participant checks above, or an assigned reviewer/approver on a non-terminal
        // revision gets wrongly denied just because they also happen to hold documents.document.view.
        if (strictVisibility && permissionEvaluationService.hasPermission(user, "documents.document.view")) {
            String status = revision.getStatus() == null ? null : revision.getStatus().getCode();
            return "EFFECTIVE".equalsIgnoreCase(status)
                    || "OBSOLETED".equalsIgnoreCase(status)
                    || "CLOSED_CANCELLED".equalsIgnoreCase(status);
        }

        return false;
    }

    public void requireCanViewRevision(UserAccount user, DocumentRevisionRecord revision) {
        if (!canViewRevision(user, revision)) {
            throw new AccessDeniedException("Revision access denied");
        }
    }

    private static final List<String> IN_PROGRESS_REVISION_STATUS_CODES = List.of(
            "DRAFT",
            "PENDING_REVIEW",
            "PENDING_APPROVAL",
            "PENDING_TRAINING",
            "READY_FOR_PUBLISHING"
    );

    public boolean canUploadRevision(UserAccount user, DocumentRecord document) {
        if (user == null || user.getId() == null || document == null) {
            return false;
        }
        UUID authorId = document.getAuthor() == null ? null : document.getAuthor().getId();
        return Objects.equals(authorId, user.getId())
                && permissionEvaluationService.hasPermission(user, "documents.revision.upload_source");
    }

    /**
     * Same author/permission gate as {@link #canUploadRevision}, plus the "no revision already in
     * progress" rule that {@code createRevisionAndUploadFile}'s {@code ensureNoRevisionInProgress}
     * enforces server-side (backed by the ux_document_revisions_one_in_progress DB constraint).
     * Deliberately kept separate from {@link #canUploadRevision}/{@link #requireCanUploadRevision}:
     * those are also the enforcement gate for the actual upload action, which already throws a
     * more specific "revision already in progress" error via ensureNoRevisionInProgress -- folding
     * the same check in here would make that specific error unreachable, masked by this method's
     * generic "not the author" message instead. This method exists only to decide whether the
     * "Upload Revision" button should be shown as clickable in the first place.
     */
    public boolean canStartNewRevisionUpload(UserAccount user, DocumentRecord document) {
        return canUploadRevision(user, document)
                && document != null
                && !documentRevisionRepository.existsByDocument_IdAndStatus_CodeIn(document.getId(), IN_PROGRESS_REVISION_STATUS_CODES);
    }

    public void requireCanUploadRevision(UserAccount user, DocumentRecord document) {
        if (!canUploadRevision(user, document)) {
            throw new AccessDeniedException("Only the assigned Author can upload the revision file.");
        }
    }

    /**
     * A document master remains editable only until its first revision is created.  The
     * The assigned Author may edit their own draft when granted the source-upload and
     * metadata-edit permissions. A Document Control coordinator may edit any initial
     * draft when granted metadata-edit and workspace-management permissions. Access
     * Profile names and displayed roles are never used as entitlements.
     */
    public boolean canEditInitialDocumentDraft(UserAccount user, DocumentRecord document) {
        if (user == null || user.getId() == null || document == null
                || document.getStatus() == null
                || !"DRAFT".equalsIgnoreCase(document.getStatus().getCode())) {
            return false;
        }
        if (documentRevisionRepository.existsByDocument_Id(document.getId())) {
            return false;
        }
        boolean canEditOwnAuthorDraft = canUploadRevision(user, document)
                && permissionEvaluationService.hasPermission(user, "documents.document.edit_metadata");
        boolean canManageAnyInitialDraft = permissionEvaluationService.hasAllPermissions(
                user, "documents.document.edit_metadata", "documents.workspace.manage");
        return canEditOwnAuthorDraft || canManageAnyInitialDraft;
    }

    public void requireCanEditInitialDocumentDraft(UserAccount user, DocumentRecord document) {
        if (!canEditInitialDocumentDraft(user, document)) {
            throw new AccessDeniedException("Current user is not allowed to edit this initial document draft.");
        }
    }

    public boolean canEditDraftRevision(UserAccount user, DocumentRevisionRecord revision) {
        if (user == null || user.getId() == null || revision == null) {
            return false;
        }
        String revisionStatus = revision.getStatus() == null ? null : revision.getStatus().getCode();
        if (!"DRAFT".equalsIgnoreCase(revisionStatus)) {
            return false;
        }

        UUID currentUserId = user.getId();
        UUID authorId = revision.getAuthor() == null ? null : revision.getAuthor().getId();
        if (Objects.equals(authorId, currentUserId)) {
            return true;
        }

        return revisionWorkflowParticipantRepository
                .findAllByRevision_IdAndParticipantTypeOrderBySequenceOrderAsc(revision.getId(), "CO_AUTHOR")
                .stream()
                .anyMatch(participant -> participant.getUser() != null && currentUserId.equals(participant.getUser().getId()));
    }

    public void requireCanEditDraftRevision(UserAccount user, DocumentRevisionRecord revision) {
        if (!canEditDraftRevision(user, revision)) {
            throw new AccessDeniedException("Draft revision edit access denied");
        }
    }

    public boolean canEditRevisionFileOnline(UserAccount user, DocumentRevisionRecord revision) {
        if (user == null || user.getId() == null || revision == null) {
            return false;
        }
        String revisionStatus = revision.getStatus() == null ? null : revision.getStatus().getCode();
        if (!"DRAFT".equalsIgnoreCase(revisionStatus)) {
            return false;
        }
        if (revision.isSourceLocked()) {
            return false;
        }

        UUID currentUserId = user.getId();
        UUID authorId = revision.getAuthor() == null ? null : revision.getAuthor().getId();
        if (Objects.equals(authorId, currentUserId)) {
            return true;
        }

        return revisionWorkflowParticipantRepository
                .findAllByRevision_IdAndParticipantTypeOrderBySequenceOrderAsc(revision.getId(), "CO_AUTHOR")
                .stream()
                .anyMatch(participant -> participant.getUser() != null
                        && currentUserId.equals(participant.getUser().getId()));
    }

    /**
     * Only the assigned Author may upload/replace the revision source file. A
     * Co-Author can edit online, but cannot replace the controlled source artifact.
     */
    public boolean canUploadRevisionSource(UserAccount user, DocumentRevisionRecord revision) {
        if (user == null || user.getId() == null || revision == null) {
            return false;
        }
        String revisionStatus = revision.getStatus() == null ? null : revision.getStatus().getCode();
        if (!"DRAFT".equalsIgnoreCase(revisionStatus)) {
            return false;
        }
        if (revision.isSourceLocked()) {
            return false;
        }

        UUID currentUserId = user.getId();
        UUID authorId = revision.getAuthor() == null ? null : revision.getAuthor().getId();
        return Objects.equals(authorId, currentUserId)
                && permissionEvaluationService.hasPermission(user, "documents.revision.upload_source");
    }

    public boolean canCompleteRevisionEditing(UserAccount user, DocumentRevisionRecord revision) {
        if (user == null || user.getId() == null || revision == null) {
            return false;
        }
        String revisionStatus = revision.getStatus() == null ? null : revision.getStatus().getCode();
        if (!"DRAFT".equalsIgnoreCase(revisionStatus)) {
            return false;
        }
        if (revision.isSourceLocked()) {
            return false;
        }
        UUID currentUserId = user.getId();
        UUID authorId = revision.getAuthor() == null ? null : revision.getAuthor().getId();
        if (Objects.equals(authorId, currentUserId)) {
            return true;
        }
        return revisionWorkflowParticipantRepository
                .findAllByRevision_IdAndParticipantTypeOrderBySequenceOrderAsc(revision.getId(), "CO_AUTHOR")
                .stream()
                .anyMatch(participant -> participant.getUser() != null
                        && currentUserId.equals(participant.getUser().getId()));
    }

    public void requireCanCompleteRevisionEditing(UserAccount user, DocumentRevisionRecord revision) {
        if (!canCompleteRevisionEditing(user, revision)) {
            throw new AccessDeniedException("Only the assigned Author or Co-Author can complete editing the revision.");
        }
    }

    public boolean canOpenPublishingWorkspace(UserAccount user, DocumentRevisionRecord revision) {
        if (user == null || user.getId() == null || revision == null) {
            return false;
        }
        return revisionWorkflowAuthorizationService.check(
                user,
                revision,
                RevisionWorkflowAction.OPEN_PUBLISHING_WORKSPACE,
                RevisionWorkflowAuthorizationContext.of(revision)
        ).allowed();
        /* Legacy workspace rule retained only for migration context.
        // Publishing starts only after Review/Approval/Training complete. The former DRAFT
        // condition contradicted PublishingWorkspaceService.requireReadyRevision and blocked
        // legitimate preview regeneration for DCO users.
        if (!"READY_FOR_PUBLISHING".equalsIgnoreCase(revisionStatus)) {
            return false;
        }
        // documents.workspace.manage specifically (DCO), not the broader document-admin-view
        // group canPublishRevision() checks — matches the workflow_action_policies row seeded
        // for OPEN_PUBLISHING_WORKSPACE and the explicit product decision that only DCO opens
        // this workspace.
        return canManageDocumentWorkspace(user);*/
    }

    public void requireCanOpenPublishingWorkspace(UserAccount user, DocumentRevisionRecord revision) {
        revisionWorkflowAuthorizationService.require(
                user,
                revision,
                RevisionWorkflowAction.OPEN_PUBLISHING_WORKSPACE,
                RevisionWorkflowAuthorizationContext.of(revision)
        );
    }

    public void requireCanEditRevisionFileOnline(UserAccount user, DocumentRevisionRecord revision) {
        if (!canEditRevisionFileOnline(user, revision)) {
            throw new AccessDeniedException("Only the assigned Author or Co-Author can edit the revision file online.");
        }
    }

    public boolean canAccessControlledCopy(UserAccount user, DocumentRevisionRecord revision) {
        return canViewRevision(user, revision);
    }

    public boolean canAccessControlledCopy(UserAccount user, DocumentRecord document) {
        return canViewDocument(user, document);
    }

    public void requireCanAccessControlledCopy(UserAccount user, DocumentRevisionRecord revision) {
        if (!canAccessControlledCopy(user, revision)) {
            throw new AccessDeniedException("Controlled copy access denied");
        }
    }

    public void requireCanAccessControlledCopy(UserAccount user, DocumentRecord document) {
        if (!canAccessControlledCopy(user, document)) {
            throw new AccessDeniedException("Controlled copy access denied");
        }
    }

    /** Only the first REVIEWER whose action is still PENDING (sequential review) may act,
     *  and only once the immutable review snapshot has finished rendering. */
    public boolean canReviewRevision(UserAccount user, DocumentRevisionRecord revision) {
        return canActOnRevisionParticipant(user, revision, "REVIEWER");
    }

    /** Only the first APPROVER whose action is still PENDING may act, and only once the
     *  immutable review snapshot has finished rendering. */
    public boolean canApproveRevision(UserAccount user, DocumentRevisionRecord revision) {
        return canActOnRevisionParticipant(user, revision, "APPROVER");
    }

    private boolean canActOnRevisionParticipant(UserAccount user, DocumentRevisionRecord revision, String participantType) {
        if (user == null || user.getId() == null || revision == null) {
            return false;
        }
        if (!"READY".equalsIgnoreCase(revision.getSnapshotStatus())) {
            return false;
        }
        List<RevisionWorkflowParticipant> participants = revisionWorkflowParticipantRepository
                .findAllByRevision_IdAndParticipantTypeOrderBySequenceOrderAsc(revision.getId(), participantType);
        return participants.stream()
                .filter(participant -> "PENDING".equalsIgnoreCase(participant.getActionStatus()))
                .findFirst()
                .map(participant -> participant.getUser() != null && user.getId().equals(participant.getUser().getId()))
                .orElse(false);
    }
}
