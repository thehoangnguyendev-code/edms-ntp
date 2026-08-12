package com.eqms.service;

import com.eqms.dto.security.RevisionWorkflowAuthorizationContext;
import com.eqms.dto.security.WorkflowAuthorizationDecision;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.UserAccount;
import com.eqms.entity.WorkflowParticipant;
import com.eqms.enums.RevisionWorkflowAction;
import com.eqms.exception.WorkflowAuthorizationDeniedException;
import com.eqms.repository.WorkflowParticipantRepository;
import com.eqms.service.authorization.AuthorizationEngineService;
import com.eqms.service.authorization.AuthorizationRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;

import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

/**
 * Runtime authorization for Revision workflow actions.
 *
 * <p>REVISION completed its hybrid-engine cutover (SECURITY_AUTHORIZATION_HYBRID_REFACTOR_PLAN.md
 * §7 cutover rule 5) on real UI/API traffic with zero decision mismatches over an observation
 * window spanning multiple actors and the full revision lifecycle (submit/review/approve/reject/
 * publish/cancel/upgrade/training). {@link AuthorizationEngineService} (via
 * {@code RevisionResourceAdapter}) is now the sole decision authority for the top-level
 * allow/deny call -- the previous {@code checkInternal}/{@code evaluatePolicy} legacy decision
 * tree and the legacy/new shadow comparison it existed to support have been removed, not just
 * switched off.
 *
 * <p>This class is NOT a pure legacy shell, though: {@code RevisionResourceAdapter} reuses several
 * methods below directly (package-visible) as its facts for the engine's relation/precondition
 * steps, rather than re-implementing the same Author/Co-Author/sequence-aware Reviewer/Approver
 * logic a second time. Removing this file entirely was not an option -- only the methods that were
 * exclusively part of the old standalone decision tree are gone. See each method's Javadoc for
 * which caller keeps it alive.
 *
 * <p>Fail-closed by design: if the engine throws (infra failure, bug), this denies with a clear
 * reason rather than falling back to a second decision path -- a GMP system must not silently grant
 * or infer access when it cannot positively verify it.
 */
@Service
public class RevisionWorkflowAuthorizationService {

    private static final Logger log = LoggerFactory.getLogger(RevisionWorkflowAuthorizationService.class);

    private final AuditTrailService auditTrailService;
    private final WorkflowParticipantRepository workflowParticipantRepository;
    private final AuthorizationEngineService authorizationEngineService;

    public RevisionWorkflowAuthorizationService(
            AuditTrailService auditTrailService,
            WorkflowParticipantRepository workflowParticipantRepository,
            // @Lazy breaks the circular dependency: AuthorizationEngineService resolves REVISION
            // requests via RevisionResourceAdapter, which itself calls this class's package-visible
            // assignment helpers (isRevisionAuthor etc.) -- same pattern used for DOCUMENT.
            @Lazy AuthorizationEngineService authorizationEngineService
    ) {
        this.auditTrailService = auditTrailService;
        this.workflowParticipantRepository = workflowParticipantRepository;
        this.authorizationEngineService = authorizationEngineService;
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * {@code context} is accepted for call-site/signature stability (14 call sites across
     * RevisionService all build it via {@code RevisionWorkflowAuthorizationContext.of(revision)})
     * but is no longer read here directly -- {@code RevisionResourceAdapter#checkPrecondition}
     * reconstructs the same context internally from the same revision entity when the engine
     * evaluates state preconditions, so there is nothing left for this method to do with it.
     */
    public WorkflowAuthorizationDecision check(
            UserAccount user,
            DocumentRevisionRecord revision,
            RevisionWorkflowAction action,
            RevisionWorkflowAuthorizationContext context
    ) {
        UUID revisionId = revision == null ? null : revision.getId();
        String currentStatus = revision == null || revision.getStatus() == null
                ? null : revision.getStatus().getCode();
        if (user == null || user.getId() == null || revision == null || revisionId == null || action == null) {
            return WorkflowAuthorizationDecision.denied(
                    "WORKFLOW_ACTION_NOT_ALLOWED", "The requested workflow action is not allowed for this revision.",
                    null, action, revisionId, currentStatus);
        }
        try {
            var policyDecision = authorizationEngineService.authorize(
                    AuthorizationRequest.of(user, "REVISION", revisionId, action.name()));
            return toWorkflowDecision(policyDecision, action, revision);
        } catch (Exception e) {
            log.error("Authorization engine failed for revision {} action {}: {}",
                    revisionId, action, e.getMessage(), e);
            return WorkflowAuthorizationDecision.denied(
                    "AUTHORIZATION_ENGINE_ERROR", "Unable to verify authorization for this action right now. Please try again.",
                    null, action, revisionId, currentStatus);
        }
    }

    private WorkflowAuthorizationDecision toWorkflowDecision(
            com.eqms.service.authorization.AuthorizationDecision policyDecision,
            RevisionWorkflowAction action, DocumentRevisionRecord revision
    ) {
        UUID revisionId = revision.getId();
        String currentStatus = revision.getStatus() == null ? null : revision.getStatus().getCode();
        if (policyDecision.allowed()) {
            return WorkflowAuthorizationDecision.allowed(action, revisionId, currentStatus, false, false);
        }
        return WorkflowAuthorizationDecision.denied(
                policyDecision.reasonCode(),
                "You are not allowed to perform this workflow action.",
                policyDecision.requiredPermission(), action, revisionId, currentStatus);
    }

    public void require(
            UserAccount user,
            DocumentRevisionRecord revision,
            RevisionWorkflowAction action,
            RevisionWorkflowAuthorizationContext context
    ) {
        WorkflowAuthorizationDecision decision = check(user, revision, action, context);
        if (!decision.allowed()) {
            logDeniedAudit(user, revision, action, decision.reasonCode(), decision.permissionCode());
            throw new WorkflowAuthorizationDeniedException(
                    decision.reasonCode(),
                    decision.message() != null
                            ? decision.message()
                            : "You are not allowed to perform this workflow action.",
                    decision.permissionCode(),
                    action,
                    decision.revisionId(),
                    decision.currentStatus()
            );
        }
    }

    // ── State invariant validation (hard-coded, GMP) ─────────────────────────
    // Still the single source of truth for state preconditions -- reused by
    // RevisionResourceAdapter#checkPrecondition (called by AuthorizationEngineService as one of
    // its evaluation steps), not re-implemented a second time there.

    private WorkflowAuthorizationDecision validateWorkflowState(
            RevisionWorkflowAction action,
            DocumentRevisionRecord revision,
            RevisionWorkflowAuthorizationContext context,
            UUID revisionId,
            String currentStatus
    ) {
        if (revision == null) return WorkflowAuthorizationDecision.denied(
                "REVISION_NOT_FOUND", "Revision not found.",
                null, action, revisionId, currentStatus);

        boolean isDraft              = "DRAFT".equalsIgnoreCase(currentStatus);
        boolean isPendingReview      = "PENDING_REVIEW".equalsIgnoreCase(currentStatus);
        boolean isPendingApproval    = "PENDING_APPROVAL".equalsIgnoreCase(currentStatus);
        boolean isPendingTraining    = "PENDING_TRAINING".equalsIgnoreCase(currentStatus);
        boolean isReadyForPublishing = "READY_FOR_PUBLISHING".equalsIgnoreCase(currentStatus);
        boolean isEffective          = "EFFECTIVE".equalsIgnoreCase(currentStatus);

        String editingStatus = context == null ? null : context.getString("editingStatus");
        boolean sourceLocked = context != null && context.getBool("sourceLocked", false);

        return switch (action) {
            case COMPLETE_AUTHORING -> {
                if (!isDraft) yield stateError(action, revisionId, currentStatus, "DRAFT");
                if ("COMPLETED".equalsIgnoreCase(editingStatus)) yield WorkflowAuthorizationDecision.denied(
                        "EDITING_ALREADY_COMPLETED", "Revision editing is already completed.",
                        null, action, revisionId, currentStatus);
                if (sourceLocked) yield WorkflowAuthorizationDecision.denied(
                        "SOURCE_ALREADY_LOCKED", "The revision source is already locked.",
                        null, action, revisionId, currentStatus);
                yield null;
            }
            case OPEN_PUBLISHING_WORKSPACE -> {
                if (!isReadyForPublishing) yield stateError(action, revisionId, currentStatus, "READY_FOR_PUBLISHING");
                yield null;
            }
            case SUBMIT_FOR_REVIEW -> {
                if (!isDraft) yield stateError(action, revisionId, currentStatus, "DRAFT");
                if (!"COMPLETED".equalsIgnoreCase(editingStatus) || !sourceLocked)
                    yield WorkflowAuthorizationDecision.denied("EDITING_NOT_COMPLETED",
                            "Revision editing must be completed and source locked before submitting for review.",
                            null, action, revisionId, currentStatus);
                yield null;
            }
            case GENERATE_REVIEW_SNAPSHOT -> {
                if (!isDraft) yield stateError(action, revisionId, currentStatus, "DRAFT");
                yield null;
            }
            case REGENERATE_SNAPSHOT -> {
                // Regenerating re-renders whichever PDF matches the current stage — the review
                // snapshot pre-publish (Draft) or the published PDF post-publish (Effective /
                // Obsoleted) — so it must be allowed at all three, not just Draft.
                boolean isObsoleted = "OBSOLETED".equalsIgnoreCase(currentStatus);
                if (!isDraft && !isEffective && !isObsoleted) {
                    yield WorkflowAuthorizationDecision.denied("INVALID_WORKFLOW_STATE",
                            "Regenerating the PDF is only available while the revision is in Draft, Effective, or Obsoleted status. Current status: " + currentStatus,
                            null, action, revisionId, currentStatus);
                }
                yield null;
            }
            case COMPLETE_REVIEW, REJECT_REVIEW -> {
                if (!isPendingReview) yield stateError(action, revisionId, currentStatus, "PENDING_REVIEW");
                yield null;
            }
            case COMPLETE_APPROVAL, REJECT_APPROVAL -> {
                if (!isPendingApproval) yield stateError(action, revisionId, currentStatus, "PENDING_APPROVAL");
                yield null;
            }
            case COMPLETE_TRAINING -> {
                if (!isPendingTraining) yield stateError(action, revisionId, currentStatus, "PENDING_TRAINING");
                yield null;
            }
            case PUBLISH -> {
                if (!isReadyForPublishing) yield stateError(action, revisionId, currentStatus, "READY_FOR_PUBLISHING");
                yield null;
            }
            case CANCEL -> {
                if (!isDraft) yield stateError(action, revisionId, currentStatus, "DRAFT");
                yield null;
            }
            case UPGRADE_REVISION -> {
                if (!isEffective) yield stateError(action, revisionId, currentStatus, "EFFECTIVE");
                yield null;
            }
            case OBSOLETE -> {
                if (!isEffective) yield stateError(action, revisionId, currentStatus, "EFFECTIVE");
                yield null;
            }
            case UPDATE_DRAFT_METADATA, UPLOAD_SOURCE -> {
                if (!isDraft) yield stateError(action, revisionId, currentStatus, "DRAFT");
                yield null;
            }
        };
    }

    private WorkflowAuthorizationDecision stateError(
            RevisionWorkflowAction action, UUID revisionId, String currentStatus, String expectedStatus
    ) {
        return WorkflowAuthorizationDecision.denied(
                "INVALID_WORKFLOW_STATE",
                "This action requires revision status '" + expectedStatus + "'. Current status: " + currentStatus,
                null, action, revisionId, currentStatus);
    }

    // ── Assignment helpers ────────────────────────────────────────────────────
    // Package-visible: RevisionResourceAdapter#resolveMatchedRelations calls these four directly
    // as the engine's AUTHOR/CO_AUTHOR/ASSIGNED_REVIEWER/ASSIGNED_APPROVER relation facts.

    boolean isRevisionAuthor(UserAccount user, DocumentRevisionRecord revision) {
        if (user == null || user.getId() == null || revision == null) return false;
        UUID authorId = revision.getAuthor() == null ? null : revision.getAuthor().getId();
        return Objects.equals(authorId, user.getId());
    }

    boolean isRevisionCoAuthor(UserAccount user, DocumentRevisionRecord revision) {
        if (user == null || user.getId() == null || revision == null || revision.getId() == null) return false;
        return workflowParticipantRepository
                .findByObjectTypeAndObjectIdAndParticipantTypeAndUser_Id(
                        "DOCUMENT_REVISION", revision.getId(), "CO_AUTHOR", user.getId())
                .isPresent();
    }

    /** F-06: PENDING alone is not enough — the user must also be the next one the configured
     * sequence allows to act, mirroring RevisionService.requirePendingParticipant's mutation-time
     * gate. Without this, a Reviewer #2 saw "Complete Review" enabled by the capability API and
     * only found out sequence blocked them after submitting. */
    boolean isPendingReviewer(UserAccount user, DocumentRevisionRecord revision) {
        if (user == null || user.getId() == null || revision == null || revision.getId() == null) return false;
        return isNextPendingInSequence(revision.getId(), "REVIEWER", user.getId());
    }

    boolean isPendingApprover(UserAccount user, DocumentRevisionRecord revision) {
        if (user == null || user.getId() == null || revision == null || revision.getId() == null) return false;
        return isNextPendingInSequence(revision.getId(), "APPROVER", user.getId());
    }

    private boolean isNextPendingInSequence(UUID revisionId, String participantType, UUID userId) {
        WorkflowParticipant next = nextPendingInSequence(revisionId, participantType);
        return next != null && next.getUser() != null && userId.equals(next.getUser().getId());
    }

    /** First PENDING participant of this type ordered by sequence_order — the one the
     * configured sequence currently allows to act, or null if none are pending. */
    private WorkflowParticipant nextPendingInSequence(UUID revisionId, String participantType) {
        return workflowParticipantRepository
                .findAllByObjectTypeAndObjectIdAndParticipantTypeOrderBySequenceOrderAsc(
                        "DOCUMENT_REVISION", revisionId, participantType)
                .stream()
                .filter(p -> "PENDING".equalsIgnoreCase(p.getActionStatus()))
                .findFirst()
                .orElse(null);
    }

    /**
     * Generic (objectType, objectId) participant lookup against {@code workflow_participants}.
     * Package-visible for authorization parity tests and reuse by supported workflow modules.
     */
    boolean isPendingGenericParticipant(String objectType, UUID objectId, String participantType, UUID userId) {
        if (objectType == null || objectId == null || participantType == null || userId == null) return false;
        return workflowParticipantRepository
                .findByObjectTypeAndObjectIdAndParticipantTypeAndUser_Id(objectType, objectId, participantType, userId)
                .map(p -> "PENDING".equalsIgnoreCase(p.getActionStatus()))
                .orElse(false);
    }

    /**
     * Reuses the exact same state/attribute invariant logic evaluated by {@link
     * #validateWorkflowState} -- called by {@link RevisionResourceAdapter#checkPrecondition} so the
     * hybrid engine denies for the same state reasons (e.g. EDITING_NOT_COMPLETED) that used to come
     * from this class's own top-level decision, without re-implementing state validation a second
     * time in the adapter.
     */
    Optional<String> checkStatePrecondition(
            DocumentRevisionRecord revision, RevisionWorkflowAction action, RevisionWorkflowAuthorizationContext context
    ) {
        if (revision == null || action == null) return Optional.empty();
        String currentStatus = revision.getStatus() == null ? null : revision.getStatus().getCode();
        WorkflowAuthorizationDecision result =
                validateWorkflowState(action, revision, context, revision.getId(), currentStatus);
        return result == null ? Optional.empty() : Optional.of(result.reasonCode());
    }

    // ── Audit helpers ─────────────────────────────────────────────────────────

    private void logDeniedAudit(
            UserAccount user, DocumentRevisionRecord revision,
            RevisionWorkflowAction action, String reasonCode, String permissionCode
    ) {
        try {
            String entityName = revision == null ? null
                    : (revision.getRevisionNumber() + " - " + revision.getDocumentName());
            UUID entityId = revision == null ? null : revision.getId();
            String currentStatus = revision == null || revision.getStatus() == null
                    ? null : revision.getStatus().getCode();
            String comment = "Workflow action denied. action=" + action
                    + " reason=" + reasonCode
                    + (permissionCode != null ? " permission=" + permissionCode : "");
            auditTrailService.logAs(user, "REVISION", entityName, entityId,
                    "WORKFLOW_ACCESS_DENIED", currentStatus, currentStatus, comment);
        } catch (Exception ex) {
            log.warn("[SECURITY] Failed to log denied workflow action audit: {}", ex.getMessage());
        }
    }
}
