package com.eqms.service;

import com.eqms.dto.security.*;
import com.eqms.dto.security.WorkflowActionPolicyPreviewResponse.PolicyChange;
import com.eqms.dto.security.WorkflowActionPolicyPreviewResponse.PolicyWarning;
import com.eqms.dto.security.WorkflowActionPolicyPreviewResponse.WouldAffect;
import com.eqms.entity.*;
import com.eqms.config.WorkflowPoolTypes;
import com.eqms.enums.RevisionWorkflowAction;
import com.eqms.enums.WorkflowActorType;
import com.eqms.exception.WorkflowPolicyException;
import com.eqms.repository.DocumentTypeRepository;
import com.eqms.repository.PermissionRepository;
import com.eqms.repository.RoleDefinitionRepository;
import com.eqms.repository.AuthorizationRelationDefinitionRepository;
import com.eqms.repository.WorkflowActionPolicyRelationRepository;
import com.eqms.repository.WorkflowActionPolicyRepository;
import com.eqms.repository.WorkflowRoleRepository;
import com.eqms.service.WorkflowActionDefaultPolicyRegistry.DefaultActorEntry;
import com.eqms.service.WorkflowActionDefaultPolicyRegistry.DefaultPolicy;
import com.eqms.service.workflow.WorkflowDefinition;
import com.eqms.service.workflow.WorkflowRegistryService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Sprint 4/5 — manages WorkflowActionPolicy CRUD and runtime policy resolution.
 */
@Service
@Transactional(readOnly = true)
public class WorkflowActionPolicyService {

    private static final Logger log = LoggerFactory.getLogger(WorkflowActionPolicyService.class);

    static final String MODULE   = "DOCUMENT_CONTROL";
    static final String WORKFLOW = "DOCUMENT_REVISION";
    static final String OBJ_TYPE = "REVISION";

    /** Actions that must always have at least one active policy (deactivation safety). */
    private static final Set<String> CRITICAL_ACTIONS = Set.of(
            "COMPLETE_AUTHORING", "SUBMIT_FOR_REVIEW",
            "COMPLETE_REVIEW", "REJECT_REVIEW",
            "COMPLETE_APPROVAL", "REJECT_APPROVAL",
            "PUBLISH"
    );

    // ── Allowed actor types per Revision action ────────────────────────────────

    // ── Allowed actor types per Controlled Copy action ─────────────────────────

    private final WorkflowActionPolicyRepository policyRepo;
    private final AuditTrailService auditTrailService;
    private final PermissionRepository permissionRepository;
    private final DocumentTypeRepository documentTypeRepository;
    private final RoleDefinitionRepository roleDefinitionRepository;
    private final SecurityChangeSignatureService securityChangeSignatureService;
    private final WorkflowRoleRepository workflowRoleRepository;
    private final WorkflowRegistryService workflowRegistryService;
    private final WorkflowActionPolicyRelationRepository workflowActionPolicyRelationRepository;
    private final AuthorizationRelationDefinitionRepository authorizationRelationDefinitionRepository;

    public WorkflowActionPolicyService(
            WorkflowActionPolicyRepository policyRepo,
            AuditTrailService auditTrailService,
            PermissionRepository permissionRepository,
            DocumentTypeRepository documentTypeRepository,
            RoleDefinitionRepository roleDefinitionRepository,
            SecurityChangeSignatureService securityChangeSignatureService,
            WorkflowRoleRepository workflowRoleRepository,
            WorkflowRegistryService workflowRegistryService,
            WorkflowActionPolicyRelationRepository workflowActionPolicyRelationRepository,
            AuthorizationRelationDefinitionRepository authorizationRelationDefinitionRepository
    ) {
        this.policyRepo = policyRepo;
        this.auditTrailService = auditTrailService;
        this.permissionRepository = permissionRepository;
        this.documentTypeRepository = documentTypeRepository;
        this.roleDefinitionRepository = roleDefinitionRepository;
        this.securityChangeSignatureService = securityChangeSignatureService;
        this.workflowRoleRepository = workflowRoleRepository;
        this.workflowRegistryService = workflowRegistryService;
        this.workflowActionPolicyRelationRepository = workflowActionPolicyRelationRepository;
        this.authorizationRelationDefinitionRepository = authorizationRelationDefinitionRepository;
    }

    // ── Runtime resolution ────────────────────────────────────────────────────

    public Optional<WorkflowActionPolicy> resolvePolicy(
            RevisionWorkflowAction action, String fromStatus, UUID documentTypeId) {
        return resolvePolicy(MODULE, WORKFLOW, OBJ_TYPE, action.name(), fromStatus, documentTypeId);
    }

    /** Generic fail-closed runtime lookup for every registered workflow. */
    public Optional<WorkflowActionPolicy> resolvePolicy(
            String moduleKey, String workflowKey, String objectType,
            String actionCode, String fromStatus, UUID documentTypeId) {
        if (documentTypeId != null) {
            List<WorkflowActionPolicy> specific = policyRepo.findActivePoliciesForDocumentType(
                    moduleKey, workflowKey, objectType, actionCode, fromStatus, documentTypeId);
            if (!specific.isEmpty()) return Optional.of(specific.get(0));
        }
        List<WorkflowActionPolicy> global = policyRepo.findActiveGlobalPolicies(
                moduleKey, workflowKey, objectType, actionCode, fromStatus);
        if (!global.isEmpty()) return Optional.of(global.get(0));
        return Optional.empty();
    }

    // ── Read ─────────────────────────────────────────────────────────────────

    /** Server-side list: search, filters, sort and pagination resolved here. */
    @Transactional(readOnly = true)
    public com.eqms.dto.user.PageResponse<WorkflowActionPolicyResponse> listPaged(
            int page, int limit, String search, String workflow, String action, String fromStatus,
            String documentType, String active, String type, String createdFrom, String createdTo,
            String updatedFrom, String updatedTo, String sortBy, String sortDir) {
        java.util.List<WorkflowActionPolicyResponse> filtered = listAll().stream()
                .filter(p2 -> {
                    if (hasTextFilter(workflow) && !p2.workflowKey().equals(workflow)) return false;
                    if (hasTextFilter(action) && !p2.actionCode().equals(action)) return false;
                    if (hasTextFilter(fromStatus) && !p2.fromStatus().equals(fromStatus)) return false;
                    if ("GLOBAL".equalsIgnoreCase(documentType)) {
                        if (p2.documentTypeId() != null) return false;
                    } else if (hasTextFilter(documentType)
                            && (p2.documentTypeId() == null || !p2.documentTypeId().toString().equals(documentType))) {
                        return false;
                    }
                    if ("ACTIVE".equalsIgnoreCase(active) && !p2.active()) return false;
                    if ("INACTIVE".equalsIgnoreCase(active) && p2.active()) return false;
                    if (!com.eqms.util.DateRangeFilter.matches(p2.createdAt(), createdFrom, createdTo)) return false;
                    if (!com.eqms.util.DateRangeFilter.matches(p2.updatedAt(), updatedFrom, updatedTo)) return false;
                    if ("SYSTEM".equalsIgnoreCase(type) && !p2.system()) return false;
                    if ("CUSTOM".equalsIgnoreCase(type) && p2.system()) return false;
                    String q = search == null ? "" : search.trim().toLowerCase(java.util.Locale.ROOT);
                    if (q.isEmpty()) return true;
                    return (p2.actionCode() + " " + orEmpty(p2.actionLabel()) + " " + p2.fromStatus() + " "
                            + orEmpty(p2.fromStatusLabel()) + " " + orEmpty(p2.requiredPermissionCode()) + " "
                            + orEmpty(p2.documentTypeName()) + " " + orEmpty(p2.description()))
                            .toLowerCase(java.util.Locale.ROOT).contains(q);
                })
                .collect(java.util.stream.Collectors.toList());
        java.util.Comparator<WorkflowActionPolicyResponse> cmp = switch (sortBy == null ? "action" : sortBy) {
            case "workflow" -> java.util.Comparator.comparing(WorkflowActionPolicyResponse::workflowKey);
            case "fromStatus" -> java.util.Comparator.comparing(WorkflowActionPolicyResponse::fromStatus);
            case "priority" -> java.util.Comparator.comparingInt(WorkflowActionPolicyResponse::priority);
            case "active" -> java.util.Comparator.comparing(p2 -> p2.active() ? 0 : 1);
            case "type" -> java.util.Comparator.comparing(p2 -> p2.system() ? 0 : 1);
            case "permission" -> java.util.Comparator.comparing(p2 -> orEmpty(p2.requiredPermissionCode()));
            case "docType" -> java.util.Comparator.comparing(p2 -> orEmpty(p2.documentTypeName()));
            case "createdAt" -> java.util.Comparator.comparing(WorkflowActionPolicyResponse::createdAt);
            case "updatedAt" -> java.util.Comparator.comparing(WorkflowActionPolicyResponse::updatedAt);
            default -> java.util.Comparator.comparing(WorkflowActionPolicyResponse::actionCode);
        };
        if ("desc".equalsIgnoreCase(sortDir)) cmp = cmp.reversed();
        filtered.sort(cmp);
        return com.eqms.util.PagedList.paginate(filtered, page, limit);
    }

    private static boolean hasTextFilter(String v) {
        return org.springframework.util.StringUtils.hasText(v) && !"ALL".equalsIgnoreCase(v);
    }

    private static String orEmpty(String v) {
        return v == null ? "" : v;
    }

    public List<WorkflowActionPolicyResponse> listAll() {
        return policyRepo.findAllByOrderByActionCodeAscPriorityAsc()
                .stream().map(p -> toResponse(p, null)).toList();
    }

    public WorkflowActionPolicyResponse getById(UUID id) {
        return policyRepo.findById(id)
                .map(p -> toResponse(p, null))
                .orElseThrow(() -> WorkflowPolicyException.notFound("Workflow action policy not found: " + id));
    }

    public List<WorkflowActionPolicyResponse> getDefaultDocumentRevisionPolicies() {
        return policyRepo.findAllByOrderByActionCodeAscPriorityAsc()
                .stream().filter(WorkflowActionPolicy::isSystem)
                .map(p -> toResponse(p, null)).toList();
    }

    // ── Effective policy lookup ───────────────────────────────────────────────

    public WorkflowActionPolicyEffectiveResponse getEffectivePolicy(
            String moduleKey, String workflowKey, String objectType,
            String actionCode, String fromStatus, UUID documentTypeId) {

        if (documentTypeId != null) {
            List<WorkflowActionPolicy> specific = policyRepo.findActivePoliciesForDocumentType(
                    moduleKey, workflowKey, objectType, actionCode, fromStatus, documentTypeId);
            if (!specific.isEmpty()) {
                return new WorkflowActionPolicyEffectiveResponse(
                        "DOCUMENT_TYPE_OVERRIDE", toResponse(specific.get(0), null), false);
            }
        }
        List<WorkflowActionPolicy> global = policyRepo.findActiveGlobalPolicies(
                moduleKey, workflowKey, objectType, actionCode, fromStatus);
        if (!global.isEmpty()) {
            return new WorkflowActionPolicyEffectiveResponse(
                    "GLOBAL", toResponse(global.get(0), null), false);
        }
        return new WorkflowActionPolicyEffectiveResponse("NOT_CONFIGURED", null, false);
    }

    // ── Options metadata ──────────────────────────────────────────────────────

    public WorkflowActionPolicyOptionsResponse getOptions() {
        List<WorkflowDefinition> workflowDefinitions = workflowRegistryService.getDefinitions();
        List<WorkflowActionPolicyOptionsResponse.ActionOption> allActions = workflowDefinitions.stream()
                .flatMap(definition -> definition.actions().stream().map(action ->
                        new WorkflowActionPolicyOptionsResponse.ActionOption(
                                action.actionCode(), action.label(), definition.workflowKey(), action.objectType(),
                                action.allowedActorTypes().stream().map(Enum::name).sorted().toList(),
                                action.defaultFromStatuses(), action.requiredPermissionCandidates())))
                .toList();

        List<WorkflowActionPolicyOptionsResponse.ActorTypeOption> actorTypes =
                Arrays.stream(WorkflowActorType.values())
                        .map(t -> new WorkflowActionPolicyOptionsResponse.ActorTypeOption(
                                t.name(), Labels.actorType(t.name()), requiresCode(t)))
                        .toList();

        List<WorkflowActionPolicyOptionsResponse.PermissionOption> permissions =
                permissionRepository.findAll().stream()
                        .sorted(Comparator
                                .comparing((Permission permission) -> nullSafe(permission.getModuleKey()))
                                .thenComparing(permission -> nullSafe(permission.getGroupKey()))
                                .thenComparing(permission -> permission.getDisplayOrder() == null ? Integer.MAX_VALUE : permission.getDisplayOrder())
                                .thenComparing(permission -> nullSafe(permission.getCode())))
                        .map(p -> new WorkflowActionPolicyOptionsResponse.PermissionOption(
                                p.getCode(), p.getName(), p.getModuleKey(), p.getGroupKey()))
                        .toList();

        List<WorkflowActionPolicyOptionsResponse.DocumentTypeOption> documentTypes =
                documentTypeRepository.findAllByActiveTrueOrderByNameAsc()
                        .stream()
                        .map(dt -> new WorkflowActionPolicyOptionsResponse.DocumentTypeOption(
                                dt.getId(), dt.getShortCode(), dt.getName()))
                        .toList();

        // Selectable codes for code-bearing actor types — pickers instead of typed codes.
        Map<String, List<WorkflowActionPolicyOptionsResponse.ActorCodeOption>> actorCodeOptions = Map.of(
                WorkflowActorType.ACCESS_PROFILE.name(),
                roleDefinitionRepository.findAll().stream()
                        .filter(r -> r.isActive() && r.getCode() != null)
                        .sorted(Comparator.comparing(r -> r.getName() == null ? "" : r.getName()))
                        .map(r -> new WorkflowActionPolicyOptionsResponse.ActorCodeOption(r.getCode(), r.getName()))
                        .toList(),
                WorkflowActorType.PERMISSION.name(), permissions.stream()
                        .map(p -> new WorkflowActionPolicyOptionsResponse.ActorCodeOption(p.code(), p.name()))
                        .toList());

        return new WorkflowActionPolicyOptionsResponse(
                workflowDefinitions.stream().map(WorkflowDefinition::moduleKey).distinct().toList(),
                workflowDefinitions.stream().map(WorkflowDefinition::workflowKey).toList(),
                workflowDefinitions.stream()
                        .map(definition -> new WorkflowActionPolicyOptionsResponse.WorkflowOption(
                                definition.workflowKey(), definition.label(), definition.moduleKey()))
                        .toList(),
                allActions.stream().map(WorkflowActionPolicyOptionsResponse.ActionOption::objectType).distinct().toList(),
                allActions, actorTypes, permissions, documentTypes, actorCodeOptions);
    }

    // ── Create ───────────────────────────────────────────────────────────────

    @Transactional
    public WorkflowActionPolicyResponse createPolicy(WorkflowActionPolicyCreateRequest request, UserAccount actor) {
        securityChangeSignatureService.requireValidToken(actor, request.signatureToken());
        workflowRegistryService.requireAction(
                request.moduleKey(), request.workflowKey(), request.objectType(), request.actionCode());
        validateActors(request.actors(), request.workflowKey(), request.actionCode(), request.requiredPermissionCode());

        int priority = request.priority() != null ? request.priority() : 100;
        boolean active = request.active() == null || request.active();

        if (active) {
            checkDuplicate(request.moduleKey(), request.workflowKey(), request.objectType(),
                    request.actionCode(), request.fromStatus(), priority,
                    request.documentTypeId(), null);
        }

        WorkflowActionPolicy policy = new WorkflowActionPolicy();
        policy.setModuleKey(request.moduleKey());
        policy.setWorkflowKey(request.workflowKey());
        policy.setObjectType(request.objectType());
        policy.setActionCode(request.actionCode());
        policy.setFromStatus(request.fromStatus());
        policy.setDocumentTypeId(request.documentTypeId());
        policy.setRequiredPermissionCode(request.requiredPermissionCode());
        policy.setPriority(priority);
        policy.setActive(active);
        policy.setSystem(false);
        policy.setDescription(request.description());
        policy.setCreatedBy(actor != null ? actor.getId() : null);
        policy.setUpdatedBy(actor != null ? actor.getId() : null);
        buildActors(policy, request.actors(), actor);

        WorkflowActionPolicy saved = policyRepo.save(policy);
        auditSafely(actor, saved.getId(), "WORKFLOW_ACTION_POLICY_CREATED",
                null, summarize(saved), request.changeReason());
        securityChangeSignatureService.record(actor, request.signatureToken(),
                SecurityChangeSignatureService.MEANING_WORKFLOW_AUTHORIZATION_CHANGE,
                "WORKFLOW_ACTION_POLICY", saved.getId(), saved.getActionCode(), request.changeReason(),
                null, summarize(saved));
        return toResponse(saved, null);
    }

    // ── Create document-type override ─────────────────────────────────────────

    @Transactional
    public WorkflowActionPolicyResponse createDocumentTypeOverride(
            UUID sourceId, WorkflowActionPolicyOverrideRequest request, UserAccount actor) {

        securityChangeSignatureService.requireValidToken(actor, request.signatureToken());
        WorkflowActionPolicy source = policyRepo.findById(sourceId)
                .orElseThrow(() -> WorkflowPolicyException.notFound("Source policy not found: " + sourceId));

        String permCode = request.requiredPermissionCode() != null
                ? request.requiredPermissionCode()
                : source.getRequiredPermissionCode();

        List<WorkflowActionPolicyActorRequest> actorRequests = (request.actors() != null && !request.actors().isEmpty())
                ? request.actors()
                : source.getActors().stream()
                        .map(a -> new WorkflowActionPolicyActorRequest(a.getActorType(), a.getActorCode()))
                        .toList();

        validateActors(actorRequests, source.getWorkflowKey(), source.getActionCode(), permCode);

        int priority = request.priority() != null ? request.priority() : 100;

        checkDuplicate(source.getModuleKey(), source.getWorkflowKey(), source.getObjectType(),
                source.getActionCode(), source.getFromStatus(), priority,
                request.documentTypeId(), null);

        WorkflowActionPolicy override = new WorkflowActionPolicy();
        override.setModuleKey(source.getModuleKey());
        override.setWorkflowKey(source.getWorkflowKey());
        override.setObjectType(source.getObjectType());
        override.setActionCode(source.getActionCode());
        override.setFromStatus(source.getFromStatus());
        override.setDocumentTypeId(request.documentTypeId());
        override.setRequiredPermissionCode(permCode);
        override.setPriority(priority);
        override.setActive(true);
        override.setSystem(false);
        override.setDescription(request.description());
        override.setCreatedBy(actor != null ? actor.getId() : null);
        override.setUpdatedBy(actor != null ? actor.getId() : null);
        buildActors(override, actorRequests, actor);

        WorkflowActionPolicy saved = policyRepo.save(override);
        auditSafely(actor, saved.getId(), "WORKFLOW_ACTION_POLICY_OVERRIDE_CREATED",
                null, summarize(saved), request.changeReason());
        securityChangeSignatureService.record(actor, request.signatureToken(),
                SecurityChangeSignatureService.MEANING_WORKFLOW_AUTHORIZATION_CHANGE,
                "WORKFLOW_ACTION_POLICY", saved.getId(), saved.getActionCode(), request.changeReason(),
                null, summarize(saved));
        return toResponse(saved, null);
    }

    // ── Duplicate ─────────────────────────────────────────────────────────────

    @Transactional
    public WorkflowActionPolicyResponse duplicatePolicy(
            UUID sourceId, WorkflowActionPolicyDuplicateRequest request, UserAccount actor) {

        securityChangeSignatureService.requireValidToken(actor, request.signatureToken());
        WorkflowActionPolicy source = policyRepo.findById(sourceId)
                .orElseThrow(() -> WorkflowPolicyException.notFound("Source policy not found: " + sourceId));

        boolean active = request.active() != null && request.active();
        int priority = request.priority() != null ? request.priority() : 100;
        UUID docTypeId = request.documentTypeId() != null ? request.documentTypeId() : source.getDocumentTypeId();

        if (active) {
            checkDuplicate(source.getModuleKey(), source.getWorkflowKey(), source.getObjectType(),
                    source.getActionCode(), source.getFromStatus(), priority, docTypeId, null);
        }

        WorkflowActionPolicy copy = new WorkflowActionPolicy();
        copy.setModuleKey(source.getModuleKey());
        copy.setWorkflowKey(source.getWorkflowKey());
        copy.setObjectType(source.getObjectType());
        copy.setActionCode(source.getActionCode());
        copy.setFromStatus(source.getFromStatus());
        copy.setDocumentTypeId(docTypeId);
        copy.setRequiredPermissionCode(source.getRequiredPermissionCode());
        copy.setPriority(priority);
        copy.setActive(active);
        copy.setSystem(false);
        copy.setDescription(request.description() != null ? request.description()
                : "Copy of: " + (source.getDescription() != null ? source.getDescription() : source.getActionCode()));
        copy.setCreatedBy(actor != null ? actor.getId() : null);
        copy.setUpdatedBy(actor != null ? actor.getId() : null);
        List<WorkflowActionPolicyActorRequest> actorRequests = source.getActors().stream()
                .map(a -> new WorkflowActionPolicyActorRequest(a.getActorType(), a.getActorCode()))
                .toList();
        buildActors(copy, actorRequests, actor);

        WorkflowActionPolicy saved = policyRepo.save(copy);
        auditSafely(actor, saved.getId(), "WORKFLOW_ACTION_POLICY_DUPLICATED",
                "sourceId=" + sourceId, summarize(saved), request.changeReason());
        securityChangeSignatureService.record(actor, request.signatureToken(),
                SecurityChangeSignatureService.MEANING_WORKFLOW_AUTHORIZATION_CHANGE,
                "WORKFLOW_ACTION_POLICY", saved.getId(), saved.getActionCode(), request.changeReason(),
                "sourceId=" + sourceId, summarize(saved));
        return toResponse(saved, null);
    }

    // ── Update ───────────────────────────────────────────────────────────────

    @Transactional
    public WorkflowActionPolicyResponse updatePolicy(UUID id, WorkflowActionPolicyRequest request, UserAccount actor) {
        securityChangeSignatureService.requireValidToken(actor, request.signatureToken());
        WorkflowActionPolicy policy = policyRepo.findById(id)
                .orElseThrow(() -> WorkflowPolicyException.notFound("Workflow action policy not found: " + id));

        validateRequest(request, policy);

        boolean becomingActive = !policy.isActive() && Boolean.TRUE.equals(request.active());
        boolean activeDuplicate = (policy.isActive() || becomingActive) && Boolean.TRUE.equals(request.active());
        if (activeDuplicate) {
            checkDuplicate(policy.getModuleKey(), policy.getWorkflowKey(), policy.getObjectType(),
                    policy.getActionCode(), policy.getFromStatus(), request.priority(),
                    request.documentTypeId(), id);
        }

        String oldValue = summarize(policy);
        policy.setRequiredPermissionCode(request.requiredPermissionCode());
        policy.setPriority(request.priority());
        policy.setActive(request.active());
        policy.setDescription(request.description());
        policy.setDocumentTypeId(request.documentTypeId());
        policy.setUpdatedBy(actor != null ? actor.getId() : null);
        replaceActors(policy, request.actors(), actor);

        WorkflowActionPolicy saved = policyRepo.save(policy);
        auditSafely(actor, id, "WORKFLOW_ACTION_POLICY_UPDATED",
                oldValue, summarize(saved), request.changeReason());
        securityChangeSignatureService.record(actor, request.signatureToken(),
                SecurityChangeSignatureService.MEANING_WORKFLOW_AUTHORIZATION_CHANGE,
                "WORKFLOW_ACTION_POLICY", saved.getId(), saved.getActionCode(), request.changeReason(),
                oldValue, summarize(saved));
        return toResponse(saved, null);
    }

    /**
     * Replaces this policy's hybrid-engine relation set (SECURITY_AUTHORIZATION_HYBRID_REFACTOR_PLAN.md
     * §3.1) -- what {@code ResourceAuthorizationAdapter}s actually read once a resource type's
     * cutover flag is on, independent of the legacy {@link #updatePolicy} actors list. Admin
     * picks from the existing {@code authorization_relation_definitions} catalog only; no new
     * resolver can be authored from here.
     */
    @Transactional
    public WorkflowActionPolicyResponse setPolicyRelations(
            UUID id, List<UUID> relationDefinitionIds, String relationMatchRule,
            String signatureToken, String changeReason, UserAccount actor
    ) {
        securityChangeSignatureService.requireValidToken(actor, signatureToken);
        WorkflowActionPolicy policy = policyRepo.findById(id)
                .orElseThrow(() -> WorkflowPolicyException.notFound("Workflow action policy not found: " + id));

        String oldValue = summarize(policy);
        policy.setRelationMatchRule("ALL".equalsIgnoreCase(relationMatchRule) ? "ALL" : "ANY");
        policy.setUpdatedBy(actor != null ? actor.getId() : null);
        policyRepo.save(policy);

        workflowActionPolicyRelationRepository.deleteAllByPolicy_Id(id);
        int priority = 100;
        for (UUID relationDefinitionId : relationDefinitionIds == null ? List.<UUID>of() : relationDefinitionIds) {
            AuthorizationRelationDefinition definition = authorizationRelationDefinitionRepository.findById(relationDefinitionId)
                    .orElseThrow(() -> WorkflowPolicyException.notFound("Relation definition not found: " + relationDefinitionId));
            WorkflowActionPolicyRelation relation = new WorkflowActionPolicyRelation();
            relation.setPolicy(policy);
            relation.setRelationDefinition(definition);
            relation.setPriority(priority);
            relation.setActive(true);
            workflowActionPolicyRelationRepository.save(relation);
            priority += 100;
        }

        WorkflowActionPolicyResponse response = toResponse(policy, null);
        auditSafely(actor, id, "WORKFLOW_ACTION_POLICY_RELATIONS_UPDATED",
                oldValue, summarize(policy) + " relations=" + response.relations().stream()
                        .map(WorkflowActionPolicyRelationResponse::relationCode).toList(),
                changeReason);
        securityChangeSignatureService.record(actor, signatureToken,
                SecurityChangeSignatureService.MEANING_WORKFLOW_AUTHORIZATION_CHANGE,
                "WORKFLOW_ACTION_POLICY", id, policy.getActionCode(), changeReason,
                oldValue, summarize(policy));
        return response;
    }

    // ── Preview / diff ────────────────────────────────────────────────────────

    public WorkflowActionPolicyPreviewResponse previewUpdate(UUID id, WorkflowActionPolicyRequest request) {
        WorkflowActionPolicy policy = policyRepo.findById(id)
                .orElseThrow(() -> WorkflowPolicyException.notFound("Workflow action policy not found: " + id));

        try {
            validateRequest(request, policy);
        } catch (Exception ex) {
            return new WorkflowActionPolicyPreviewResponse(false, id,
                    List.of(), List.of(new PolicyWarning("VALIDATION_ERROR", ex.getMessage())),
                    wouldAffect(policy));
        }

        List<PolicyChange> changes = new ArrayList<>();
        if (!Objects.equals(policy.getRequiredPermissionCode(), request.requiredPermissionCode())) {
            changes.add(new PolicyChange("requiredPermissionCode",
                    policy.getRequiredPermissionCode(), request.requiredPermissionCode()));
        }
        if (policy.getPriority() != request.priority()) {
            changes.add(new PolicyChange("priority",
                    String.valueOf(policy.getPriority()), String.valueOf(request.priority())));
        }
        if (policy.isActive() != request.active()) {
            changes.add(new PolicyChange("active",
                    String.valueOf(policy.isActive()), String.valueOf(request.active())));
        }
        if (!Objects.equals(policy.getDescription(), request.description())) {
            changes.add(new PolicyChange("description", policy.getDescription(), request.description()));
        }
        if (!Objects.equals(policy.getDocumentTypeId(), request.documentTypeId())) {
            changes.add(new PolicyChange("documentTypeId",
                    policy.getDocumentTypeId() != null ? policy.getDocumentTypeId().toString() : null,
                    request.documentTypeId() != null ? request.documentTypeId().toString() : null));
        }
        List<String> oldActors = policy.getActors().stream()
                .map(a -> a.getActorType().name() + (a.getActorCode() != null ? ":" + a.getActorCode() : ""))
                .sorted().toList();
        List<String> newActors = request.actors().stream()
                .map(a -> a.actorType().name() + (a.actorCode() != null ? ":" + a.actorCode() : ""))
                .sorted().toList();
        if (!oldActors.equals(newActors)) {
            changes.add(new PolicyChange("actors", String.join(", ", oldActors), String.join(", ", newActors)));
        }

        List<PolicyWarning> warnings = new ArrayList<>();
        // warn if new policy is broader than default
        DefaultPolicy defaults = WorkflowActionDefaultPolicyRegistry.get(
                policy.getWorkflowKey(), policy.getActionCode(), policy.getFromStatus());
        if (defaults != null) {
            Set<WorkflowActorType> defaultActorTypes = defaults.actors().stream()
                    .map(DefaultActorEntry::actorType).collect(Collectors.toSet());
            boolean broader = request.actors().stream()
                    .anyMatch(a -> !defaultActorTypes.contains(a.actorType()));
            if (broader) {
                warnings.add(new PolicyWarning("BROAD_ACTOR_POLICY",
                        "This policy allows more actor types than the system default."));
            }
        }

        return new WorkflowActionPolicyPreviewResponse(true, id, changes, warnings, wouldAffect(policy));
    }

    // ── Activate / deactivate ─────────────────────────────────────────────────

    @Transactional
    public WorkflowActionPolicyResponse activatePolicy(
            UUID id, UserAccount actor, com.eqms.dto.settings.SecurityChangeRequest signature) {
        securityChangeSignatureService.requireValidToken(actor, signature.signatureToken());
        WorkflowActionPolicy policy = policyRepo.findById(id)
                .orElseThrow(() -> WorkflowPolicyException.notFound("Workflow action policy not found: " + id));

        if (policy.isActive()) return toResponse(policy, null);

        checkDuplicate(policy.getModuleKey(), policy.getWorkflowKey(), policy.getObjectType(),
                policy.getActionCode(), policy.getFromStatus(), policy.getPriority(),
                policy.getDocumentTypeId(), id);

        String old = summarize(policy);
        policy.setActive(true);
        policy.setUpdatedBy(actor != null ? actor.getId() : null);
        WorkflowActionPolicy saved = policyRepo.save(policy);
        auditSafely(actor, id, "WORKFLOW_ACTION_POLICY_ACTIVATED", old, summarize(saved), signature.reason());
        securityChangeSignatureService.record(actor, signature.signatureToken(),
                SecurityChangeSignatureService.MEANING_WORKFLOW_AUTHORIZATION_CHANGE,
                "WORKFLOW_ACTION_POLICY", saved.getId(), saved.getActionCode(), signature.reason(),
                old, summarize(saved));
        return toResponse(saved, null);
    }

    @Transactional
    public WorkflowActionPolicyResponse deactivatePolicy(
            UUID id, UserAccount actor, com.eqms.dto.settings.SecurityChangeRequest signature) {
        securityChangeSignatureService.requireValidToken(actor, signature.signatureToken());
        WorkflowActionPolicy policy = policyRepo.findById(id)
                .orElseThrow(() -> WorkflowPolicyException.notFound("Workflow action policy not found: " + id));

        if (!policy.isActive()) return toResponse(policy, null);

        if (CRITICAL_ACTIONS.contains(policy.getActionCode())) {
            long remaining = policyRepo.countActiveForAction(
                    policy.getModuleKey(), policy.getWorkflowKey(), policy.getObjectType(),
                    policy.getActionCode(), id);
            // Built-in fallback covers Sprint 3 behavior — deactivation is safe as long as
            // the runtime denies the action when no active policy row exists.
            // We still block if NO other active policy AND the action is system-critical.
            if (remaining == 0) {
                throw WorkflowPolicyException.deactivationBlocked(
                        "Cannot deactivate: no other active policy exists for critical action '"
                        + policy.getActionCode() + "'.");
            }
        }

        String old = summarize(policy);
        policy.setActive(false);
        policy.setUpdatedBy(actor != null ? actor.getId() : null);
        WorkflowActionPolicy saved = policyRepo.save(policy);
        auditSafely(actor, id, "WORKFLOW_ACTION_POLICY_DEACTIVATED", old, summarize(saved), signature.reason());
        securityChangeSignatureService.record(actor, signature.signatureToken(),
                SecurityChangeSignatureService.MEANING_WORKFLOW_AUTHORIZATION_CHANGE,
                "WORKFLOW_ACTION_POLICY", saved.getId(), saved.getActionCode(), signature.reason(),
                old, summarize(saved));
        return toResponse(saved, null);
    }

    // ── Reset to system default ───────────────────────────────────────────────

    @Transactional
    public WorkflowActionPolicyResponse resetToSystemDefault(UUID id, UserAccount actor, String signatureToken, String reason) {
        securityChangeSignatureService.requireValidToken(actor, signatureToken);
        WorkflowActionPolicy policy = policyRepo.findById(id)
                .orElseThrow(() -> WorkflowPolicyException.notFound("Workflow action policy not found: " + id));

        if (!policy.isSystem()) {
            throw WorkflowPolicyException.resetNotAllowed(
                    "Only system policies can be reset to default.");
        }

        DefaultPolicy defaults = WorkflowActionDefaultPolicyRegistry.get(
                policy.getWorkflowKey(), policy.getActionCode(), policy.getFromStatus());
        if (defaults == null) {
            throw WorkflowPolicyException.resetNotAllowed(
                    "No system default registered for action '" + policy.getActionCode()
                    + "' fromStatus '" + policy.getFromStatus() + "' workflow '" + policy.getWorkflowKey() + "'.");
        }

        String old = summarize(policy);
        policy.setRequiredPermissionCode(defaults.requiredPermissionCode());
        policy.setPriority(defaults.priority());
        policy.setActive(defaults.active());
        policy.setDescription(defaults.description());
        policy.setDocumentTypeId(null);
        policy.setUpdatedBy(actor != null ? actor.getId() : null);

        // Restore actors from defaults
        policy.getActors().clear();
        for (DefaultActorEntry entry : defaults.actors()) {
            WorkflowActionPolicyActor a = new WorkflowActionPolicyActor();
            a.setPolicy(policy);
            a.setActorType(entry.actorType());
            a.setActorCode(entry.actorCode());
            a.setCreatedBy(actor != null ? actor.getId() : null);
            policy.getActors().add(a);
        }

        WorkflowActionPolicy saved = policyRepo.save(policy);
        auditSafely(actor, id, "WORKFLOW_ACTION_POLICY_RESET_TO_DEFAULT", old, summarize(saved), reason);
        securityChangeSignatureService.record(actor, signatureToken,
                SecurityChangeSignatureService.MEANING_WORKFLOW_AUTHORIZATION_CHANGE,
                "WORKFLOW_ACTION_POLICY", saved.getId(), saved.getActionCode(), reason,
                old, summarize(saved));
        return toResponse(saved, null);
    }

    // ── Validation ────────────────────────────────────────────────────────────

    /**
     * Validates an update request against the existing policy (actionCode/fromStatus come from entity).
     * Shared path for update + preview.
     */
    public void validateRequest(WorkflowActionPolicyRequest request, WorkflowActionPolicy existing) {
        if (permissionRepository.findByCode(request.requiredPermissionCode()).isEmpty()) {
            throw WorkflowPolicyException.validationError(
                    "Permission code not found: " + request.requiredPermissionCode());
        }
        if (request.actors() == null || request.actors().isEmpty()) {
            throw WorkflowPolicyException.validationError("At least one actor is required.");
        }
        validateActorsForAction(request.actors(), existing.getWorkflowKey(), existing.getActionCode());
    }

    /**
     * Shared actor validation used by create/update/override/duplicate paths.
     */
    void validateActors(List<WorkflowActionPolicyActorRequest> actors,
                        String workflowKey, String actionCode, String permCode) {
        if (permissionRepository.findByCode(permCode).isEmpty()) {
            throw WorkflowPolicyException.validationError("Permission code not found: " + permCode);
        }
        if (actors == null || actors.isEmpty()) {
            throw WorkflowPolicyException.validationError("At least one actor is required.");
        }
        validateActorsForAction(actors, workflowKey, actionCode);
    }

    private void validateActorsForAction(List<WorkflowActionPolicyActorRequest> actors,
                                         String workflowKey, String actionCode) {
        Set<WorkflowActorType> allowed = workflowRegistryService.getAllowedActorTypes(workflowKey, actionCode);
        if (allowed.isEmpty()) {
            throw WorkflowPolicyException.validationError(
                    "No eligible actor types are registered for action " + actionCode
                            + " in workflow " + workflowKey + ".");
        }
        for (WorkflowActionPolicyActorRequest a : actors) {
            if (!allowed.contains(a.actorType())) {
                throw WorkflowPolicyException.validationError(
                        "Actor type " + a.actorType() + " is not permitted for action "
                        + actionCode + " in workflow " + workflowKey + ". Allowed: " + allowed);
            }
            boolean needsCode = requiresCode(a.actorType());
            boolean mustNotHaveCode = a.actorType() == WorkflowActorType.AUTHOR
                    || a.actorType() == WorkflowActorType.CO_AUTHOR
                    || a.actorType() == WorkflowActorType.OWNER
                    || a.actorType() == WorkflowActorType.ASSIGNED_REVIEWER
                    || a.actorType() == WorkflowActorType.ASSIGNED_APPROVER
                    || a.actorType() == WorkflowActorType.SELF;
            if (needsCode && (a.actorCode() == null || a.actorCode().isBlank())) {
                throw WorkflowPolicyException.validationError(
                        "actorCode is required for actor type " + a.actorType());
            }
            if (a.actorType() == WorkflowActorType.PERMISSION
                    && !permissionRepository.findByCode(a.actorCode().trim()).isPresent()) {
                throw WorkflowPolicyException.validationError(
                        "Unknown permission code for workflow actor: " + a.actorCode());
            }
            if (mustNotHaveCode && a.actorCode() != null && !a.actorCode().isBlank()) {
                throw WorkflowPolicyException.validationError(
                        "actorCode must be blank for actor type " + a.actorType());
            }
        }
    }

    /**
     * Returns the allowed actor types for an action, dispatching to the correct workflow map.
     * Returns an empty set (no restriction) for unknown workflow/action combinations so that
     * custom policies are not blocked by missing registry entries.
     */
    Set<WorkflowActorType> resolveAllowedActorTypes(String workflowKey, String actionCode) {
        return workflowRegistryService.getAllowedActorTypes(workflowKey, actionCode);
    }

    public boolean isActorTypeAllowed(RevisionWorkflowAction action, WorkflowActorType actorType) {
        return workflowRegistryService.getAllowedActorTypes(WORKFLOW, action.name()).contains(actorType);
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private void checkDuplicate(String moduleKey, String workflowKey, String objectType,
                                 String actionCode, String fromStatus, int priority,
                                 UUID documentTypeId, UUID excludeId) {
        UUID safeExclude = excludeId != null ? excludeId : UUID.fromString("00000000-0000-0000-0000-000000000000");
        if (policyRepo.existsActiveDuplicate(moduleKey, workflowKey, objectType,
                actionCode, fromStatus, priority, documentTypeId, safeExclude)) {
            throw WorkflowPolicyException.duplicate(
                    "An active workflow policy already exists for this action, status, document type, and priority.");
        }
    }

    private boolean hasBuiltInFallback(String workflowKey, String actionCode) {
        // Built-in fallback in RevisionWorkflowAuthorizationService covers all actions in
        // resolveRequiredPermissionFallback(). If a policy is deactivated but no DB policy
        // remains, the runtime falls through to the fallback — which is always present.
        return workflowRegistryService.hasRuntimeFallback(workflowKey, actionCode);
    }

    private void buildActors(WorkflowActionPolicy policy,
                             List<WorkflowActionPolicyActorRequest> actorRequests,
                             UserAccount actor) {
        for (WorkflowActionPolicyActorRequest req : actorRequests) {
            WorkflowActionPolicyActor a = new WorkflowActionPolicyActor();
            a.setPolicy(policy);
            a.setActorType(req.actorType());
            a.setActorCode(req.actorCode());
            a.setCreatedBy(actor != null ? actor.getId() : null);
            policy.getActors().add(a);
        }
    }

    private void replaceActors(WorkflowActionPolicy policy,
                                List<WorkflowActionPolicyActorRequest> actorRequests,
                                UserAccount actor) {
        policy.getActors().clear();
        buildActors(policy, actorRequests, actor);
    }

    WorkflowActionPolicyResponse toResponse(WorkflowActionPolicy p, Map<UUID, String> docTypeNameCache) {
        String docTypeName = null;
        if (p.getDocumentTypeId() != null) {
            if (docTypeNameCache != null) {
                docTypeName = docTypeNameCache.get(p.getDocumentTypeId());
            } else {
                docTypeName = documentTypeRepository.findById(p.getDocumentTypeId())
                        .map(DocumentType::getName).orElse(null);
            }
        }

        String permName = permissionRepository.findByCode(p.getRequiredPermissionCode())
                .map(Permission::getName).orElse(null);

        boolean deactivatable = !p.isActive() || !CRITICAL_ACTIONS.contains(p.getActionCode())
                || policyRepo.countActiveForAction(p.getModuleKey(), p.getWorkflowKey(),
                        p.getObjectType(), p.getActionCode(),
                        p.getId() != null ? p.getId() : UUID.fromString("00000000-0000-0000-0000-000000000000")) > 0;

        List<WorkflowActionPolicyActorResponse> actors = p.getActors().stream()
                .map(a -> new WorkflowActionPolicyActorResponse(
                        a.getId(), a.getActorType(),
                        Labels.actorType(a.getActorType().name()),
                        a.getActorCode(),
                        Labels.actorDisplayName(a.getActorType().name(), a.getActorCode())))
                .toList();

        List<WorkflowActionPolicyRelationResponse> relations = p.getId() == null ? List.of() :
                Optional.ofNullable(workflowActionPolicyRelationRepository
                                .findAllByPolicy_IdAndActiveTrueOrderByPriorityAsc(p.getId()))
                        .orElseGet(List::of)
                        .stream()
                        .map(r -> new WorkflowActionPolicyRelationResponse(
                                r.getId(),
                                r.getRelationDefinition().getId(),
                                r.getRelationDefinition().getCode(),
                                r.getRelationDefinition().getDisplayName(),
                                r.getRelationDefinition().getResolverCode(),
                                r.getPriority()))
                        .toList();

        return new WorkflowActionPolicyResponse(
                p.getId(),
                p.getModuleKey(), Labels.module(p.getModuleKey()),
                p.getWorkflowKey(), Labels.workflow(p.getWorkflowKey()),
                p.getObjectType(),
                p.getActionCode(), Labels.action(p.getActionCode()),
                p.getFromStatus(), Labels.status(p.getFromStatus()),
                p.getDocumentTypeId(), docTypeName,
                p.getRequiredPermissionCode(), permName,
                p.getPriority(), p.isActive(), p.isSystem(),
                true,          // editable — all policies are editable via API
                p.isSystem(),  // resettable — only system policies
                deactivatable,
                p.getDescription(),
                actors,
                List.of(),     // warnings — populated per-request in previewUpdate if needed
                p.getCreatedAt(), p.getUpdatedAt(),
                p.getRelationMatchRule(), relations
        );
    }

    private WouldAffect wouldAffect(WorkflowActionPolicy p) {
        return new WouldAffect(p.getModuleKey(), p.getWorkflowKey(),
                p.getActionCode(), p.getFromStatus(), p.getDocumentTypeId());
    }

    private String summarize(WorkflowActionPolicy p) {
        return "action=" + p.getActionCode()
                + " fromStatus=" + p.getFromStatus()
                + " permission=" + p.getRequiredPermissionCode()
                + " priority=" + p.getPriority()
                + " active=" + p.isActive()
                + " actors=" + p.getActors().stream()
                        .map(a -> a.getActorType() + (a.getActorCode() != null ? ":" + a.getActorCode() : ""))
                        .toList();
    }

    private static boolean requiresCode(WorkflowActorType t) {
        return t == WorkflowActorType.ACCESS_PROFILE || t == WorkflowActorType.PERMISSION;
    }

    private static String nullSafe(String value) {
        return value == null ? "" : value;
    }

    private void auditSafely(UserAccount actor, UUID policyId, String actionType,
                              String oldVal, String newVal, String changeReason) {
        try {
            String combined = newVal + (changeReason != null ? " | reason=" + changeReason : "");
            auditTrailService.logAs(actor, "WORKFLOW_ACTION_POLICY", actionType, policyId,
                    actionType, oldVal, combined, null);
        } catch (Exception ex) {
            log.warn("[AUDIT] Failed to log policy audit event: {}", ex.getMessage());
        }
    }

    // ── Label helpers ─────────────────────────────────────────────────────────

    static final class Labels {
        private Labels() {}

        static String module(String key) {
            return "DOCUMENT_CONTROL".equals(key) ? "Document Control" : key;
        }

        static String workflow(String key) {
            if (key == null) return null;
            return switch (key) {
                case "DOCUMENT_REVISION" -> "Document Revision";
                case "CONTROLLED_COPY"   -> "Controlled Copy";
                default -> key;
            };
        }

        static String action(String code) {
            return switch (code) {
                // Document Revision actions
                case "COMPLETE_AUTHORING"         -> "Complete Authoring";
                case "OPEN_PUBLISHING_WORKSPACE"  -> "Open Publishing Workspace";
                case "SUBMIT_FOR_REVIEW"          -> "Submit for Review";
                case "GENERATE_REVIEW_SNAPSHOT"   -> "Generate Review Snapshot";
                case "REGENERATE_SNAPSHOT"        -> "Regenerate Snapshot";
                case "COMPLETE_REVIEW"            -> "Complete Review";
                case "REJECT_REVIEW"              -> "Reject Review";
                case "COMPLETE_APPROVAL"          -> "Complete Approval";
                case "REJECT_APPROVAL"            -> "Reject Approval";
                case "COMPLETE_TRAINING"          -> "Complete Training";
                case "PUBLISH"                    -> "Publish";
                case "CANCEL"                     -> "Cancel";
                case "OBSOLETE"                   -> "Obsolete";
                case "UPGRADE_REVISION"           -> "Upgrade Revision";
                case "UPDATE_DRAFT_METADATA"      -> "Update Draft Metadata";
                case "UPLOAD_SOURCE"              -> "Upload Source File";
                // Controlled Copy actions
                case "REQUEST_COPY"               -> "Request Copy";
                case "REJECT_REQUEST"             -> "Reject Request";
                case "PREPARE_DISTRIBUTION"       -> "Prepare Distribution";
                case "DISTRIBUTE_BATCH"           -> "Distribute Batch";
                case "DISTRIBUTE_COPY"            -> "Distribute Copy";
                case "VIEW_COPY"                  -> "View Copy";
                case "PREVIEW_FILE"               -> "Preview File";
                case "DOWNLOAD_FILE"              -> "Download File";
                case "PRINT_COPY"                 -> "Print Controlled Copy";
                case "RECALL_BATCH"               -> "Recall Batch";
                case "RECALL_COPY"                -> "Recall Copy";
                case "REPORT_LOST_DAMAGED"        -> "Report Lost / Damaged";
                case "REPLACE_LOST_DAMAGED"       -> "Replace Lost / Damaged";
                case "UPLOAD_EVIDENCE"            -> "Upload Evidence";
                case "EXPIRE_COPY"                -> "Expire Copy";
                case "CANCEL_REQUEST"             -> "Cancel Request";
                default -> code;
            };
        }

        static String status(String code) {
            return switch (code) {
                // Document Revision statuses
                case "DRAFT"                    -> "Draft";
                case "PENDING_REVIEW"           -> "Pending Review";
                case "PENDING_APPROVAL"         -> "Pending Approval";
                case "PENDING_TRAINING"         -> "Pending Training";
                case "READY_FOR_PUBLISHING"     -> "Ready for Publishing";
                case "EFFECTIVE"                -> "Effective";
                case "OBSOLETED"                -> "Obsoleted";
                case "CLOSED_CANCELLED"         -> "Cancelled";
                // Controlled Copy statuses
                case "READY_FOR_DISTRIBUTION"   -> "Ready for Distribution";
                case "DISTRIBUTED"              -> "Distributed";
                default -> code;
            };
        }

        static String actorType(String code) {
            return switch (code) {
                case "AUTHOR"                  -> "Revision Author";
                case "OWNER"                   -> "Document Owner";
                case "DCO"                     -> "Document Control Officer";
                case "DOCUMENT_ADMIN"          -> "Document Administrator";
                case "ASSIGNED_REVIEWER"       -> "Assigned Reviewer";
                case "ASSIGNED_APPROVER"       -> "Assigned Approver";
                case "TRAINING_COORDINATOR"    -> "Training Coordinator";
                case "ACCESS_PROFILE"          -> "Access Profile";
                case "PERMISSION"              -> "Permission";
                case "WORKFLOW_ROLE"           -> "Workflow Role";
                case "DOCUMENT_WORKFLOW_POOL"  -> "Document Workflow Pool";
                case "DEPARTMENT_MANAGER"      -> "Department Manager";
                default -> code;
            };
        }

        static String actorDisplayName(String actorTypeCode, String actorCode) {
            String base = actorType(actorTypeCode);
            if (actorCode != null && !actorCode.isBlank()) return base + " (" + actorCode + ")";
            return base;
        }
    }
}
