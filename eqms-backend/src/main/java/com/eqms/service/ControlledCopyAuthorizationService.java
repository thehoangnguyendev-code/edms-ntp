package com.eqms.service;

import com.eqms.dto.security.ControlledCopyActionCapabilitiesResponse;
import com.eqms.dto.security.ControlledCopyActionCapabilityDecisionResponse;
import com.eqms.dto.security.ControlledCopyAuthorizationContext;
import com.eqms.dto.security.ControlledCopyAuthorizationDecision;
import com.eqms.entity.ControlledCopyDistributionBatch;
import com.eqms.entity.ControlledCopyPolicySetting;
import com.eqms.entity.ControlledCopyRecord;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.UserAccount;
import com.eqms.entity.WorkflowActionPolicy;
import com.eqms.entity.WorkflowActionPolicyActor;
import com.eqms.enums.ControlledCopyWorkflowAction;
import com.eqms.enums.FileAccessAction;
import com.eqms.enums.FileObjectType;
import com.eqms.enums.WorkflowActorType;
import com.eqms.exception.ControlledCopyAuthorizationException;
import com.eqms.exception.ControlledCopyNotAvailableException;
import com.eqms.auth.CurrentUserService;
import org.springframework.beans.factory.annotation.Autowired;
import com.eqms.repository.AccessProfileWorkflowRoleRepository;
import com.eqms.repository.ControlledCopyDistributionBatchRepository;
import com.eqms.repository.ControlledCopyRepository;
import com.eqms.repository.DocumentRecordRepository;
import com.eqms.repository.DocumentWorkflowPoolMemberRepository;
import com.eqms.repository.UserAccessProfileRepository;
import com.eqms.repository.WorkflowActionPolicyRepository;
import com.eqms.service.authorization.AuthorizationEngineService;
import com.eqms.service.authorization.AuthorizationRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Lazy;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@Service
public class ControlledCopyAuthorizationService {

    private static final Logger log = LoggerFactory.getLogger(ControlledCopyAuthorizationService.class);

    private static final String MODULE_KEY = "DOCUMENT_CONTROL";
    private static final String WORKFLOW_KEY = "CONTROLLED_COPY";
    private static final String OBJECT_COPY = "CONTROLLED_COPY";
    private static final String OBJECT_BATCH = "CONTROLLED_COPY_BATCH";

    private final PermissionEvaluationService permissionEvaluationService;
    private final CurrentUserService currentUserService;
    private final DocumentAuthorizationService documentAuthorizationService;
    private final ControlledCopyPolicyService controlledCopyPolicyService;
    private final SecureFileAccessService secureFileAccessService;
    private final ControlledCopyRepository controlledCopyRepository;
    private final ControlledCopyDistributionBatchRepository controlledCopyDistributionBatchRepository;
    private final WorkflowActionPolicyRepository workflowActionPolicyRepository;
    private final UserAccessProfileRepository userAccessProfileRepository;
    private final AccessProfileWorkflowRoleRepository accessProfileWorkflowRoleRepository;
    private final DocumentWorkflowPoolMemberRepository documentWorkflowPoolMemberRepository;
    private final DocumentRecordRepository documentRecordRepository;
    private final ObjectAccessEvaluationService objectAccessEvaluationService;
    private final PasswordEncoder passwordEncoder;
    private final AuthorizationEngineService authorizationEngineService;

    @Autowired
    public ControlledCopyAuthorizationService(
            PermissionEvaluationService permissionEvaluationService,
            CurrentUserService currentUserService,
            DocumentAuthorizationService documentAuthorizationService,
            ControlledCopyPolicyService controlledCopyPolicyService,
            SecureFileAccessService secureFileAccessService,
            ControlledCopyRepository controlledCopyRepository,
            ControlledCopyDistributionBatchRepository controlledCopyDistributionBatchRepository,
            WorkflowActionPolicyRepository workflowActionPolicyRepository,
            UserAccessProfileRepository userAccessProfileRepository,
            AccessProfileWorkflowRoleRepository accessProfileWorkflowRoleRepository,
            DocumentWorkflowPoolMemberRepository documentWorkflowPoolMemberRepository,
            DocumentRecordRepository documentRecordRepository,
            ObjectAccessEvaluationService objectAccessEvaluationService,
            PasswordEncoder passwordEncoder,
            // @Lazy breaks the circular dependency: AuthorizationEngineService resolves
            // CONTROLLED_COPY(_BATCH) requests via ControlledCopyResourceAdapter /
            // ControlledCopyBatchResourceAdapter, which call this class's package-visible
            // helpers directly -- same pattern as RevisionWorkflowAuthorizationService.
            @Lazy AuthorizationEngineService authorizationEngineService
    ) {
        this.permissionEvaluationService = permissionEvaluationService;
        this.currentUserService = currentUserService;
        this.documentAuthorizationService = documentAuthorizationService;
        this.controlledCopyPolicyService = controlledCopyPolicyService;
        this.secureFileAccessService = secureFileAccessService;
        this.controlledCopyRepository = controlledCopyRepository;
        this.controlledCopyDistributionBatchRepository = controlledCopyDistributionBatchRepository;
        this.workflowActionPolicyRepository = workflowActionPolicyRepository;
        this.userAccessProfileRepository = userAccessProfileRepository;
        this.accessProfileWorkflowRoleRepository = accessProfileWorkflowRoleRepository;
        this.documentWorkflowPoolMemberRepository = documentWorkflowPoolMemberRepository;
        this.documentRecordRepository = documentRecordRepository;
        this.objectAccessEvaluationService = objectAccessEvaluationService;
        this.passwordEncoder = passwordEncoder;
        this.authorizationEngineService = authorizationEngineService;
    }

    /** Compatibility constructor for isolated legacy unit tests. Spring uses
     * the full constructor and therefore always applies object scope. */
    @Deprecated(forRemoval = false)
    public ControlledCopyAuthorizationService(
            PermissionEvaluationService permissionEvaluationService,
            CurrentUserService currentUserService,
            DocumentAuthorizationService documentAuthorizationService,
            ControlledCopyPolicyService controlledCopyPolicyService,
            SecureFileAccessService secureFileAccessService,
            ControlledCopyRepository controlledCopyRepository,
            ControlledCopyDistributionBatchRepository controlledCopyDistributionBatchRepository,
            WorkflowActionPolicyRepository workflowActionPolicyRepository,
            UserAccessProfileRepository userAccessProfileRepository,
            AccessProfileWorkflowRoleRepository accessProfileWorkflowRoleRepository,
            DocumentWorkflowPoolMemberRepository documentWorkflowPoolMemberRepository,
            DocumentRecordRepository documentRecordRepository
    ) {
        this(permissionEvaluationService, currentUserService, documentAuthorizationService,
                controlledCopyPolicyService, secureFileAccessService, controlledCopyRepository,
                controlledCopyDistributionBatchRepository, workflowActionPolicyRepository,
                userAccessProfileRepository, accessProfileWorkflowRoleRepository,
                documentWorkflowPoolMemberRepository, documentRecordRepository, null, null, null);
    }

    /** Compatibility constructor retained for existing isolated policy tests. */
    @Deprecated(forRemoval = false)
    public ControlledCopyAuthorizationService(
            PermissionEvaluationService permissionEvaluationService,
            CurrentUserService currentUserService,
            DocumentAuthorizationService documentAuthorizationService,
            ControlledCopyPolicyService controlledCopyPolicyService,
            SecureFileAccessService secureFileAccessService,
            ControlledCopyRepository controlledCopyRepository,
            ControlledCopyDistributionBatchRepository controlledCopyDistributionBatchRepository,
            WorkflowActionPolicyRepository workflowActionPolicyRepository,
            UserAccessProfileRepository userAccessProfileRepository,
            AccessProfileWorkflowRoleRepository accessProfileWorkflowRoleRepository,
            DocumentWorkflowPoolMemberRepository documentWorkflowPoolMemberRepository,
            DocumentRecordRepository documentRecordRepository,
            ObjectAccessEvaluationService objectAccessEvaluationService
    ) {
        this(permissionEvaluationService, currentUserService, documentAuthorizationService,
                controlledCopyPolicyService, secureFileAccessService, controlledCopyRepository,
                controlledCopyDistributionBatchRepository, workflowActionPolicyRepository,
                userAccessProfileRepository, accessProfileWorkflowRoleRepository,
                documentWorkflowPoolMemberRepository, documentRecordRepository,
                objectAccessEvaluationService, null, null);
    }

    /**
     * REQUEST_COPY has no resourceId at evaluation time (the copy doesn't exist yet), so it
     * structurally cannot be evaluated through {@link AuthorizationEngineService}'s
     * resourceId-keyed adapter model -- {@link #evaluateInternal} remains the sole decision path
     * for that one action (SECURITY_AUTHORIZATION_HYBRID_REFACTOR_PLAN.md Phase 3 cutover rule 5
     * note; explicit user decision to keep this narrow exception rather than defer the whole
     * module's cutover). Every other action has a real resourceId and has already been running
     * shadow-eval-verified with zero mismatches, so it goes through the engine only, fail-closed
     * on any error -- same pattern as Document/Revision.
     */
    public ControlledCopyAuthorizationDecision evaluate(
            UserAccount user,
            ControlledCopyWorkflowAction action,
            ControlledCopyAuthorizationContext context
    ) {
        if (action == ControlledCopyWorkflowAction.REQUEST_COPY) {
            return evaluateInternal(user, action, context);
        }

        String resourceType = context != null && context.batchAction() ? OBJECT_BATCH : OBJECT_COPY;
        UUID resourceId = context == null ? null : (context.batchAction() ? context.batchId() : context.controlledCopyId());
        String currentStatus = resolveCurrentStatus(action, context);
        if (user == null || user.getId() == null || resourceId == null) {
            return ControlledCopyAuthorizationDecision.denied(
                    action, resourceType, currentStatus, "WORKFLOW_ACTION_NOT_ALLOWED",
                    "The requested controlled copy action is not allowed.", null);
        }
        try {
            var policyDecision = authorizationEngineService.authorize(
                    AuthorizationRequest.of(user, resourceType, resourceId, action.name()));
            return toControlledCopyDecision(policyDecision, action, context, resourceType);
        } catch (Exception e) {
            log.error("Authorization engine failed for {} {} action {}: {}",
                    resourceType, resourceId, action, e.getMessage(), e);
            return ControlledCopyAuthorizationDecision.denied(
                    action, resourceType, currentStatus, "AUTHORIZATION_ENGINE_ERROR",
                    "Unable to verify authorization for this action right now. Please try again.", null);
        }
    }

    private ControlledCopyAuthorizationDecision toControlledCopyDecision(
            com.eqms.service.authorization.AuthorizationDecision policyDecision,
            ControlledCopyWorkflowAction action, ControlledCopyAuthorizationContext context, String resourceType
    ) {
        String currentStatus = resolveCurrentStatus(action, context);
        if (policyDecision.allowed()) {
            return ControlledCopyAuthorizationDecision.allowed(
                    action, resourceType, currentStatus, policyDecision.requiredPermission());
        }
        return ControlledCopyAuthorizationDecision.denied(
                action, resourceType, currentStatus, policyDecision.reasonCode(),
                "You are not authorized to perform this controlled copy action.", policyDecision.requiredPermission());
    }

    private ControlledCopyAuthorizationDecision evaluateInternal(
            UserAccount user,
            ControlledCopyWorkflowAction action,
            ControlledCopyAuthorizationContext context
    ) {
        String objectType = context != null && context.batchAction() ? OBJECT_BATCH : OBJECT_COPY;
        String currentStatus = resolveCurrentStatus(action, context);
        String requiredPermissionCode = resolveRequiredPermissionCode(action);

        if (user == null) {
            return ControlledCopyAuthorizationDecision.denied(
                    action, objectType, currentStatus, "AUTH_REQUIRED", "Authentication required.", requiredPermissionCode);
        }
        if (user.getStatus() != null && user.getStatus().name().equalsIgnoreCase("Inactive")) {
            return ControlledCopyAuthorizationDecision.denied(
                    action, objectType, currentStatus, "USER_INACTIVE", "Current user is inactive.", requiredPermissionCode);
        }

        // Controlled copies inherit the source document's object scope.  This
        // guard is independent of permission and is intentionally not bypassed
        // for SYSTEM_SUPER_ADMIN.
        // Reporting a lost/damaged copy is an explicitly entitled controlled-copy
        // operation. A user with the canonical action permission must be able
        // to report a distributed copy even when the source document's
        // department/object-scope rules do not include the DCO's profile.
        // Otherwise the capability endpoint hides Submit while the user is
        // correctly entitled to the controlled-copy operation.
        boolean reportLostDamagedPermission = action == ControlledCopyWorkflowAction.REPORT_LOST_DAMAGED
                && permissionEvaluationService.hasPermission(user, requiredPermissionCode);
        if (!hasDocumentScope(user, context) && !reportLostDamagedPermission) {
            return ControlledCopyAuthorizationDecision.denied(
                    action, objectType, currentStatus, "OUT_OF_SCOPE",
                    "You are outside the permitted scope for this controlled copy.", requiredPermissionCode);
        }

        ControlledCopyPolicySetting policy = controlledCopyPolicyService.loadOrDefault();

        ControlledCopyAuthorizationDecision invariantFailure = validateInvariants(user, action, context, policy, objectType, currentStatus);
        if (invariantFailure != null) {
            return invariantFailure;
        }

        WorkflowActionPolicy policyRow = resolvePolicy(action, objectType, currentStatus);
        if (policyRow == null) {
            return ControlledCopyAuthorizationDecision.denied(
                    action, objectType, currentStatus, "WORKFLOW_POLICY_NOT_FOUND", "Controlled copy workflow policy is not configured.", requiredPermissionCode);
        }

        if (!StringUtils.hasText(policyRow.getRequiredPermissionCode())) {
            return ControlledCopyAuthorizationDecision.denied(
                    action, objectType, currentStatus, "WORKFLOW_POLICY_MISCONFIGURED", "Workflow policy is missing a required permission code.", requiredPermissionCode);
        }

        // GMP Segregation of Duties: SYSTEM_SUPER_ADMIN is not exempt from controlled copy
        // actions — it must hold the required permission like any other user (see
        // V243__seed_system_super_admin_permission_set.sql).
        if (!permissionEvaluationService.hasPermission(user, policyRow.getRequiredPermissionCode())) {
            return ControlledCopyAuthorizationDecision.denied(
                    action, objectType, currentStatus, "MISSING_PERMISSION", "You do not have permission to perform this controlled copy action.", policyRow.getRequiredPermissionCode());
        }

        // Distribution is a module-level operational entitlement: any active user
        // with the canonical distribute permission may distribute any Ready copy or
        // batch in their permitted document scope. It is not record-participant work.
        if (!isGlobalDistributionAction(action) && !matchesAnyActor(user, context, policyRow)) {
            return ControlledCopyAuthorizationDecision.denied(
                    action, objectType, currentStatus, "ACTOR_NOT_ALLOWED", "You are not authorized to perform this controlled copy action.", policyRow.getRequiredPermissionCode());
        }

        return ControlledCopyAuthorizationDecision.allowed(action, objectType, currentStatus, policyRow.getRequiredPermissionCode());
    }

    private boolean isGlobalDistributionAction(ControlledCopyWorkflowAction action) {
        return action == ControlledCopyWorkflowAction.DISTRIBUTE_COPY
                || action == ControlledCopyWorkflowAction.DISTRIBUTE_BATCH;
    }

    private boolean hasDocumentScope(UserAccount user, ControlledCopyAuthorizationContext context) {
        if (objectAccessEvaluationService == null || context == null || context.documentId() == null) {
            return true;
        }
        return documentRecordRepository.findById(context.documentId())
                .map(document -> objectAccessEvaluationService.canAccessDocument(user, document, "VIEW"))
                .orElse(false);
    }

    public void require(UserAccount user, ControlledCopyWorkflowAction action, ControlledCopyAuthorizationContext context) {
        ControlledCopyAuthorizationDecision decision = evaluate(user, action, context);
        if (!decision.allowed()) {
            throw new ControlledCopyAuthorizationException(
                    decision.reasonCode(),
                    decision.message(),
                    decision.requiredPermissionCode(),
                    action
            );
        }
    }

    /** Shared-platform adapter entrypoint for Security Admin diagnosis. */
    @Transactional(readOnly = true)
    public ControlledCopyAuthorizationDecision diagnoseCopyAction(
            UserAccount subject, UUID copyId, ControlledCopyWorkflowAction action
    ) {
        ControlledCopyRecord copy = controlledCopyRepository.findById(copyId)
                .orElseThrow(() -> new IllegalArgumentException("Controlled copy not found"));
        return evaluate(subject, action, buildCopyContext(copy));
    }

    /** Shared-platform adapter entrypoint for batch lifecycle diagnosis. */
    @Transactional(readOnly = true)
    public ControlledCopyAuthorizationDecision diagnoseBatchAction(
            UserAccount subject, UUID batchId, ControlledCopyWorkflowAction action
    ) {
        ControlledCopyDistributionBatch batch = controlledCopyDistributionBatchRepository.findById(batchId)
                .orElseThrow(() -> new IllegalArgumentException("Controlled copy distribution batch not found"));
        return evaluate(subject, action, buildBatchContext(batch));
    }

    @Transactional(readOnly = true)
    public ControlledCopyActionCapabilitiesResponse getCopyCapabilities(UUID controlledCopyId) {
        UserAccount user = requireCurrentUser();
        ControlledCopyRecord copy = controlledCopyRepository.findById(controlledCopyId)
                .orElseThrow(() -> new IllegalArgumentException("Controlled copy not found"));
        requireBaseAccess(user, copy);
        ControlledCopyAuthorizationContext context = buildCopyContext(copy);
        Map<String, ControlledCopyActionCapabilityDecisionResponse> actions = new LinkedHashMap<>();
        actions.put("previewFile", toCapability(user, ControlledCopyWorkflowAction.PREVIEW_FILE, context));
        actions.put("downloadFile", toCapability(user, ControlledCopyWorkflowAction.DOWNLOAD_FILE, context));
        actions.put("printCopy", toCapability(user, ControlledCopyWorkflowAction.PRINT_COPY, context));
        actions.put("distributeCopy", toCapability(user, ControlledCopyWorkflowAction.DISTRIBUTE_COPY, context));
        actions.put("recallCopy", toCapability(user, ControlledCopyWorkflowAction.RECALL_COPY, context));
        actions.put("reportLostDamaged", toCapability(user, ControlledCopyWorkflowAction.REPORT_LOST_DAMAGED, context));
        actions.put("replaceLostDamaged", toCapability(user, ControlledCopyWorkflowAction.REPLACE_LOST_DAMAGED, context));
        actions.put("uploadEvidence", toCapability(user, ControlledCopyWorkflowAction.UPLOAD_EVIDENCE, context));
        actions.put("expireCopy", toCapability(user, ControlledCopyWorkflowAction.EXPIRE_COPY, context));
        actions.put("cancelRequest", toCapability(user, ControlledCopyWorkflowAction.CANCEL_REQUEST, context));

        String previewObjectType = resolvePreviewObjectType(copy);
        String previewVersionToken = firstNonBlank(
                copy.getUpdatedAt() == null ? null : copy.getUpdatedAt().toString(),
                copy.getAccessTokenIssuedAt() == null ? null : copy.getAccessTokenIssuedAt().toString(),
                copy.getCreatedAt() == null ? null : copy.getCreatedAt().toString()
        );
        String previewStatus = StringUtils.hasText(previewObjectType) ? "READY" : "MISSING";
        return new ControlledCopyActionCapabilitiesResponse(
                copy.getId(),
                copy.getDistributionBatch() == null ? null : copy.getDistributionBatch().getId(),
                copy.getRevision() == null ? null : copy.getRevision().getId(),
                copy.getDocument() == null ? null : copy.getDocument().getId(),
                normalizeStatus(copy.getStatusCode()),
                copy.getDistributionBatch() == null ? null : normalizeStatus(copy.getDistributionBatch().getStatusCode()),
                previewObjectType,
                previewStatus,
                previewVersionToken,
                Instant.now().toString(),
                actions
        );
    }

    @Transactional(readOnly = true)
    public ControlledCopyActionCapabilitiesResponse getBatchCapabilities(UUID batchId) {
        UserAccount user = requireCurrentUser();
        ControlledCopyDistributionBatch batch = controlledCopyDistributionBatchRepository.findById(batchId)
                .orElseThrow(() -> new IllegalArgumentException("Controlled copy distribution batch not found"));
        requireBaseAccess(user, batch);
        ControlledCopyAuthorizationContext context = buildBatchContext(batch);
        Map<String, ControlledCopyActionCapabilityDecisionResponse> actions = new LinkedHashMap<>();
        actions.put("distributeBatch", toCapability(user, ControlledCopyWorkflowAction.DISTRIBUTE_BATCH, context));
        actions.put("recallBatch", toCapability(user, ControlledCopyWorkflowAction.RECALL_BATCH, context));
        actions.put("cancelBatch", toCapability(user, ControlledCopyWorkflowAction.CANCEL_REQUEST, context));

        String previewVersionToken = firstNonBlank(
                batch.getUpdatedAt() == null ? null : batch.getUpdatedAt().toString(),
                batch.getRequestedAt() == null ? null : batch.getRequestedAt().toString(),
                batch.getCreatedAt() == null ? null : batch.getCreatedAt().toString()
        );
        return new ControlledCopyActionCapabilitiesResponse(
                null,
                batch.getId(),
                batch.getRevision() == null ? null : batch.getRevision().getId(),
                batch.getDocument() == null ? null : batch.getDocument().getId(),
                null,
                normalizeStatus(batch.getStatusCode()),
                null,
                "N/A",
                previewVersionToken,
                Instant.now().toString(),
                actions
        );
    }

    public ControlledCopyAuthorizationDecision requireRequestControlledCopy(
            UserAccount user,
            DocumentRecord document,
            DocumentRevisionRecord revision
    ) {
        ControlledCopyAuthorizationContext context = ControlledCopyAuthorizationContext.forRequest(
                document == null ? null : document.getId(),
                revision == null ? null : revision.getId(),
                document == null || document.getStatus() == null ? null : normalizeStatus(document.getStatus().getCode()),
                revision == null || revision.getStatus() == null ? null : normalizeStatus(revision.getStatus().getCode()),
                null
        );
        ControlledCopyAuthorizationDecision decision = evaluate(user, ControlledCopyWorkflowAction.REQUEST_COPY, context);
        if (!decision.allowed()) {
            throw new ControlledCopyAuthorizationException(
                    decision.reasonCode(),
                    decision.message(),
                    decision.requiredPermissionCode(),
                    ControlledCopyWorkflowAction.REQUEST_COPY
            );
        }
        return decision;
    }

    public void requirePreviewAccess(UserAccount user, ControlledCopyRecord copy, String token) {
        ControlledCopyAuthorizationContext context = buildCopyContext(copy);
        requireStatusAllowedForPreview(copy);
        if (!StringUtils.hasText(token) || !token.equals(copy.getAccessToken())) {
            throw new AccessDeniedException("Controlled copy access denied");
        }
        requireBaseAccess(user, copy);
        secureFileAccessService.require(
                user,
                FileAccessAction.VIEW_PREVIEW,
                FileObjectType.CONTROLLED_COPY,
                copy.getId(),
                com.eqms.dto.security.FileAccessContext.ofControlledCopy(
                        copy,
                        controlledCopyPolicyService.loadOrDefault().isAllowDownload(),
                        controlledCopyPolicyService.loadOrDefault().isAllowPortalView()
                )
        );
        require(user, ControlledCopyWorkflowAction.PREVIEW_FILE, context);
    }

    public void requireDownloadAccess(UserAccount user, ControlledCopyRecord copy, String token) {
        ControlledCopyAuthorizationContext context = buildCopyContext(copy);
        requireStatusAllowedForDownload(copy);
        if (!StringUtils.hasText(token) || !token.equals(copy.getAccessToken())) {
            throw new AccessDeniedException("Controlled copy access denied");
        }
        secureFileAccessService.require(
                user,
                FileAccessAction.DOWNLOAD,
                FileObjectType.CONTROLLED_COPY,
                copy.getId(),
                com.eqms.dto.security.FileAccessContext.ofControlledCopy(
                        copy,
                        controlledCopyPolicyService.loadOrDefault().isAllowDownload(),
                        controlledCopyPolicyService.loadOrDefault().isAllowPortalView()
                )
        );
        require(user, ControlledCopyWorkflowAction.DOWNLOAD_FILE, context);
    }

    /** Uses the same evaluator as the action-capability response and the print mutation. */
    public void requirePrintControlledCopy(UserAccount user, ControlledCopyRecord copy) {
        require(user, ControlledCopyWorkflowAction.PRINT_COPY, buildCopyContext(copy));
    }

    /**
     * Anonymous, token-only access for the public "controlled copy preview" link sent by email
     * (per spec: recipients open a PDF preview via the link — they do not need an EQMS login or
     * permission set). Possession of the copy's unique access token is the entire trust boundary
     * here; no user-permission/workflow-policy check applies.
     */
    public void requireTokenPreviewAccess(ControlledCopyRecord copy, String token, String password) {
        requireStatusAllowedForPreview(copy);
        if (!StringUtils.hasText(token) || !token.equals(copy.getAccessToken())) {
            throw new AccessDeniedException("Controlled copy access denied");
        }
        requireTokenNotExpired(copy);
        requirePreviewPassword(copy, password);
        if (!controlledCopyPolicyService.loadOrDefault().isAllowPortalView()) {
            throw new AccessDeniedException("Portal view is disabled by the Controlled Copies Policy.");
        }
    }

    public void requireTokenDownloadAccess(ControlledCopyRecord copy, String token, String password) {
        requireStatusAllowedForDownload(copy);
        if (!StringUtils.hasText(token) || !token.equals(copy.getAccessToken())) {
            throw new AccessDeniedException("Controlled copy access denied");
        }
        requireTokenNotExpired(copy);
        requirePreviewPassword(copy, password);
        ControlledCopyPolicySetting policy = controlledCopyPolicyService.loadOrDefault();
        if (!policy.isAllowDownload()) {
            throw new AccessDeniedException("Download is disabled by the Controlled Copies Policy.");
        }
    }

    /**
     * Enforces the snapshot expiry for authenticated preview endpoints as well as
     * token-only endpoints.  Without this check, an already-issued link could
     * continue to fetch pages/file/print after the expiry timestamp until the
     * scheduled obsolescence job ran.
     */
    public void requireNotExpired(ControlledCopyRecord copy) {
        requireTokenNotExpired(copy);
    }

    /**
     * Second factor for the emailed preview link — a random password issued alongside the
     * access token. Copies issued before this feature (no password stored) skip the check for
     * backward compatibility; every newly-distributed copy always has one.
     */
    private void requirePreviewPassword(ControlledCopyRecord copy, String password) {
        String expectedHash = copy.getPreviewPasswordHash();
        if (!StringUtils.hasText(expectedHash)) {
            throw new AccessDeniedException("This controlled-copy link has expired. Request a new distribution notification.");
        }
        if (passwordEncoder == null || !StringUtils.hasText(password) || !passwordEncoder.matches(password.trim(), expectedHash)) {
            throw new AccessDeniedException("Incorrect preview password");
        }
    }

    private void requireTokenNotExpired(ControlledCopyRecord copy) {
        if (copy.getExpiryDate() != null && Instant.now().isAfter(effectiveExpiryInstant(copy.getExpiryDate()))) {
            throw new ControlledCopyNotAvailableException(copy.getId(), "EXPIRED", "EXPIRED");
        }
    }

    /**
     * Controlled-copy expiry is configured as a calendar date in the UI. Older rows and
     * integrations persisted that date at local midnight, which otherwise made the copy
     * expire at the very start of the selected day. Preserve explicit timestamps, but treat
     * local-midnight values as the end of that calendar day.
     */
    private Instant effectiveExpiryInstant(Instant expiry) {
        ZoneId zone = ZoneId.systemDefault();
        ZonedDateTime local = expiry.atZone(zone);
        ZonedDateTime utc = expiry.atZone(ZoneId.of("UTC"));
        if (local.toLocalTime().equals(java.time.LocalTime.MIDNIGHT)) {
            return LocalDate.from(local).plusDays(1).atStartOfDay(zone).toInstant().minusNanos(1);
        }
        if (utc.toLocalTime().equals(java.time.LocalTime.MIDNIGHT)) {
            return LocalDate.from(utc).plusDays(1).atStartOfDay(ZoneId.of("UTC")).toInstant().minusNanos(1);
        }
        return expiry;
    }

    public void requireEvidenceReadAccess(UserAccount user, ControlledCopyRecord copy, FileAccessAction accessAction) {
        secureFileAccessService.require(
                user,
                accessAction,
                FileObjectType.CONTROLLED_COPY_EVIDENCE,
                copy.getId()
        );
    }

    public void requireDistributeControlledCopy(UserAccount user, ControlledCopyRecord copy) {
        require(user, ControlledCopyWorkflowAction.DISTRIBUTE_COPY, buildCopyContext(copy));
    }

    public void requireDistributeControlledCopy(UserAccount user, ControlledCopyDistributionBatch batch) {
        require(user, ControlledCopyWorkflowAction.DISTRIBUTE_BATCH, buildBatchContext(batch));
    }

    public void requireReportLostDamaged(UserAccount user, ControlledCopyRecord copy) {
        require(user, ControlledCopyWorkflowAction.REPORT_LOST_DAMAGED, buildCopyContext(copy));
    }

    public void requireRecallControlledCopy(UserAccount user, ControlledCopyRecord copy) {
        require(user, ControlledCopyWorkflowAction.RECALL_COPY, buildCopyContext(copy));
    }

    public void requireRecallControlledCopy(UserAccount user, ControlledCopyDistributionBatch batch) {
        require(user, ControlledCopyWorkflowAction.RECALL_BATCH, buildBatchContext(batch));
    }

    public void requireCancelControlledCopy(UserAccount user, ControlledCopyRecord copy) {
        require(user, ControlledCopyWorkflowAction.CANCEL_REQUEST, buildCopyContext(copy));
    }

    public void requireCancelControlledCopy(UserAccount user, ControlledCopyDistributionBatch batch) {
        require(user, ControlledCopyWorkflowAction.CANCEL_REQUEST, buildBatchContext(batch));
    }

    public void requireUploadEvidence(UserAccount user, ControlledCopyRecord copy) {
        require(user, ControlledCopyWorkflowAction.UPLOAD_EVIDENCE, buildCopyContext(copy));
    }

    public void requireReplaceLostDamaged(UserAccount user, ControlledCopyRecord copy) {
        require(user, ControlledCopyWorkflowAction.REPLACE_LOST_DAMAGED, buildCopyContext(copy));
    }

    public void requireExpireControlledCopy(UserAccount user, ControlledCopyRecord copy) {
        require(user, ControlledCopyWorkflowAction.EXPIRE_COPY, buildCopyContext(copy));
    }

    private ControlledCopyActionCapabilityDecisionResponse toCapability(
            UserAccount user,
            ControlledCopyWorkflowAction action,
            ControlledCopyAuthorizationContext context
    ) {
        ControlledCopyAuthorizationDecision decision = evaluate(user, action, context);
        if (decision.allowed()) {
            return ControlledCopyActionCapabilityDecisionResponse.allow(
                    action.name(),
                    decision.objectType(),
                    decision.status(),
                    decision.requiredPermissionCode()
            );
        }
        return ControlledCopyActionCapabilityDecisionResponse.deny(
                decision.reasonCode(),
                decision.message(),
                decision.requiredPermissionCode(),
                action.name(),
                decision.objectType(),
                decision.status()
        );
    }

    /**
     * Package-visible reuse point for {@link ControlledCopyResourceAdapter} /
     * {@link ControlledCopyBatchResourceAdapter}: mirrors the exact same state/attribute
     * invariants {@link #evaluateInternal} enforces (none of the individual validate*Invariants
     * branches actually read {@code user}, so this is safe to call with a null actor).
     */
    java.util.Optional<String> checkInvariantPrecondition(
            ControlledCopyWorkflowAction action, ControlledCopyAuthorizationContext context, String objectType
    ) {
        ControlledCopyPolicySetting policy = controlledCopyPolicyService.loadOrDefault();
        String currentStatus = resolveCurrentStatus(action, context);
        ControlledCopyAuthorizationDecision decision =
                validateInvariants(null, action, context, policy, objectType, currentStatus);
        return decision == null ? java.util.Optional.empty() : java.util.Optional.of(decision.reasonCode());
    }

    ControlledCopyAuthorizationDecision validateInvariants(
            UserAccount user,
            ControlledCopyWorkflowAction action,
            ControlledCopyAuthorizationContext context,
            ControlledCopyPolicySetting policy,
            String objectType,
            String currentStatus
    ) {
        return switch (action) {
            case REQUEST_COPY -> validateRequestInvariants(user, context, objectType, currentStatus);
            case DISTRIBUTE_BATCH, DISTRIBUTE_COPY -> validateDistributeInvariants(context, objectType, currentStatus);
            case VIEW_COPY, PREVIEW_FILE -> validatePreviewInvariants(user, context, policy, objectType, currentStatus);
            case DOWNLOAD_FILE -> validateDownloadInvariants(user, context, policy, objectType, currentStatus);
            case PRINT_COPY -> validatePrintInvariants(context, policy, objectType, currentStatus);
            case RECALL_BATCH, RECALL_COPY -> validateRecallInvariants(context, policy, objectType, currentStatus);
            case REPORT_LOST_DAMAGED -> validateLostDamagedInvariants(context, policy, objectType, currentStatus);
            case REPLACE_LOST_DAMAGED -> validateReplacementInvariants(context, policy, objectType, currentStatus);
            case UPLOAD_EVIDENCE -> validateUploadEvidenceInvariants(context, objectType, currentStatus);
            case EXPIRE_COPY -> validateExpireInvariants(context, objectType, currentStatus);
            case CANCEL_REQUEST -> validateCancelInvariants(context, objectType, currentStatus);
        };
    }

    private ControlledCopyAuthorizationDecision validateRequestInvariants(
            UserAccount user,
            ControlledCopyAuthorizationContext context,
            String objectType,
            String currentStatus
    ) {
        if (context == null || !StringUtils.hasText(context.documentStatus()) || !StringUtils.hasText(context.revisionStatus())) {
            return ControlledCopyAuthorizationDecision.denied(
                    ControlledCopyWorkflowAction.REQUEST_COPY, objectType, currentStatus,
                    "WORKFLOW_POLICY_MISCONFIGURED", "Controlled copy request context is incomplete.", resolveRequiredPermissionCode(ControlledCopyWorkflowAction.REQUEST_COPY));
        }
        if (!"ACTIVE".equalsIgnoreCase(normalizeStatus(context.documentStatus()))) {
            return ControlledCopyAuthorizationDecision.denied(
                    ControlledCopyWorkflowAction.REQUEST_COPY, objectType, currentStatus,
                    "DOCUMENT_NOT_ACTIVE", "Controlled copy can only be requested from an active document.", resolveRequiredPermissionCode(ControlledCopyWorkflowAction.REQUEST_COPY));
        }
        if (!"EFFECTIVE".equalsIgnoreCase(normalizeStatus(context.revisionStatus()))) {
            return ControlledCopyAuthorizationDecision.denied(
                    ControlledCopyWorkflowAction.REQUEST_COPY, objectType, currentStatus,
                    "REVISION_NOT_EFFECTIVE", "Controlled copy can only be requested from an effective revision.", resolveRequiredPermissionCode(ControlledCopyWorkflowAction.REQUEST_COPY));
        }
        return null;
    }

    private ControlledCopyAuthorizationDecision validateDistributeInvariants(
            ControlledCopyAuthorizationContext context,
            String objectType,
            String currentStatus
    ) {
        if (!isReadyForDistribution(context)) {
            return ControlledCopyAuthorizationDecision.denied(
                    ControlledCopyWorkflowAction.DISTRIBUTE_BATCH, objectType, currentStatus,
                    "INVALID_CONTROLLED_COPY_STATE", "Controlled copy distribution is only allowed while the batch or copy is ready for distribution.", resolveRequiredPermissionCode(ControlledCopyWorkflowAction.DISTRIBUTE_BATCH));
        }
        return null;
    }

    private ControlledCopyAuthorizationDecision validatePreviewInvariants(
            UserAccount user,
            ControlledCopyAuthorizationContext context,
            ControlledCopyPolicySetting policy,
            String objectType,
            String currentStatus
    ) {
        if (context == null || !context.portalViewAllowed()) {
            return ControlledCopyAuthorizationDecision.denied(
                    ControlledCopyWorkflowAction.PREVIEW_FILE, objectType, currentStatus,
                    "DOWNLOAD_NOT_ALLOWED_BY_POLICY", "Portal view is disabled for this controlled copy.", resolveRequiredPermissionCode(ControlledCopyWorkflowAction.PREVIEW_FILE));
        }
        if (!isViewable(context)) {
            return ControlledCopyAuthorizationDecision.denied(
                    ControlledCopyWorkflowAction.PREVIEW_FILE, objectType, currentStatus,
                    "INVALID_CONTROLLED_COPY_STATE", "Controlled copy preview is not available for the current status.", resolveRequiredPermissionCode(ControlledCopyWorkflowAction.PREVIEW_FILE));
        }
        if (context.expiryAt() != null && Instant.now().isAfter(context.expiryAt())) {
            return ControlledCopyAuthorizationDecision.denied(
                    ControlledCopyWorkflowAction.PREVIEW_FILE, objectType, currentStatus,
                    "EXPIRED", "This controlled copy has expired.", resolveRequiredPermissionCode(ControlledCopyWorkflowAction.PREVIEW_FILE));
        }
        return null;
    }

    private ControlledCopyAuthorizationDecision validateDownloadInvariants(
            UserAccount user,
            ControlledCopyAuthorizationContext context,
            ControlledCopyPolicySetting policy,
            String objectType,
            String currentStatus
    ) {
        if (context == null || !context.downloadAllowed()) {
            return ControlledCopyAuthorizationDecision.denied(
                    ControlledCopyWorkflowAction.DOWNLOAD_FILE, objectType, currentStatus,
                    "DOWNLOAD_NOT_ALLOWED_BY_POLICY", "Download is not allowed for this controlled copy.", resolveRequiredPermissionCode(ControlledCopyWorkflowAction.DOWNLOAD_FILE));
        }
        if (!isViewable(context)) {
            return ControlledCopyAuthorizationDecision.denied(
                    ControlledCopyWorkflowAction.DOWNLOAD_FILE, objectType, currentStatus,
                    "INVALID_CONTROLLED_COPY_STATE", "Controlled copy download is not available for the current status.", resolveRequiredPermissionCode(ControlledCopyWorkflowAction.DOWNLOAD_FILE));
        }
        if (context.expiryAt() != null && Instant.now().isAfter(context.expiryAt())) {
            return ControlledCopyAuthorizationDecision.denied(
                    ControlledCopyWorkflowAction.DOWNLOAD_FILE, objectType, currentStatus,
                    "EXPIRED", "This controlled copy has expired.", resolveRequiredPermissionCode(ControlledCopyWorkflowAction.DOWNLOAD_FILE));
        }
        return null;
    }

    private ControlledCopyAuthorizationDecision validatePrintInvariants(
            ControlledCopyAuthorizationContext context,
            ControlledCopyPolicySetting policy,
            String objectType,
            String currentStatus
    ) {
        if (policy == null || !policy.isAllowPrint()) {
            return ControlledCopyAuthorizationDecision.denied(
                    ControlledCopyWorkflowAction.PRINT_COPY, objectType, currentStatus,
                    "PRINT_NOT_ALLOWED_BY_POLICY", "Printing is disabled by the Controlled Copies Policy.",
                    resolveRequiredPermissionCode(ControlledCopyWorkflowAction.PRINT_COPY));
        }
        if (!isViewable(context)) {
            return ControlledCopyAuthorizationDecision.denied(
                    ControlledCopyWorkflowAction.PRINT_COPY, objectType, currentStatus,
                    "INVALID_CONTROLLED_COPY_STATE", "Controlled copy printing is not available for the current status.",
                    resolveRequiredPermissionCode(ControlledCopyWorkflowAction.PRINT_COPY));
        }
        if (context != null && context.expiryAt() != null && Instant.now().isAfter(context.expiryAt())) {
            return ControlledCopyAuthorizationDecision.denied(
                    ControlledCopyWorkflowAction.PRINT_COPY, objectType, currentStatus,
                    "EXPIRED", "This controlled copy has expired.",
                    resolveRequiredPermissionCode(ControlledCopyWorkflowAction.PRINT_COPY));
        }
        return null;
    }

    private ControlledCopyAuthorizationDecision validateRecallInvariants(
            ControlledCopyAuthorizationContext context,
            ControlledCopyPolicySetting policy,
            String objectType,
            String currentStatus
    ) {
        if (policy != null && !policy.isAllowManualRecall()) {
            return ControlledCopyAuthorizationDecision.denied(
                    ControlledCopyWorkflowAction.RECALL_COPY, objectType, currentStatus,
                    "MANUAL_RECALL_DISABLED_BY_POLICY", "Manual recall is disabled by the Controlled Copies Policy.", resolveRequiredPermissionCode(ControlledCopyWorkflowAction.RECALL_COPY));
        }
        if (!isRecallable(context)) {
            return ControlledCopyAuthorizationDecision.denied(
                    ControlledCopyWorkflowAction.RECALL_COPY, objectType, currentStatus,
                    "INVALID_CONTROLLED_COPY_STATE", "Controlled copy recall is only allowed while the copy or batch is Distributed or Obsoleted.", resolveRequiredPermissionCode(ControlledCopyWorkflowAction.RECALL_COPY));
        }
        return null;
    }

    private ControlledCopyAuthorizationDecision validateLostDamagedInvariants(
            ControlledCopyAuthorizationContext context,
            ControlledCopyPolicySetting policy,
            String objectType,
            String currentStatus
    ) {
        if (policy != null && !policy.isAllowReportLostDamaged()) {
            return ControlledCopyAuthorizationDecision.denied(
                    ControlledCopyWorkflowAction.REPORT_LOST_DAMAGED, objectType, currentStatus,
                    "REPORT_LOST_DAMAGED_DISABLED_BY_POLICY", "Reporting lost or damaged copies is disabled by the Controlled Copies Policy.", resolveRequiredPermissionCode(ControlledCopyWorkflowAction.REPORT_LOST_DAMAGED));
        }
        if (!isDistributed(context)) {
            return ControlledCopyAuthorizationDecision.denied(
                    ControlledCopyWorkflowAction.REPORT_LOST_DAMAGED, objectType, currentStatus,
                    "INVALID_CONTROLLED_COPY_STATE", "Lost/Damaged can only be reported after distribution.", resolveRequiredPermissionCode(ControlledCopyWorkflowAction.REPORT_LOST_DAMAGED));
        }
        return null;
    }

    private ControlledCopyAuthorizationDecision validateReplacementInvariants(
            ControlledCopyAuthorizationContext context,
            ControlledCopyPolicySetting policy,
            String objectType,
            String currentStatus
    ) {
        if (policy != null && !policy.isAllowReplacementForLostDamaged()) {
            return ControlledCopyAuthorizationDecision.denied(
                    ControlledCopyWorkflowAction.REPLACE_LOST_DAMAGED, objectType, currentStatus,
                    "REPLACEMENT_DISABLED_BY_POLICY", "Replacement for lost/damaged copies is disabled by the Controlled Copies Policy.", resolveRequiredPermissionCode(ControlledCopyWorkflowAction.REPLACE_LOST_DAMAGED));
        }
        if (!isObsoleted(context)) {
            return ControlledCopyAuthorizationDecision.denied(
                    ControlledCopyWorkflowAction.REPLACE_LOST_DAMAGED, objectType, currentStatus,
                    "INVALID_CONTROLLED_COPY_STATE", "Replacement is only allowed for lost or damaged controlled copies.", resolveRequiredPermissionCode(ControlledCopyWorkflowAction.REPLACE_LOST_DAMAGED));
        }
        if (!isLostOrDamaged(context == null ? null : context.obsoleteReason())) {
            return ControlledCopyAuthorizationDecision.denied(
                    ControlledCopyWorkflowAction.REPLACE_LOST_DAMAGED, objectType, currentStatus,
                    "INVALID_REPLACEMENT_SOURCE",
                    "Replacement is only allowed after the controlled copy was reported as Lost or Damaged.",
                    resolveRequiredPermissionCode(ControlledCopyWorkflowAction.REPLACE_LOST_DAMAGED));
        }
        return null;
    }

    private ControlledCopyAuthorizationDecision validateUploadEvidenceInvariants(
            ControlledCopyAuthorizationContext context,
            String objectType,
            String currentStatus
    ) {
        if (!isObsoleted(context)) {
            return ControlledCopyAuthorizationDecision.denied(
                    ControlledCopyWorkflowAction.UPLOAD_EVIDENCE, objectType, currentStatus,
                    "INVALID_CONTROLLED_COPY_STATE", "Evidence upload is only allowed for obsoleted controlled copies.", resolveRequiredPermissionCode(ControlledCopyWorkflowAction.UPLOAD_EVIDENCE));
        }
        return null;
    }

    private ControlledCopyAuthorizationDecision validateExpireInvariants(
            ControlledCopyAuthorizationContext context,
            String objectType,
            String currentStatus
    ) {
        if (!isDistributed(context) && !isReadyForDistribution(context)) {
            return ControlledCopyAuthorizationDecision.denied(
                    ControlledCopyWorkflowAction.EXPIRE_COPY, objectType, currentStatus,
                    "INVALID_CONTROLLED_COPY_STATE", "Controlled copy expiry is only applicable to ready or distributed copies.", resolveRequiredPermissionCode(ControlledCopyWorkflowAction.EXPIRE_COPY));
        }
        return null;
    }

    private ControlledCopyAuthorizationDecision validateCancelInvariants(
            ControlledCopyAuthorizationContext context,
            String objectType,
            String currentStatus
    ) {
        if (!isReadyForDistribution(context)) {
            return ControlledCopyAuthorizationDecision.denied(
                    ControlledCopyWorkflowAction.CANCEL_REQUEST, objectType, currentStatus,
                    "INVALID_CONTROLLED_COPY_STATE", "Controlled copy cancellation is only allowed before distribution.", resolveRequiredPermissionCode(ControlledCopyWorkflowAction.CANCEL_REQUEST));
        }
        return null;
    }

    private WorkflowActionPolicy resolvePolicy(
            ControlledCopyWorkflowAction action,
            String objectType,
            String fromStatus
    ) {
        String actionCode = action.name();
        List<WorkflowActionPolicy> policies = workflowActionPolicyRepository.findActiveGlobalPolicies(
                MODULE_KEY,
                WORKFLOW_KEY,
                objectType,
                actionCode,
                fromStatus
        );
        return policies.isEmpty() ? null : policies.get(0);
    }

    private boolean matchesAnyActor(UserAccount user, ControlledCopyAuthorizationContext context, WorkflowActionPolicy policy) {
        if (policy.getActors() == null || policy.getActors().isEmpty()) {
            return false;
        }
        for (WorkflowActionPolicyActor actor : policy.getActors()) {
            if (matchesActor(user, context, actor)) {
                return true;
            }
        }
        return false;
    }

    private boolean matchesActor(UserAccount user, ControlledCopyAuthorizationContext context, WorkflowActionPolicyActor actor) {
        if (user == null || user.getId() == null || actor == null || actor.getActorType() == null) {
            return false;
        }
        return switch (actor.getActorType()) {
            case ACCESS_PROFILE -> matchesAccessProfile(user, actor.getActorCode());
            case PERMISSION -> permissionEvaluationService.hasPermission(user, actor.getActorCode());
            case OWNER -> matchesRequesterOrRecipient(user, context);
            case RECIPIENT -> matchesDocumentViewer(user, context);
            default -> false;
        };
    }

    /**
     * Matches any user who is allowed to view the parent document (author, co-author,
     * reviewer, approver, an authorized workspace manager, or a general viewer under strict-visibility).
     * Used for controlled-copy read actions, and (since V233) also for REQUEST_COPY —
     * a viewer may self-service request exactly one copy for themselves; the "one copy,
     * for myself only" restriction is enforced in ControlledCopyService.requestControlledCopy,
     * not here. Users with the workspace-management permission remain the only actors who
     * can request a batch for other recipients or an external distribution.
     */
    boolean matchesDocumentViewer(UserAccount user, ControlledCopyAuthorizationContext context) {
        if (context == null || context.documentId() == null) {
            return false;
        }
        return documentRecordRepository.findById(context.documentId())
                .map(document -> documentAuthorizationService.canViewDocument(user, document))
                .orElse(false);
    }

    boolean matchesRequesterOrRecipient(UserAccount user, ControlledCopyAuthorizationContext context) {
        if (context == null || user == null || user.getId() == null) {
            return false;
        }
        if (context.recipientUserId() != null) {
            return Objects.equals(user.getId(), context.recipientUserId());
        }
        return Objects.equals(user.getId(), context.requesterUserId());
    }

    private boolean matchesAccessProfile(UserAccount user, String profileCode) {
        if (!StringUtils.hasText(profileCode)) {
            return false;
        }
        return userAccessProfileRepository.existsByUserIdAndProfileCode(user.getId(), profileCode);
    }

    private boolean matchesWorkflowRole(UserAccount user, String workflowRole) {
        if (!StringUtils.hasText(workflowRole)) {
            return false;
        }
        return userAccessProfileRepository.findByUserId(user.getId()).stream()
                .anyMatch(up -> accessProfileWorkflowRoleRepository.findByAccessProfileId(up.getAccessProfileId())
                        .stream()
                        .anyMatch(role -> workflowRole.equalsIgnoreCase(role.getWorkflowRole())));
    }

    private boolean matchesDocumentWorkflowPool(UserAccount user, String poolType) {
        if (!StringUtils.hasText(poolType)) {
            return false;
        }
        boolean legacyMatch = documentWorkflowPoolMemberRepository.findAllByPoolTypeAndActiveTrueOrderByCreatedAtAsc(poolType)
                .stream()
                .anyMatch(member -> member.getUser() != null && member.getUser().getId() != null && member.getUser().getId().equals(user.getId()));
        if (legacyMatch) {
            return true;
        }
        // New catalog path — see RevisionWorkflowAuthorizationService.matchesDocumentWorkflowPool
        // for the rationale (OR, not cutover, during the 0.5a migration window).
        return matchesWorkflowRole(user, com.eqms.config.WorkflowPoolMapping.toWorkflowRoleCode(poolType));
    }

    ControlledCopyAuthorizationContext buildCopyContext(ControlledCopyRecord copy) {
        ControlledCopyPolicySetting policy = controlledCopyPolicyService.loadOrDefault();
        return ControlledCopyAuthorizationContext.forCopy(
                copy == null ? null : copy.getId(),
                copy == null || copy.getDistributionBatch() == null ? null : copy.getDistributionBatch().getId(),
                copy == null || copy.getRevision() == null ? null : copy.getRevision().getId(),
                copy == null || copy.getDocument() == null ? null : copy.getDocument().getId(),
                copy == null || copy.getDocument() == null || copy.getDocument().getStatus() == null ? null : normalizeStatus(copy.getDocument().getStatus().getCode()),
                copy == null || copy.getRevision() == null || copy.getRevision().getStatus() == null ? null : normalizeStatus(copy.getRevision().getStatus().getCode()),
                copy == null ? null : normalizeStatus(copy.getStatusCode()),
                copy == null ? null : copy.getObsoleteReason(),
                copy == null ? null : (copy.getRequestedBy() == null ? null : copy.getRequestedBy().getId()),
                copy == null ? null : (copy.getRecipientUser() == null ? null : copy.getRecipientUser().getId()),
                copy == null || copy.getExpiryDate() == null ? null : effectiveExpiryInstant(copy.getExpiryDate()),
                policy.isAllowDownload(),
                policy.isAllowPortalView(),
                false
        );
    }

    ControlledCopyAuthorizationContext buildBatchContext(ControlledCopyDistributionBatch batch) {
        return ControlledCopyAuthorizationContext.forBatch(
                batch == null ? null : batch.getId(),
                batch == null || batch.getRevision() == null ? null : batch.getRevision().getId(),
                batch == null || batch.getDocument() == null ? null : batch.getDocument().getId(),
                batch == null ? null : normalizeStatus(batch.getStatusCode()),
                batch == null || batch.getRequestedBy() == null ? null : batch.getRequestedBy().getId(),
                batch == null || batch.getExpiryDate() == null ? null : effectiveExpiryInstant(batch.getExpiryDate())
        );
    }

    private void requireBaseAccess(UserAccount user, ControlledCopyRecord copy) {
        if (copy == null || copy.getRevision() == null || copy.getDocument() == null) {
            throw new IllegalArgumentException("Controlled copy not found");
        }
        documentAuthorizationService.requireCanAccessControlledCopy(user, copy.getDocument());
        documentAuthorizationService.requireCanAccessControlledCopy(user, copy.getRevision());
    }

    private void requireBaseAccess(UserAccount user, ControlledCopyDistributionBatch batch) {
        if (batch == null || batch.getRevision() == null || batch.getDocument() == null) {
            throw new IllegalArgumentException("Controlled copy distribution batch not found");
        }
        documentAuthorizationService.requireCanAccessControlledCopy(user, batch.getDocument());
        documentAuthorizationService.requireCanAccessControlledCopy(user, batch.getRevision());
    }

    private void requireStatusAllowedForPreview(ControlledCopyRecord copy) {
        if (copy == null) {
            throw new AccessDeniedException("Controlled copy access denied");
        }
        String ccStatus = normalizeStatus(copy.getStatusCode());
        if ("OBSOLETED".equalsIgnoreCase(ccStatus) || "CLOSED_CANCELLED".equalsIgnoreCase(ccStatus)) {
            throw new ControlledCopyNotAvailableException(copy.getId(), ccStatus, copy.getObsoleteReason());
        }
    }

    private void requireStatusAllowedForDownload(ControlledCopyRecord copy) {
        requireStatusAllowedForPreview(copy);
    }

    private UserAccount requireCurrentUser() {
        return currentUserService.requireCurrentUser();
    }

    private String resolvePreviewObjectType(ControlledCopyRecord copy) {
        if (copy == null) {
            return null;
        }
        String status = normalizeStatus(copy.getStatusCode());
        if ("READY_FOR_DISTRIBUTION".equalsIgnoreCase(status) || "DISTRIBUTED".equalsIgnoreCase(status)) {
            return FileObjectType.CONTROLLED_COPY.name();
        }
        if ("OBSOLETED".equalsIgnoreCase(status)) {
            return FileObjectType.CONTROLLED_COPY_EVIDENCE.name();
        }
        return null;
    }

    private boolean isReadyForDistribution(ControlledCopyAuthorizationContext context) {
        String status = normalizeCurrentStatus(context);
        return "READY_FOR_DISTRIBUTION".equalsIgnoreCase(status);
    }

    private boolean isDistributed(ControlledCopyAuthorizationContext context) {
        String status = normalizeCurrentStatus(context);
        return "DISTRIBUTED".equalsIgnoreCase(status);
    }

    private boolean isObsoleted(ControlledCopyAuthorizationContext context) {
        String status = normalizeCurrentStatus(context);
        return "OBSOLETED".equalsIgnoreCase(status) || "CLOSED_CANCELLED".equalsIgnoreCase(status);
    }

    private boolean isLostOrDamaged(String obsoleteReason) {
        // This is a reason, not a lifecycle state. normalizeStatus maps LOST and
        // DAMAGED to OBSOLETED for state evaluation, which previously made every
        // legitimately reported lost/damaged copy ineligible for reissue.
        String normalizedReason = StringUtils.hasText(obsoleteReason)
                ? obsoleteReason.trim().toUpperCase(Locale.ROOT)
                : "";
        return "LOST".equals(normalizedReason) || "DAMAGED".equals(normalizedReason);
    }

    private boolean isViewable(ControlledCopyAuthorizationContext context) {
        String status = normalizeCurrentStatus(context);
        return "READY_FOR_DISTRIBUTION".equalsIgnoreCase(status)
                || "DISTRIBUTED".equalsIgnoreCase(status);
    }

    private boolean isRecallable(ControlledCopyAuthorizationContext context) {
        String status = normalizeCurrentStatus(context);
        return "DISTRIBUTED".equalsIgnoreCase(status) || "OBSOLETED".equalsIgnoreCase(status);
    }

    String resolveCurrentStatus(ControlledCopyWorkflowAction action, ControlledCopyAuthorizationContext context) {
        if (context == null) {
            return null;
        }
        if (action == ControlledCopyWorkflowAction.REQUEST_COPY) {
            return normalizeStatus(context.revisionStatus());
        }
        return context.batchAction()
                ? normalizeStatus(context.batchStatus())
                : firstNonBlank(normalizeStatus(context.copyStatus()), normalizeStatus(context.requestStatus()));
    }

    private String normalizeCurrentStatus(ControlledCopyAuthorizationContext context) {
        return context == null ? null : (context.batchAction() ? normalizeStatus(context.batchStatus()) : normalizeStatus(context.copyStatus()));
    }

    private String normalizeStatus(String status) {
        if (!StringUtils.hasText(status)) {
            return null;
        }
        String normalized = status.trim().toUpperCase(Locale.ROOT).replace(' ', '_').replace('-', '_');
        return switch (normalized) {
            case "READY_FOR_DISTRIBUTION", "READY_FOR_DISTRIBUTE" -> "READY_FOR_DISTRIBUTION";
            case "DISTRIBUTED" -> "DISTRIBUTED";
            case "OBSOLETE", "OBSOLETED", "RECALLED", "LOST", "DAMAGED", "DESTROYED" -> "OBSOLETED";
            case "CLOSED_CANCELLED", "CANCELLED", "CLOSED" -> "CLOSED_CANCELLED";
            case "ACTIVE", "DRAFT", "PENDING_REVIEW", "PENDING_APPROVAL", "PENDING_TRAINING", "READY_FOR_PUBLISHING", "EFFECTIVE" -> normalized;
            default -> normalized;
        };
    }

    private String resolveRequiredPermissionCode(ControlledCopyWorkflowAction action) {
        return switch (action) {
            case REQUEST_COPY -> "documents.controlled_copy.request";
            case DISTRIBUTE_BATCH, DISTRIBUTE_COPY -> "documents.controlled_copy.distribute";
            case VIEW_COPY -> "documents.controlled_copy.view";
            case PREVIEW_FILE -> "documents.controlled_copy.view_file";
            case DOWNLOAD_FILE -> "documents.controlled_copy.download_file";
            case PRINT_COPY -> "documents.controlled_copy.print";
            case RECALL_BATCH, RECALL_COPY -> "documents.controlled_copy.recall";
            case REPORT_LOST_DAMAGED -> "documents.controlled_copy.report_lost_damaged";
            case REPLACE_LOST_DAMAGED -> "documents.controlled_copy.replace_lost_damaged";
            case UPLOAD_EVIDENCE -> "documents.controlled_copy.upload_evidence";
            case EXPIRE_COPY -> "documents.controlled_copy.expire";
            case CANCEL_REQUEST -> "documents.controlled_copy.cancel_request";
        };
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (StringUtils.hasText(value)) {
                return value;
            }
        }
        return null;
    }
}
