package com.eqms.service;

import com.eqms.entity.ControlledCopyRecord;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentStakeholderHistory;
import com.eqms.entity.DocumentWorkflowParticipant;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.dto.security.RevisionWorkflowAuthorizationContext;
import com.eqms.entity.RevisionWorkflowParticipant;
import com.eqms.entity.UserAccount;
import com.eqms.enums.RevisionWorkflowAction;
import com.eqms.repository.DocumentRelationRepository;
import com.eqms.repository.DocumentRevisionRepository;
import com.eqms.repository.DocumentStakeholderHistoryRepository;
import com.eqms.repository.DocumentWorkflowParticipantRepository;
import com.eqms.repository.RevisionWorkflowParticipantRepository;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@Service
public class DocumentAuthorizationService {

    /** The one dedicated blanket-view permission for Documents/Revisions. */
    public static final String PERMISSION_DOCUMENT_VIEW_ALL = "documents.document.view_all";
    public static final String PERMISSION_DOCUMENT_VIEW = "documents.document.view";
    /** Dedicated blanket-view permissions for copies -- independent of the document one. */
    public static final String PERMISSION_CONTROLLED_COPY_VIEW_ALL = "documents.controlled_copy.view_all";
    public static final String PERMISSION_CONTROLLED_COPY_VIEW = "documents.controlled_copy.view";
    public static final String PERMISSION_UNCONTROLLED_COPY_VIEW_ALL = "documents.uncontrolled_copy.view_all";
    public static final String PERMISSION_UNCONTROLLED_COPY_VIEW = "documents.uncontrolled_copy.view";

    private final DocumentWorkflowParticipantRepository documentWorkflowParticipantRepository;
    private final RevisionWorkflowParticipantRepository revisionWorkflowParticipantRepository;
    private final DocumentRevisionRepository documentRevisionRepository;
    private final PermissionEvaluationService permissionEvaluationService;
    private final ObjectAccessEvaluationService objectAccessEvaluationService;
    private final LifecycleStatePolicyEvaluator lifecycleStatePolicyEvaluator;
    private final DocumentRelationRepository documentRelationRepository;
    private final DocumentMasterWorkflowAuthorizationService documentMasterWorkflowAuthorizationService;
    private final RevisionWorkflowAuthorizationService revisionWorkflowAuthorizationService;
    private final DocumentStakeholderHistoryRepository documentStakeholderHistoryRepository;
    private final SystemConfigurationService systemConfigurationService;

    public DocumentAuthorizationService(
            DocumentWorkflowParticipantRepository documentWorkflowParticipantRepository,
            RevisionWorkflowParticipantRepository revisionWorkflowParticipantRepository,
            DocumentRevisionRepository documentRevisionRepository,
            PermissionEvaluationService permissionEvaluationService,
            ObjectAccessEvaluationService objectAccessEvaluationService,
            LifecycleStatePolicyEvaluator lifecycleStatePolicyEvaluator,
            DocumentRelationRepository documentRelationRepository,
            DocumentMasterWorkflowAuthorizationService documentMasterWorkflowAuthorizationService,
            RevisionWorkflowAuthorizationService revisionWorkflowAuthorizationService,
            DocumentStakeholderHistoryRepository documentStakeholderHistoryRepository,
            @Lazy SystemConfigurationService systemConfigurationService
    ) {
        this.documentWorkflowParticipantRepository = documentWorkflowParticipantRepository;
        this.revisionWorkflowParticipantRepository = revisionWorkflowParticipantRepository;
        this.documentRevisionRepository = documentRevisionRepository;
        this.permissionEvaluationService = permissionEvaluationService;
        this.objectAccessEvaluationService = objectAccessEvaluationService;
        this.documentStakeholderHistoryRepository = documentStakeholderHistoryRepository;
        this.systemConfigurationService = systemConfigurationService;
        this.lifecycleStatePolicyEvaluator = lifecycleStatePolicyEvaluator;
        this.documentRelationRepository = documentRelationRepository;
        this.documentMasterWorkflowAuthorizationService = documentMasterWorkflowAuthorizationService;
        this.revisionWorkflowAuthorizationService = revisionWorkflowAuthorizationService;
    }

    /** The sole blanket-view grant is the dedicated {@value #PERMISSION_DOCUMENT_VIEW_ALL}
     *  permission, independent of the Record visibility mode and of any Access Profile name.
     *  Administration/operational permissions never imply it (V540 granted it to every set that
     *  previously relied on them), and legacy DCO pool membership / workflow-role assignment are
     *  descriptive metadata only (see V172 parity notes). */
    public boolean canViewAllDocuments(UserAccount user) {
        if (user == null || user.getId() == null) {
            return false;
        }
        return permissionEvaluationService.hasPermission(user, PERMISSION_DOCUMENT_VIEW_ALL);
    }

    /** True when Document Properties > Record visibility is "All" (ALL_WITH_VIEW_PERMISSION). */
    public boolean isOpenVisibilityMode() {
        return SystemConfigurationService.DOCUMENT_VISIBILITY_ALL_WITH_VIEW_PERMISSION
                .equals(systemConfigurationService.getDocumentVisibilityMode());
    }

    /** Open mode: every holder of the base permission sees every record. */
    private boolean hasOpenVisibility(UserAccount user, String baseViewPermission) {
        return user != null && user.getId() != null
                && isOpenVisibilityMode()
                && permissionEvaluationService.hasPermission(user, baseViewPermission);
    }

    /** Whether the Document/Revision list may skip the participant row filter: blanket grant, or
     *  open mode with the base view permission. */
    public boolean canListAllDocuments(UserAccount user) {
        return canViewAllDocuments(user) || hasOpenVisibility(user, PERMISSION_DOCUMENT_VIEW);
    }

    /** Controlled Copy blanket view: dedicated permission, or open mode with the base permission. */
    public boolean canViewAllControlledCopies(UserAccount user) {
        return user != null && user.getId() != null
                && (permissionEvaluationService.hasPermission(user, PERMISSION_CONTROLLED_COPY_VIEW_ALL)
                || hasOpenVisibility(user, PERMISSION_CONTROLLED_COPY_VIEW));
    }

    /** Uncontrolled Copy blanket view: dedicated permission, or open mode with the base permission. */
    public boolean canViewAllUncontrolledCopies(UserAccount user) {
        return user != null && user.getId() != null
                && (permissionEvaluationService.hasPermission(user, PERMISSION_UNCONTROLLED_COPY_VIEW_ALL)
                || hasOpenVisibility(user, PERMISSION_UNCONTROLLED_COPY_VIEW));
    }

    /** A Controlled Copy is visible to blanket viewers and to the user named as its recipient
     *  (matched by account id, never by display text). Document-flow participants and the people
     *  who acted on the copy do not see it merely for that reason. */
    public boolean canViewControlledCopy(UserAccount user, ControlledCopyRecord copy) {
        if (user == null || user.getId() == null || copy == null) {
            return false;
        }
        if (canViewAllControlledCopies(user)) {
            return true;
        }
        return copy.getRecipientUser() != null && user.getId().equals(copy.getRecipientUser().getId());
    }

    /** A distribution batch lists every recipient, so only blanket viewers may open it. */
    public boolean canViewControlledCopyBatch(UserAccount user) {
        return canViewAllControlledCopies(user);
    }

    public void requireCanViewControlledCopy(UserAccount user, ControlledCopyRecord copy) {
        if (!canViewControlledCopy(user, copy)) {
            throw new AccessDeniedException("Controlled copy access denied");
        }
    }

    public void requireCanViewControlledCopyBatch(UserAccount user) {
        if (!canViewControlledCopyBatch(user)) {
            throw new AccessDeniedException("Controlled copy access denied");
        }
    }

    public boolean canManageDocumentWorkspace(UserAccount user) {
        return permissionEvaluationService.hasPermission(user, "documents.workspace.manage");
    }

    public void requireCanManageDocumentWorkspace(UserAccount user) {
        if (!canManageDocumentWorkspace(user)) {
            throw new AccessDeniedException("Current user is not allowed to perform this action");
        }
    }

    /** "documents.document.create" was previously only ever read by CapabilityService to decide
     * whether the FE shows the "+ Add Document" button -- the actual create-draft endpoint only
     * checked the broader documents.workspace.manage (also used by canPublishRevision(), so it
     * can't just be granted to document.create holders generally without also handing them
     * publish rights). An Access Profile granting only "Create a new document shell" therefore
     * showed the Add button but always 403'd on save. Scoped to draft creation only. */
    public boolean canCreateDocument(UserAccount user) {
        return canManageDocumentWorkspace(user) || permissionEvaluationService.hasPermission(user, "documents.document.create");
    }

    public void requireCanCreateDocument(UserAccount user) {
        if (!canCreateDocument(user)) {
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

    public void requireCanManageRevisionWorkspace(UserAccount user) {
        if (!canManageRevisionWorkspace(user)) {
            throw new AccessDeniedException("Current user is not allowed to perform this action");
        }
    }

    /**
     * True when the user has a direct, record-scoped relationship to this Document -- Admin/DCO
     * (via the blanket {@link #canViewAllDocuments}), the Author, or any workflow participant
     * (Co-author/Reviewer/Approver on the document or any of its revisions). Deliberately EXCLUDES
     * the open-visibility grant (Record visibility = "All" plus the base
     * {@code documents.document.view} permission) -- that grant is for indirect/broad viewers only.
     *
     * GMP decision (HDR-AUTH-001): direct stakeholders automatically see a record's Preview file
     * and Audit Trail tab without needing the separate preview/view_audit permission codes;
     * indirect/broad viewers still need them. See SecureFileAccessService and AuditTrailService.
     */
    public boolean isDirectStakeholder(UserAccount user, DocumentRecord document) {
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
        if (documentWorkflowParticipantRepository
                .findAllByDocument_IdOrderBySequenceOrderAsc(document.getId())
                .stream()
                .anyMatch(participant -> participant.getUser() != null && Objects.equals(participant.getUser().getId(), currentUserId))
                || revisionWorkflowParticipantRepository
                .countByRevision_Document_IdAndUser_Id(document.getId(), currentUserId) > 0) {
            return true;
        }
        // Optional, per-role (Document Properties > "Retain Visibility for Removed ..." -- one
        // toggle each for Author/Co-Author/Reviewer/Approver, off by default): a user REMOVED from
        // one of those roles (e.g. reassigned via "Edit Revision for Upgrade") would otherwise lose
        // all trace above the moment they're no longer the CURRENT participant, and no separate
        // revision-level row exists for them yet -- this consults the permanent history, but only
        // for whichever of the 4 roles currently has its own toggle enabled.
        java.util.Set<String> retainedTypes = systemConfigurationService.getRetainVisibilityForRemovedParticipantTypes();
        return !retainedTypes.isEmpty()
                && documentStakeholderHistoryRepository.existsByDocument_IdAndUser_IdAndParticipantTypeIn(
                        document.getId(), currentUserId, retainedTypes);
    }

    public boolean canViewDocument(UserAccount user, DocumentRecord document) {
        if (user == null || user.getId() == null || document == null) {
            return false;
        }
        if (isDirectStakeholder(user, document)) {
            return true;
        }
        // Open mode (Record visibility = "All") is an ADDITIONAL grant -- it never short-circuits
        // ahead of the author/participant checks above.
        return hasOpenVisibility(user, PERMISSION_DOCUMENT_VIEW);
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
     * True when the user has a direct, record-scoped relationship to this Revision -- Admin/DCO
     * (via the blanket {@link #canViewAllDocuments}), the Author, or an assigned Co-author/
     * Reviewer/Approver participant. Deliberately EXCLUDES the open-visibility grant below --
     * see {@link #isDirectStakeholder(UserAccount, DocumentRecord)} for rationale.
     */
    public boolean isDirectStakeholder(UserAccount user, DocumentRevisionRecord revision) {
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

        if (revisionWorkflowParticipantRepository
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
                .anyMatch(participant -> participant.getUser() != null && Objects.equals(participant.getUser().getId(), currentUserId))) {
            return true;
        }
        // Same optional, per-role "Retain Visibility for Removed ..." fallback as the Document-level
        // overload above -- see its comment for rationale.
        UUID documentId = revision.getDocument() == null ? null : revision.getDocument().getId();
        if (documentId == null) {
            return false;
        }
        java.util.Set<String> retainedTypes = systemConfigurationService.getRetainVisibilityForRemovedParticipantTypes();
        return !retainedTypes.isEmpty()
                && documentStakeholderHistoryRepository.existsByDocument_IdAndUser_IdAndParticipantTypeIn(
                        documentId, currentUserId, retainedTypes);
    }

    /**
     * Row filter for the Document list when the user has no blanket view grant. Mirrors
     * {@link #isDirectStakeholder(UserAccount, DocumentRecord)}: Author, any Document-level workflow
     * participant, any revision-level participant, and -- when enabled for a role -- the removed
     * participant history. Callers skip this filter when {@link #canListAllDocuments} is true
     * (blanket permission, or Record visibility = "All").
     */
    public Predicate documentListVisibilityPredicate(UserAccount user, Root<DocumentRecord> root, CriteriaQuery<?> query, CriteriaBuilder cb) {
        UUID userId = user.getId();
        List<Predicate> visible = new ArrayList<>();
        visible.add(cb.equal(root.get("author").get("id"), userId));

        Subquery<UUID> documentParticipant = query.subquery(UUID.class);
        var documentParticipantRoot = documentParticipant.from(DocumentWorkflowParticipant.class);
        documentParticipant.select(documentParticipantRoot.get("document").get("id")).where(
                cb.equal(documentParticipantRoot.get("document").get("id"), root.get("id")),
                cb.equal(documentParticipantRoot.get("user").get("id"), userId));
        visible.add(cb.exists(documentParticipant));

        Subquery<UUID> revisionParticipant = query.subquery(UUID.class);
        var revisionParticipantRoot = revisionParticipant.from(RevisionWorkflowParticipant.class);
        revisionParticipant.select(revisionParticipantRoot.get("revision").get("document").get("id")).where(
                cb.equal(revisionParticipantRoot.get("revision").get("document").get("id"), root.get("id")),
                cb.equal(revisionParticipantRoot.get("user").get("id"), userId));
        visible.add(cb.exists(revisionParticipant));

        Set<String> retainedTypes = systemConfigurationService.getRetainVisibilityForRemovedParticipantTypes();
        if (!retainedTypes.isEmpty()) {
            Subquery<UUID> history = query.subquery(UUID.class);
            var historyRoot = history.from(DocumentStakeholderHistory.class);
            history.select(historyRoot.get("document").get("id")).where(
                    cb.equal(historyRoot.get("document").get("id"), root.get("id")),
                    cb.equal(historyRoot.get("user").get("id"), userId),
                    historyRoot.get("participantType").in(retainedTypes));
            visible.add(cb.exists(history));
        }
        return cb.or(visible.toArray(Predicate[]::new));
    }

    /**
     * Row filter for the Revision list when the user has no blanket view grant. Mirrors
     * {@link #isDirectStakeholder(UserAccount, DocumentRevisionRecord)}: Author, any revision-level
     * participant, and -- when enabled for a role -- the removed participant history of the Document.
     */
    public Predicate revisionListVisibilityPredicate(UserAccount user, Root<DocumentRevisionRecord> root, CriteriaQuery<?> query, CriteriaBuilder cb) {
        UUID userId = user.getId();
        List<Predicate> visible = new ArrayList<>();
        visible.add(cb.equal(root.get("author").get("id"), userId));

        Subquery<UUID> revisionParticipant = query.subquery(UUID.class);
        var revisionParticipantRoot = revisionParticipant.from(RevisionWorkflowParticipant.class);
        revisionParticipant.select(revisionParticipantRoot.get("revision").get("id")).where(
                cb.equal(revisionParticipantRoot.get("revision").get("id"), root.get("id")),
                cb.equal(revisionParticipantRoot.get("user").get("id"), userId));
        visible.add(cb.exists(revisionParticipant));

        Set<String> retainedTypes = systemConfigurationService.getRetainVisibilityForRemovedParticipantTypes();
        if (!retainedTypes.isEmpty()) {
            Subquery<UUID> history = query.subquery(UUID.class);
            var historyRoot = history.from(DocumentStakeholderHistory.class);
            history.select(historyRoot.get("document").get("id")).where(
                    cb.equal(historyRoot.get("document").get("id"), root.get("document").get("id")),
                    cb.equal(historyRoot.get("user").get("id"), userId),
                    historyRoot.get("participantType").in(retainedTypes));
            visible.add(cb.exists(history));
        }
        return cb.or(visible.toArray(Predicate[]::new));
    }

    public boolean canViewRevision(UserAccount user, DocumentRevisionRecord revision) {
        if (user == null || user.getId() == null || revision == null) {
            return false;
        }
        if (isDirectStakeholder(user, revision)) {
            return true;
        }

        // Open mode (Record visibility = "All") is an ADDITIONAL grant -- it never short-circuits
        // ahead of the author/participant checks above.
        return hasOpenVisibility(user, PERMISSION_DOCUMENT_VIEW);
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
                && isNextRevisionConfiguredForUpload(document)
                && !documentRevisionRepository.existsByDocument_IdAndStatus_CodeIn(document.getId(), IN_PROGRESS_REVISION_STATUS_CODES);
    }

    /**
     * An Active document (i.e. an upgrade) may only receive a new revision after the DCO saved "Edit
     * Revision for Upgrade"; the marker is consumed by the upload. Documents that are not Active yet
     * (the initial revision) are not subject to this step.
     */
    public boolean isNextRevisionConfiguredForUpload(DocumentRecord document) {
        if (document == null) {
            return false;
        }
        boolean active = document.getStatus() != null && "ACTIVE".equalsIgnoreCase(document.getStatus().getCode());
        return !active || document.getNextRevisionConfiguredAt() != null;
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

    /** Only the first REVIEWER whose action is still PENDING (sequential review) may act,
     *  and only once the immutable review snapshot has finished rendering. */
    public boolean canReviewRevision(UserAccount user, DocumentRevisionRecord revision) {
        return canActOnRevisionParticipant(user, revision, "REVIEWER");
    }

    /** Only the first APPROVER whose action is still PENDING may act. */
    public boolean canApproveRevision(UserAccount user, DocumentRevisionRecord revision) {
        return canActOnRevisionParticipant(user, revision, "APPROVER");
    }

    private boolean canActOnRevisionParticipant(UserAccount user, DocumentRevisionRecord revision, String participantType) {
        if (user == null || user.getId() == null || revision == null) {
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
