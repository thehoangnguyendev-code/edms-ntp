package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.security.ResourceActionCapabilityResponse;
import com.eqms.dto.security.ResourceCapabilitiesResponse;
import com.eqms.entity.DocumentRecord;
import com.eqms.repository.DocumentRevisionRepository;
import com.eqms.entity.UserAccount;
import com.eqms.repository.DocumentRecordRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.context.annotation.Lazy;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Shared, read-only action contract for a concrete Document Master record. */
@Service
public class DocumentMasterActionCapabilityService {
    private final CurrentUserService currentUserService;
    private final DocumentRecordRepository documentRepository;
    private final DocumentRevisionRepository documentRevisionRepository;
    private final DocumentAuthorizationService documentAuthorizationService;
    private final DocumentMasterWorkflowAuthorizationService documentMasterWorkflowAuthorizationService;
    private final PermissionEvaluationService permissionEvaluationService;
    private final DocumentService documentService;
    private final RevisionService revisionService;

    public DocumentMasterActionCapabilityService(
            CurrentUserService currentUserService,
            DocumentRecordRepository documentRepository,
            DocumentRevisionRepository documentRevisionRepository,
            DocumentAuthorizationService documentAuthorizationService,
            DocumentMasterWorkflowAuthorizationService documentMasterWorkflowAuthorizationService,
            PermissionEvaluationService permissionEvaluationService,
            @Lazy DocumentService documentService,
            @Lazy RevisionService revisionService
    ) {
        this.currentUserService = currentUserService;
        this.documentRepository = documentRepository;
        this.documentRevisionRepository = documentRevisionRepository;
        this.documentAuthorizationService = documentAuthorizationService;
        this.documentMasterWorkflowAuthorizationService = documentMasterWorkflowAuthorizationService;
        this.permissionEvaluationService = permissionEvaluationService;
        this.documentService = documentService;
        this.revisionService = revisionService;
    }

    @Transactional(readOnly = true)
    public ResourceCapabilitiesResponse getCapabilities(UUID documentId) {
        UserAccount user = currentUserService.requireCurrentUser();
        DocumentRecord document = documentRepository.findById(documentId)
                .orElseThrow(() -> new EntityNotFoundException("Document not found"));
        if (!documentAuthorizationService.canViewDocument(user, document)) {
            throw new AccessDeniedException("Document access denied");
        }

        Map<String, ResourceActionCapabilityResponse> actions = new LinkedHashMap<>();
        actions.put("view", allow(null, false));
        actions.put("editInitialDraft", simple(
                documentAuthorizationService.canEditInitialDocumentDraft(user, document),
                "DOCUMENT_DRAFT_EDIT_NOT_ALLOWED",
                "You cannot edit this initial Document draft.",
                "documents.document.edit_metadata",
                false));
        actions.put("uploadRevision", uploadRevision(user, document));
        // A controlled-document template is used directly as its Word file and is never distributed as a
        // controlled copy (ControlledCopyService#requestControlledCopy refuses it too); keep the button off.
        actions.put("requestControlledCopy", document.isTemplate()
                ? simple(false, "CONTROLLED_COPY_NOT_FOR_TEMPLATE",
                        "A controlled document template is used directly; controlled copies are not requested for templates.",
                        "documents.controlled_copy.request", false)
                : activeEffectivePermission(
                        user, document, "documents.controlled_copy.request", "CONTROLLED_COPY_REQUEST_NOT_ALLOWED",
                        "A controlled copy can be requested only for an active document with an Effective revision."));
        actions.put("configureNextReviewers", nextRevisionConfigurablePermission(
                user, document, "documents.revision.configure_next_reviewers", "CONFIGURE_REVIEWERS_NOT_ALLOWED",
                "You cannot configure reviewers for the next revision."));
        actions.put("configureNextApprovers", nextRevisionConfigurablePermission(
                user, document, "documents.revision.configure_next_approvers", "CONFIGURE_APPROVERS_NOT_ALLOWED",
                "You cannot configure approvers for the next revision."));
        actions.put("configureNextRelatedDocuments", nextRevisionConfigurablePermission(
                user, document, "documents.revision.configure_next_related_documents", "CONFIGURE_RELATED_DOCUMENTS_NOT_ALLOWED",
                "You cannot configure related documents for the next revision."));
        actions.put("configureNextCorrelatedDocuments", nextRevisionConfigurablePermission(
                user, document, "documents.revision.configure_next_correlated_documents", "CONFIGURE_CORRELATED_DOCUMENTS_NOT_ALLOWED",
                "You cannot configure correlated documents for the next revision."));
        // Despite the permission's broader scope (also gates Author, Co-Author, Training and
        // Description -- see V365__add_configure_next_metadata_permission.sql), this action key and
        // message stayed named after only its first field, Review Date, when it was introduced. That
        // undersold what granting documents.document.configure_next_metadata actually allows -- most
        // notably reassigning the Author -- to anyone reading this response or this code. Renamed for
        // accuracy; no behavior change (same permission code, same guard).
        actions.put("configureNextMetadata", nextRevisionConfigurablePermission(
                user, document, "documents.document.configure_next_metadata", "CONFIGURE_NEXT_METADATA_NOT_ALLOWED",
                "You cannot configure Author, Co-Author, Training, Periodic Review Cycle/Notification, Review Date or Description for the next revision."));
        actions.put("cancel", lifecycle(user, document, "CANCEL", false));
        actions.put("obsolete", obsolete(user, document));

        return new ResourceCapabilitiesResponse(
                "DOCUMENT_MASTER",
                documentId.toString(),
                document.getStatus() == null ? null : document.getStatus().getCode(),
                Instant.now().toString(),
                actions
        );
    }

    private ResourceActionCapabilityResponse lifecycle(
            UserAccount user, DocumentRecord document, String action, boolean requiresESignature
    ) {
        DocumentMasterWorkflowAuthorizationService.Decision decision =
                documentMasterWorkflowAuthorizationService.check(user, document, action);
        return new ResourceActionCapabilityResponse(
                decision.allowed(), decision.reasonCode(), decision.message(),
                decision.requiredPermissionCode(), requiresESignature);
    }

    private ResourceActionCapabilityResponse uploadRevision(UserAccount user, DocumentRecord document) {
        if (!documentAuthorizationService.canUploadRevision(user, document)) {
            return simple(false, "NOT_DOCUMENT_AUTHOR",
                    "Only the assigned Author with the upload permission can upload a revision.",
                    "documents.revision.upload_source", false);
        }
        if (!isActiveWithEffectiveRevision(document)) {
            return simple(false, "DOCUMENT_NOT_READY_FOR_UPGRADE",
                    "Upload Revision is available only when the document is Active and has an Effective revision.",
                    "documents.revision.upload_source", false);
        }
        if (hasOpenRevision(document)) {
            return simple(false, "DOCUMENT_HAS_OPEN_REVISIONS",
                    "Complete or close the current in-progress revision before uploading another revision.",
                    "documents.revision.upload_source", false);
        }
        if (!documentAuthorizationService.isNextRevisionConfiguredForUpload(document)) {
            return simple(false, "UPGRADE_NOT_CONFIGURED",
                    "The DCO must configure the next revision (Edit Revision for Upgrade) and save before a new revision can be uploaded.",
                    "documents.revision.upload_source", false);
        }
        // Mirrors the real guard RevisionService#createRevisionAndUploadFile enforces at submit
        // time (requireDocumentWorkflowParticipantsAssigned) -- without this check here too, the
        // button renders and is clickable for a Document with no Approver assigned yet (e.g. a
        // freshly-promoted Legacy Import, which never gets real workflow participants), and the DCO
        // only discovers that after picking a file and submitting.
        String missingParticipantsReason = revisionService.describeWhyDocumentWorkflowParticipantsAreMissing(document);
        if (missingParticipantsReason != null) {
            String reasonCode = missingParticipantsReason.startsWith("REVIEWER_REQUIRED")
                    ? "REVIEWER_REQUIRED"
                    : "APPROVER_REQUIRED";
            String message = "APPROVER_REQUIRED".equals(reasonCode)
                    ? "Assign an Approver before uploading a revision."
                    : "Assign a Reviewer before uploading a revision.";
            return simple(false, reasonCode, message, "documents.revision.upload_source", false);
        }
        return allow("documents.revision.upload_source", false);
    }

    private ResourceActionCapabilityResponse activeEffectivePermission(
            UserAccount user, DocumentRecord document, String permissionCode, String reasonCode, String reasonMessage
    ) {
        boolean allowed = isActiveWithEffectiveRevision(document)
                && permissionEvaluationService.hasPermission(user, permissionCode);
        return simple(allowed, reasonCode, reasonMessage, permissionCode, false);
    }

    /**
     * Same as {@link #activeEffectivePermission} plus the same "is the in-progress revision still
     * at a stage these choices could actually apply to" check DocumentService enforces at Save time
     * -- without this here too, the "Edit Revision for Upgrade" button (and Reviewer/Approver/
     * Related/Correlated actions gated on it) would still render and be clickable right up until
     * the DCO tries to Save, instead of never appearing once the revision has moved past Draft or
     * the Author has already uploaded it to Office Online.
     */
    private ResourceActionCapabilityResponse nextRevisionConfigurablePermission(
            UserAccount user, DocumentRecord document, String permissionCode, String reasonCode, String reasonMessage
    ) {
        ResourceActionCapabilityResponse base = activeEffectivePermission(user, document, permissionCode, reasonCode, reasonMessage);
        if (!base.allowed()) {
            return base;
        }
        if (!documentService.isNextRevisionConfigurable(document)) {
            return simple(false, "NEXT_REVISION_NOT_CONFIGURABLE",
                    "The in-progress revision is no longer at a stage where this can be changed.",
                    permissionCode, false);
        }
        return base;
    }

    private ResourceActionCapabilityResponse obsolete(UserAccount user, DocumentRecord document) {
        ResourceActionCapabilityResponse lifecycle = lifecycle(user, document, "OBSOLETE", true);
        if (!lifecycle.allowed()) {
            return lifecycle;
        }
        if (!isActiveWithEffectiveRevision(document)) {
            return simple(false, "DOCUMENT_NOT_READY_TO_OBSOLETE",
                    "Only an Active document with an Effective revision can be made obsolete.",
                    lifecycle.requiredPermissionCode(), true);
        }
        if (hasOpenRevision(document)) {
            return simple(false, "DOCUMENT_HAS_OPEN_REVISIONS",
                    "Close the current in-progress revision before making this document obsolete.",
                    lifecycle.requiredPermissionCode(), true);
        }
        return lifecycle;
    }

    private boolean isActiveWithEffectiveRevision(DocumentRecord document) {
        return document != null
                && document.getStatus() != null
                && "ACTIVE".equalsIgnoreCase(document.getStatus().getCode())
                && documentRevisionRepository.findFirstByDocument_IdAndStatus_CodeOrderByCreatedAtDesc(
                        document.getId(), "EFFECTIVE").isPresent();
    }

    private boolean hasOpenRevision(DocumentRecord document) {
        return documentRevisionRepository.existsByDocument_IdAndStatus_CodeIn(document.getId(), List.of(
                "DRAFT", "PENDING_REVIEW", "PENDING_APPROVAL", "PENDING_TRAINING", "READY_FOR_PUBLISHING"));
    }

    private static ResourceActionCapabilityResponse allow(String permissionCode, boolean requiresESignature) {
        return new ResourceActionCapabilityResponse(true, null, null, permissionCode, requiresESignature);
    }

    private static ResourceActionCapabilityResponse simple(
            boolean allowed, String reasonCode, String reasonMessage, String requiredPermissionCode, boolean requiresESignature
    ) {
        return new ResourceActionCapabilityResponse(
                allowed, allowed ? null : reasonCode, allowed ? null : reasonMessage, requiredPermissionCode, requiresESignature);
    }
}
