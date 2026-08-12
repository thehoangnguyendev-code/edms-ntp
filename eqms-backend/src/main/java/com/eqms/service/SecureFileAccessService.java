package com.eqms.service;

import com.eqms.dto.security.FileAccessContext;
import com.eqms.dto.security.FileAccessDecision;
import com.eqms.enums.FileAccessAction;
import com.eqms.enums.FileObjectType;
import com.eqms.enums.LifecycleCapability;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.exception.FileAccessDeniedException;
import com.eqms.repository.RevisionWorkflowParticipantRepository;
import com.eqms.service.EffectivePermissionService.EffectivePermissionResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Objects;
import java.util.UUID;

/**
 * Sprint 2 — Secure File Access Kernel.
 *
 * Central authorization facade for all file access operations.
 * Evaluates:
 *   1. User authentication / active status
 *   2. Permission codes
 *   3. Business rules (revision status, sourceLocked, editingStatus, CC policy)
 *   4. Audit logging for high-risk file actions
 *
 * Callers build a FileAccessContext from the domain object and pass it here.
 * This service does NOT load domain objects itself; it only evaluates what the caller provides.
 */
@Service
public class SecureFileAccessService {

    private static final Logger log = LoggerFactory.getLogger(SecureFileAccessService.class);

    private final PermissionEvaluationService permissionEvaluationService;
    private final EffectivePermissionService effectivePermissionService;
    private final AuditTrailService auditTrailService;
    private final RevisionWorkflowParticipantRepository revisionWorkflowParticipantRepository;
    private final LifecycleStatePolicyEvaluator lifecycleStatePolicyEvaluator;
    private final DocumentAuthorizationService documentAuthorizationService;

    @Value("${app.security.participant-visibility-strict:false}")
    private boolean strictVisibility;

    @Value("${app.security.lifecycle-policy-enabled:false}")
    private boolean lifecyclePolicyEnabled;

    @Autowired
    public SecureFileAccessService(
            PermissionEvaluationService permissionEvaluationService,
            EffectivePermissionService effectivePermissionService,
            AuditTrailService auditTrailService,
            RevisionWorkflowParticipantRepository revisionWorkflowParticipantRepository,
            LifecycleStatePolicyEvaluator lifecycleStatePolicyEvaluator,
            DocumentAuthorizationService documentAuthorizationService
    ) {
        this.permissionEvaluationService = permissionEvaluationService;
        this.effectivePermissionService = effectivePermissionService;
        this.auditTrailService = auditTrailService;
        this.revisionWorkflowParticipantRepository = revisionWorkflowParticipantRepository;
        this.lifecycleStatePolicyEvaluator = lifecycleStatePolicyEvaluator;
        this.documentAuthorizationService = documentAuthorizationService;
    }

    /**
     * Canonical "is DCO or Document Admin" check — delegates to
     * {@link DocumentAuthorizationService#canViewAllDocuments} so this matches the same
     * Access Profile Workflow Role (DCO) / legacy pool resolution used everywhere else,
     * instead of a hardcoded blanket-permission list that silently excludes DCO users who
     * only hold the new-catalog DCO workflow role assignment.
     */
    private boolean canViewAllDocuments(UserAccount user) {
        return documentAuthorizationService.canViewAllDocuments(user);
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Evaluates file access without throwing.
     */
    public FileAccessDecision check(
            UserAccount user,
            FileAccessAction action,
            FileObjectType objectType,
            UUID objectId,
            FileAccessContext context
    ) {
        // 1. Basic auth checks
        if (user == null) {
            return FileAccessDecision.denied("AUTH_REQUIRED",
                    "Authentication is required.", null, action, objectType, objectId);
        }
        if (user.getStatus() == UserStatus.Inactive) {
            return FileAccessDecision.denied("USER_INACTIVE",
                    "User account is inactive.", null, action, objectType, objectId);
        }

        // 2. GMP Segregation of Duties: SYSTEM_SUPER_ADMIN is not exempt from file access
        // permission checks — it must hold the required permission like any other user (see
        // V243__seed_system_super_admin_permission_set.sql).
        String requiredPermission = resolveRequiredPermission(action, objectType);
        if (requiredPermission != null && !hasFilePermission(user, requiredPermission, context)) {
            return FileAccessDecision.denied("MISSING_PERMISSION",
                    "You do not have permission to perform this action.",
                    requiredPermission, action, objectType, objectId);
        }

        // 3. Business rule checks
        FileAccessDecision businessResult = evaluateBusinessRules(user, action, objectType, objectId, context, requiredPermission);
        if (businessResult != null) return businessResult;

        return FileAccessDecision.allowed(action, objectType, objectId, isHighRisk(action));
    }

    /**
     * Throws {@link FileAccessDeniedException} if access is denied.
     * Logs audit event for high-risk denied actions.
     */
    public void require(
            UserAccount user,
            FileAccessAction action,
            FileObjectType objectType,
            UUID objectId,
            FileAccessContext context
    ) {
        FileAccessDecision decision = check(user, action, objectType, objectId, context);
        if (!decision.allowed()) {
            logDeniedAudit(user, action, objectType, objectId, decision.reasonCode(), decision.permissionCode());
            throw new FileAccessDeniedException(
                    decision.reasonCode(),
                    decision.message(),
                    decision.permissionCode(),
                    action,
                    objectType,
                    objectId
            );
        }
    }

    /** Convenience overload without object context. */
    public void require(UserAccount user, FileAccessAction action, FileObjectType objectType, UUID objectId) {
        require(user, action, objectType, objectId, FileAccessContext.empty());
    }

    // ── Permission mapping ────────────────────────────────────────────────────

    private boolean hasFilePermission(UserAccount user, String permissionCode, FileAccessContext context) {
        return permissionEvaluationService.hasPermission(user, permissionCode);
    }

    private String resolveRequiredPermission(FileAccessAction action, FileObjectType objectType) {
        return switch (objectType) {
            case REVISION -> switch (action) {
                case VIEW_PREVIEW -> "documents.revision.preview";
                case DOWNLOAD -> "documents.revision.download_source";
                case UPLOAD, REPLACE -> "documents.revision.upload_source";
                case EDIT_ONLINE, GENERATE_SHAREPOINT_LINK -> "documents.revision.edit_online";
                case SYNC_TO_OFFICE, SYNC_FROM_OFFICE -> "documents.revision.upload_office_online";
                case GENERATE_PREVIEW -> "documents.revision.generate_preview";
                default -> null;
            };
            case REVIEW_SNAPSHOT -> "documents.revision.preview";
            case PUBLISHED_PDF -> switch (action) {
                case VIEW_PREVIEW, VIEW_ONLINE -> "documents.document.preview_published";
                case DOWNLOAD -> "documents.document.download_published";
                case GENERATE_PUBLISHED_PDF -> "documents.revision.publish";
                default -> null;
            };
            case SOURCE_DOCX -> switch (action) {
                // Preview is read-only review access; downloading the editable source remains a
                // separate, more sensitive permission.
                case VIEW_PREVIEW -> "documents.revision.preview";
                case DOWNLOAD -> "documents.revision.download_source";
                case UPLOAD, REPLACE -> "documents.revision.upload_source";
                case EDIT_ONLINE -> "documents.revision.edit_online";
                case SYNC_TO_OFFICE, SYNC_FROM_OFFICE -> "documents.revision.upload_office_online";
                default -> null;
            };
            case CONTROLLED_COPY -> switch (action) {
                case VIEW_PREVIEW, VIEW_ONLINE -> "documents.controlled_copy.view_file";
                case DOWNLOAD -> "documents.controlled_copy.download_file";
                default -> null;
            };
            case CONTROLLED_COPY_EVIDENCE -> switch (action) {
                case VIEW_EVIDENCE, VIEW_PREVIEW -> "documents.controlled_copy.view_evidence";
                case DOWNLOAD_EVIDENCE, DOWNLOAD -> "documents.controlled_copy.download_evidence";
                case UPLOAD_EVIDENCE, UPLOAD -> "documents.controlled_copy.upload_evidence";
                default -> null;
            };
            case DOCUMENT -> switch (action) {
                case VIEW_PREVIEW -> "documents.document.preview_published";
                case DOWNLOAD -> "documents.document.download_published";
                default -> null;
            };
            // Publishing workspace
            case PUBLISHING_TEMPLATE -> switch (action) {
                case VIEW_PREVIEW, GENERATE_PREVIEW, GENERATE_PUBLISHED_PDF -> "documents.revision.publish";
                default -> null;
            };
            case PUBLISHING_PREVIEW -> switch (action) {
                case VIEW_PREVIEW, VIEW_ONLINE -> "documents.revision.publish";
                case GENERATE_PREVIEW -> "documents.revision.publish";
                default -> null;
            };
            default -> null;
        };
    }

    // ── Business rules ────────────────────────────────────────────────────────

    private FileAccessDecision evaluateBusinessRules(
            UserAccount user,
            FileAccessAction action,
            FileObjectType objectType,
            UUID objectId,
            FileAccessContext context,
            String permissionCode
    ) {
        if (context == null) return null;

        return switch (objectType) {
            case SOURCE_DOCX, REVISION -> evaluateRevisionSourceRules(user, action, objectId, context, permissionCode);
            case REVIEW_SNAPSHOT -> evaluateReviewSnapshotRules(user, action, objectId, context, permissionCode);
            case PUBLISHED_PDF -> evaluatePublishedPdfRules(action, objectId, context, permissionCode);
            case CONTROLLED_COPY -> evaluateControlledCopyRules(action, objectId, context, permissionCode);
            case CONTROLLED_COPY_EVIDENCE -> evaluateEvidenceRules(action, objectId, context, permissionCode);
            default -> null;
        };
    }

    /** Revision source DOCX: status, sourceLocked, editingStatus rules. */
    private FileAccessDecision evaluateRevisionSourceRules(
            UserAccount user,
            FileAccessAction action,
            UUID objectId,
            FileAccessContext context,
            String permissionCode
    ) {
        String status = context.workflowState();
        boolean sourceLocked = context.getBool("sourceLocked", false);
        String editingStatus = context.getString("editingStatus");

        // All source mutations require a Draft revision that is not locked or completed.
        // The action-specific permission is evaluated before this method. Record-level workspace
        // access is enforced by RevisionService; do not encode an Author-only policy here.
        boolean isEditOnlineAction = action == FileAccessAction.EDIT_ONLINE
                || action == FileAccessAction.GENERATE_SHAREPOINT_LINK;
        boolean isSyncAction = action == FileAccessAction.SYNC_TO_OFFICE
                || action == FileAccessAction.SYNC_FROM_OFFICE;
        boolean isUploadAction = action == FileAccessAction.UPLOAD || action == FileAccessAction.REPLACE;

        if (isEditOnlineAction || isSyncAction || isUploadAction) {
            if (!"DRAFT".equalsIgnoreCase(status)) {
                return FileAccessDecision.denied("INVALID_REVISION_STATUS",
                        "This action requires the revision to be in Draft status.",
                        permissionCode, action, FileObjectType.SOURCE_DOCX, objectId);
            }
            if (sourceLocked) {
                return FileAccessDecision.denied("SOURCE_LOCKED",
                        "The revision source file is locked and cannot be edited.",
                        permissionCode, action, FileObjectType.SOURCE_DOCX, objectId);
            }
            if ("COMPLETED".equalsIgnoreCase(editingStatus)) {
                return FileAccessDecision.denied("EDITING_COMPLETED",
                        "Revision editing has been completed and the source file cannot be modified.",
                        permissionCode, action, FileObjectType.SOURCE_DOCX, objectId);
            }
        }

        // Edit Online: Author OR assigned Co-Author OR DCO/Document Admin
        if (isEditOnlineAction && context.getString("authorId") != null) {
            UUID revisionIdCtx = context.getUUID("revisionId");
            UUID authorId = context.getUUID("authorId");
            boolean isAuthor = user.getId() != null && Objects.equals(authorId, user.getId());
            boolean isCoAuthor = revisionIdCtx != null && isAssignedCoAuthor(user, revisionIdCtx);
            if (!isAuthor && !isCoAuthor) {
                return FileAccessDecision.denied("NOT_AUTHOR_OR_COAUTHOR",
                        "Only the assigned revision author or co-author can edit online.",
                        permissionCode, action, FileObjectType.SOURCE_DOCX, objectId);
            }
        }

        // Sync actions: Author OR DCO/Document Admin only — Co-Author cannot sync
        if ((isSyncAction || isUploadAction) && context.getString("authorId") != null) {
            UUID authorId = context.getUUID("authorId");
            if (user.getId() == null || !Objects.equals(authorId, user.getId())) {
                return FileAccessDecision.denied("NOT_REVISION_AUTHOR",
                        "Only the assigned revision author can upload, replace, or synchronize the source file.",
                        permissionCode, action, FileObjectType.SOURCE_DOCX, objectId);
            }
        }

        // Download source DOCX: only allowed in Draft, or if user has DCO/admin override
        if (action == FileAccessAction.DOWNLOAD) {
            if (!"DRAFT".equalsIgnoreCase(status)) {
                // Allow DCO / document admin to download at any status
                boolean hasCrossDocumentVisibility = canViewAllDocuments(user);
                if (!hasCrossDocumentVisibility) {
                    return FileAccessDecision.denied("INVALID_REVISION_STATUS",
                            "Source document download is only available for Draft revisions.",
                            permissionCode, action, FileObjectType.SOURCE_DOCX, objectId);
                }
            }
        }

        return null;
    }

    /** Review Snapshot: available during workflow review and, after rejection, to show the
     * Author the immutable copy that was annotated before the source is edited again. */
    private FileAccessDecision evaluateReviewSnapshotRules(
            UserAccount user,
            FileAccessAction action,
            UUID objectId,
            FileAccessContext context,
            String permissionCode
    ) {
        if (action != FileAccessAction.VIEW_PREVIEW && action != FileAccessAction.DOWNLOAD) return null;
        String status = context.workflowState();
        boolean rejectedDraftSnapshot = "DRAFT".equalsIgnoreCase(status)
                && context.getBool("hasRejectedReviewSnapshot", false);
        boolean validStatus = rejectedDraftSnapshot
                || "PENDING_REVIEW".equalsIgnoreCase(status)
                || "PENDING_APPROVAL".equalsIgnoreCase(status)
                || "PENDING_TRAINING".equalsIgnoreCase(status)
                || "READY_FOR_PUBLISHING".equalsIgnoreCase(status);
        if (!validStatus) {
            return FileAccessDecision.denied("INVALID_REVISION_STATUS",
                    "Review snapshot is only available during review stages or after a rejection.",
                    permissionCode, action, FileObjectType.REVIEW_SNAPSHOT, objectId);
        }
        // Strict visibility: in-flight snapshot content is restricted to the revision's
        // author, assigned participants, and DCO/document admins.
        if (strictVisibility || lifecyclePolicyEnabled) {
            UUID revisionId = context.getUUID("revisionId");
            UUID authorId = context.getUUID("authorId");
            boolean hasCrossDocumentVisibility = canViewAllDocuments(user);
            boolean allowed;
            if (hasCrossDocumentVisibility) {
                allowed = true;
            } else if (lifecyclePolicyEnabled) {
                // Data-driven decision (seeded to parity with the hardcoded strict rule).
                allowed = lifecycleStatePolicyEvaluator.canPerform(user, LifecycleCapability.PREVIEW,
                        status, null, revisionId, authorId);
            } else {
                boolean isAuthor = user.getId() != null && Objects.equals(authorId, user.getId());
                boolean isParticipant = revisionId != null && user.getId() != null
                        && revisionWorkflowParticipantRepository.countByRevision_IdAndUser_Id(revisionId, user.getId()) > 0;
                allowed = isAuthor || isParticipant;
            }
            if (!allowed) {
                return FileAccessDecision.denied("NOT_ASSIGNED_PARTICIPANT",
                        "Only the revision author, assigned workflow participants, or a DCO/Document Admin can access in-review content.",
                        permissionCode, action, FileObjectType.REVIEW_SNAPSHOT, objectId);
            }
        }
        return null;
    }

    /** Published PDF: allowed for EFFECTIVE / OBSOLETED. */
    private FileAccessDecision evaluatePublishedPdfRules(
            FileAccessAction action,
            UUID objectId,
            FileAccessContext context,
            String permissionCode
    ) {
        if (action != FileAccessAction.VIEW_PREVIEW && action != FileAccessAction.DOWNLOAD
                && action != FileAccessAction.VIEW_ONLINE) return null;
        String status = context.workflowState();
        boolean validStatus = "EFFECTIVE".equalsIgnoreCase(status) || "OBSOLETED".equalsIgnoreCase(status);
        if (!validStatus) {
            return FileAccessDecision.denied("INVALID_REVISION_STATUS",
                    "Published PDF is only available for effective or obsoleted revisions.",
                    permissionCode, action, FileObjectType.PUBLISHED_PDF, objectId);
        }
        return null;
    }

    /** Controlled Copy: status and policy rules for token-based and authenticated access. */
    private FileAccessDecision evaluateControlledCopyRules(
            FileAccessAction action,
            UUID objectId,
            FileAccessContext context,
            String permissionCode
    ) {
        boolean isActive = context.getBool("isActive", true);
        if (!isActive) {
            // Copy is recalled, destroyed, or expired — 410 territory
            // We throw a different exception from the controller layer;
            // here return a denied decision with specific reason.
            return FileAccessDecision.denied("CONTROLLED_COPY_NOT_AVAILABLE",
                    "This controlled copy is no longer available.",
                    permissionCode, action, FileObjectType.CONTROLLED_COPY, objectId);
        }

        // Download must respect policy
        if (action == FileAccessAction.DOWNLOAD) {
            boolean policyAllowsDownload = context.getBool("policyAllowsDownload", false);
            if (!policyAllowsDownload) {
                return FileAccessDecision.denied("DOWNLOAD_NOT_PERMITTED",
                        "Download of this controlled copy is not permitted by policy.",
                        permissionCode, action, FileObjectType.CONTROLLED_COPY, objectId);
            }
        }

        // View must respect portal view policy
        if (action == FileAccessAction.VIEW_PREVIEW || action == FileAccessAction.VIEW_ONLINE) {
            boolean policyAllowsPortalView = context.getBool("policyAllowsPortalView", true);
            if (!policyAllowsPortalView) {
                return FileAccessDecision.denied("PORTAL_VIEW_NOT_PERMITTED",
                        "Portal viewing of this controlled copy is not permitted by policy.",
                        permissionCode, action, FileObjectType.CONTROLLED_COPY, objectId);
            }
        }

        return null;
    }

    /** Evidence: no additional business rules beyond permission check. */
    private FileAccessDecision evaluateEvidenceRules(
            FileAccessAction action,
            UUID objectId,
            FileAccessContext context,
            String permissionCode
    ) {
        // Permission check is sufficient; no additional status rules needed for evidence.
        return null;
    }

    // ── Assignment helpers ────────────────────────────────────────────────────

    boolean isAssignedCoAuthor(UserAccount user, UUID revisionId) {
        if (user == null || user.getId() == null || revisionId == null) return false;
        return revisionWorkflowParticipantRepository
                .findByRevision_IdAndParticipantTypeAndUser_Id(revisionId, "CO_AUTHOR", user.getId())
                .isPresent();
    }

    // ── Audit helpers ─────────────────────────────────────────────────────────

    private boolean isHighRisk(FileAccessAction action) {
        return switch (action) {
            case DOWNLOAD, DOWNLOAD_EVIDENCE, EDIT_ONLINE, SYNC_TO_OFFICE, SYNC_FROM_OFFICE,
                    GENERATE_SHAREPOINT_LINK, GENERATE_PUBLISHED_PDF,
                    GENERATE_PRESIGNED_URL, UPLOAD_EVIDENCE -> true;
            default -> false;
        };
    }

    private void logDeniedAudit(
            UserAccount user,
            FileAccessAction action,
            FileObjectType objectType,
            UUID objectId,
            String reasonCode,
            String permissionCode
    ) {
        try {
            String comment = "File access denied. action=" + action
                    + " objectType=" + objectType
                    + " reason=" + reasonCode
                    + (permissionCode != null ? " permission=" + permissionCode : "");
            auditTrailService.logAs(
                    user,
                    objectType == null ? "FILE" : objectType.name(),
                    null,
                    objectId,
                    "FILE_ACCESS_DENIED",
                    null, null,
                    comment
            );
        } catch (Exception ex) {
            log.warn("[SECURITY] Failed to log denied file access audit event: {}", ex.getMessage());
        }
    }
}
