package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import org.springframework.security.access.AccessDeniedException;
import com.eqms.dto.security.LifecycleStatePolicyDtos.LifecycleStatePolicyOptionsResponse;
import com.eqms.dto.security.LifecycleStatePolicyDtos.LifecycleStatePolicyRequest;
import com.eqms.dto.security.LifecycleStatePolicyDtos.LifecycleStatePolicyResponse;
import com.eqms.dto.security.LifecycleStatePolicyDtos.OptionItem;
import com.eqms.entity.DocumentType;
import com.eqms.entity.LifecycleStatePolicy;
import com.eqms.entity.UserAccount;
import com.eqms.enums.LifecycleActorScope;
import com.eqms.enums.LifecycleCapability;
import com.eqms.repository.DocumentTypeRepository;
import com.eqms.repository.LifecycleStatePolicyRepository;
import com.eqms.repository.PermissionRepository;
import com.eqms.repository.RevisionStatusDefinitionRepository;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class LifecycleStatePolicyService {

    private static final String VIEW_PERMISSION = "security.workflow_authorization.view";
    private static final String MANAGE_PERMISSION = "security.workflow_authorization.manage";
    private static final String AUDIT_ENTITY = "LIFECYCLE_STATE_POLICY";

    private final LifecycleStatePolicyRepository policyRepository;
    private final RevisionStatusDefinitionRepository revisionStatusDefinitionRepository;
    private final PermissionRepository permissionRepository;
    private final DocumentTypeRepository documentTypeRepository;
    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissionEvaluationService;
    private final AuditTrailService auditTrailService;
    private final SecurityChangeSignatureService securityChangeSignatureService;

    public LifecycleStatePolicyService(
            LifecycleStatePolicyRepository policyRepository,
            RevisionStatusDefinitionRepository revisionStatusDefinitionRepository,
            PermissionRepository permissionRepository,
            DocumentTypeRepository documentTypeRepository,
            CurrentUserService currentUserService,
            PermissionEvaluationService permissionEvaluationService,
            AuditTrailService auditTrailService,
            SecurityChangeSignatureService securityChangeSignatureService) {
        this.policyRepository = policyRepository;
        this.revisionStatusDefinitionRepository = revisionStatusDefinitionRepository;
        this.permissionRepository = permissionRepository;
        this.documentTypeRepository = documentTypeRepository;
        this.currentUserService = currentUserService;
        this.permissionEvaluationService = permissionEvaluationService;
        this.auditTrailService = auditTrailService;
        this.securityChangeSignatureService = securityChangeSignatureService;
    }

    @Transactional
    public List<LifecycleStatePolicyResponse> listAll() {
        requireView();
        Map<String, String> statusLabels = statusLabelMap();
        Map<UUID, String> documentTypeNames = documentTypeNameMap();
        return policyRepository.findAllByOrderByCapabilityCodeAscPriorityDescCreatedAtAsc()
                .stream()
                .map(p -> toResponse(p, statusLabels, documentTypeNames))
                .toList();
    }

    /** Server-side list: search, filters, sort and pagination resolved here. */
    @Transactional
    public com.eqms.dto.user.PageResponse<LifecycleStatePolicyResponse> listPaged(
            int page, int limit, String search, String capability, String statusCode,
            String actorScope, String type, String active, String createdFrom, String createdTo,
            String updatedFrom, String updatedTo, String sortBy, String sortDir) {
        java.util.List<LifecycleStatePolicyResponse> filtered = listAll().stream()
                .filter(p2 -> {
                    if (StringHelperHasText(capability) && !"ALL".equalsIgnoreCase(capability)
                            && !p2.capabilityCode().equals(capability)) return false;
                    if (StringHelperHasText(statusCode) && !"ALL".equalsIgnoreCase(statusCode)
                            && !statusCode.equals(p2.statusCode())) return false;
                    if (StringHelperHasText(actorScope) && !"ALL".equalsIgnoreCase(actorScope)
                            && !p2.actorScope().equals(actorScope)) return false;
                    if ("SYSTEM".equalsIgnoreCase(type) && !p2.system()) return false;
                    if ("CUSTOM".equalsIgnoreCase(type) && p2.system()) return false;
                    if ("ACTIVE".equalsIgnoreCase(active) && !p2.active()) return false;
                    if ("INACTIVE".equalsIgnoreCase(active) && p2.active()) return false;
                    if (!com.eqms.util.DateRangeFilter.matches(p2.createdAt(), createdFrom, createdTo)) return false;
                    if (!com.eqms.util.DateRangeFilter.matches(p2.updatedAt(), updatedFrom, updatedTo)) return false;
                    String q = search == null ? "" : search.trim().toLowerCase(java.util.Locale.ROOT);
                    if (q.isEmpty()) return true;
                    return (p2.capabilityCode() + " " + (p2.statusLabel() == null ? "" : p2.statusLabel()) + " "
                            + (p2.documentTypeName() == null ? "" : p2.documentTypeName()) + " " + p2.actorScope() + " "
                            + (p2.requiredPermissionCode() == null ? "" : p2.requiredPermissionCode()))
                            .toLowerCase(java.util.Locale.ROOT).contains(q);
                })
                .collect(java.util.stream.Collectors.toList());
        java.util.Comparator<LifecycleStatePolicyResponse> cmp = switch (sortBy == null ? "capability" : sortBy) {
            case "priority" -> java.util.Comparator.comparingInt(LifecycleStatePolicyResponse::priority);
            case "status" -> java.util.Comparator.comparing(p2 -> p2.statusCode() == null ? "" : p2.statusCode());
            case "actorScope" -> java.util.Comparator.comparing(LifecycleStatePolicyResponse::actorScope);
            case "type" -> java.util.Comparator.comparing(p2 -> p2.system() ? 0 : 1);
            case "createdAt" -> java.util.Comparator.comparing(LifecycleStatePolicyResponse::createdAt);
            case "updatedAt" -> java.util.Comparator.comparing(LifecycleStatePolicyResponse::updatedAt);
            default -> java.util.Comparator.comparing(LifecycleStatePolicyResponse::capabilityCode);
        };
        if ("desc".equalsIgnoreCase(sortDir)) cmp = cmp.reversed();
        filtered.sort(cmp);
        return com.eqms.util.PagedList.paginate(filtered, page, limit);
    }

    private static boolean StringHelperHasText(String v) {
        return org.springframework.util.StringUtils.hasText(v);
    }

    @Transactional
    public LifecycleStatePolicyResponse getById(UUID id) {
        requireView();
        return toResponse(require(id), statusLabelMap(), documentTypeNameMap());
    }

    @Transactional
    public LifecycleStatePolicyOptionsResponse getOptions() {
        requireView();
        return new LifecycleStatePolicyOptionsResponse(
                Arrays.stream(LifecycleCapability.values()).map(Enum::name).toList(),
                Arrays.stream(LifecycleActorScope.values()).map(Enum::name).toList(),
                revisionStatusDefinitionRepository.findAllByOrderBySortOrderAsc().stream()
                        .map(s -> new OptionItem(s.getCode(), s.getLabel()))
                        .toList(),
                permissionRepository.findAllByModuleKeyIgnoreCaseOrderByDisplayOrderAscCodeAsc("documents").stream()
                        .map(p -> new OptionItem(p.getCode(), p.getName()))
                        .toList(),
                documentTypeRepository.findAllByActiveTrueOrderByNameAsc().stream()
                        .map(t -> new OptionItem(t.getId().toString(), t.getName()))
                        .toList());
    }

    @Transactional
    public LifecycleStatePolicyResponse create(LifecycleStatePolicyRequest request) {
        requireManage();
        UserAccount actor = currentUserService.requireCurrentUser();
        securityChangeSignatureService.requireValidToken(actor, request.signatureToken());
        validate(request);

        LifecycleStatePolicy policy = new LifecycleStatePolicy();
        applyRequest(policy, request);
        policy.setCreatedBy(actor.getId());
        policy.setUpdatedBy(actor.getId());
        policyRepository.save(policy);

        auditTrailService.log(AUDIT_ENTITY, policyName(policy), policy.getId(),
                "CREATED", null, policy.isActive() ? "Active" : "Inactive",
                "Created lifecycle state policy " + policyName(policy));
        securityChangeSignatureService.record(actor, request.signatureToken(),
                SecurityChangeSignatureService.MEANING_WORKFLOW_AUTHORIZATION_CHANGE,
                AUDIT_ENTITY, policy.getId(), policyName(policy), request.reason(),
                null, policyName(policy));
        return toResponse(policy, statusLabelMap(), documentTypeNameMap());
    }

    @Transactional
    public LifecycleStatePolicyResponse update(UUID id, LifecycleStatePolicyRequest request) {
        requireManage();
        UserAccount actor = currentUserService.requireCurrentUser();
        securityChangeSignatureService.requireValidToken(actor, request.signatureToken());
        validate(request);

        LifecycleStatePolicy policy = require(id);
        String oldSummary = policyName(policy);
        String oldStatus = policy.isActive() ? "Active" : "Inactive";
        applyRequest(policy, request);
        policy.setUpdatedBy(actor.getId());
        policyRepository.save(policy);

        auditTrailService.log(AUDIT_ENTITY, policyName(policy), policy.getId(),
                "UPDATED", oldStatus, policy.isActive() ? "Active" : "Inactive",
                "Updated lifecycle state policy " + policyName(policy));
        securityChangeSignatureService.record(actor, request.signatureToken(),
                SecurityChangeSignatureService.MEANING_WORKFLOW_AUTHORIZATION_CHANGE,
                AUDIT_ENTITY, policy.getId(), policyName(policy), request.reason(),
                oldSummary, policyName(policy));
        return toResponse(policy, statusLabelMap(), documentTypeNameMap());
    }

    @Transactional
    public void delete(UUID id, com.eqms.dto.settings.SecurityChangeRequest sig) {
        requireManage();
        UserAccount actor = currentUserService.requireCurrentUser();
        sig = com.eqms.dto.settings.SecurityChangeRequest.orEmpty(sig);
        securityChangeSignatureService.requireValidToken(actor, sig.signatureToken());
        LifecycleStatePolicy policy = require(id);
        if (policy.isSystem()) {
            throw new IllegalArgumentException("System lifecycle state policies cannot be deleted. Deactivate instead.");
        }
        auditTrailService.log(AUDIT_ENTITY, policyName(policy), policy.getId(),
                "DELETED", policy.isActive() ? "Active" : "Inactive", null,
                "Deleted lifecycle state policy " + policyName(policy));
        policyRepository.delete(policy);
        securityChangeSignatureService.record(actor, sig.signatureToken(),
                SecurityChangeSignatureService.MEANING_WORKFLOW_AUTHORIZATION_CHANGE,
                AUDIT_ENTITY, id, policyName(policy), sig.reason(),
                policyName(policy), null);
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private void validate(LifecycleStatePolicyRequest request) {
        try {
            LifecycleCapability.valueOf(request.capabilityCode());
        } catch (IllegalArgumentException | NullPointerException ex) {
            throw new IllegalArgumentException("Invalid capability: " + request.capabilityCode());
        }
        try {
            LifecycleActorScope.valueOf(request.actorScope());
        } catch (IllegalArgumentException | NullPointerException ex) {
            throw new IllegalArgumentException("Invalid actor scope: " + request.actorScope());
        }
        if (request.statusCode() != null
                && revisionStatusDefinitionRepository.findById(request.statusCode()).isEmpty()) {
            throw new IllegalArgumentException("Unknown revision status: " + request.statusCode());
        }
        if (request.documentTypeId() != null
                && documentTypeRepository.findById(request.documentTypeId()).isEmpty()) {
            throw new IllegalArgumentException("Unknown document type: " + request.documentTypeId());
        }
        if (StringUtils.hasText(request.requiredPermissionCode())
                && permissionRepository.findByCode(request.requiredPermissionCode().trim()).isEmpty()) {
            throw new IllegalArgumentException("Unknown required permission: " + request.requiredPermissionCode());
        }
    }

    private void applyRequest(LifecycleStatePolicy policy, LifecycleStatePolicyRequest request) {
        policy.setCapabilityCode(request.capabilityCode());
        policy.setStatusCode(request.statusCode());
        policy.setDocumentTypeId(request.documentTypeId());
        policy.setActorScope(request.actorScope());
        policy.setRequiredPermissionCode(
                request.requiredPermissionCode() == null || request.requiredPermissionCode().isBlank()
                        ? null : request.requiredPermissionCode().trim());
        policy.setPriority(request.priority() != null ? request.priority() : 100);
        policy.setActive(request.active() == null || request.active());
        policy.setDescription(request.description());
    }

    private String policyName(LifecycleStatePolicy policy) {
        return policy.getCapabilityCode()
                + " @ " + (policy.getStatusCode() == null ? "ANY_STATUS" : policy.getStatusCode())
                + " [" + policy.getActorScope() + "]";
    }

    private LifecycleStatePolicy require(UUID id) {
        return policyRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Lifecycle state policy not found: " + id));
    }

    private Map<String, String> statusLabelMap() {
        return revisionStatusDefinitionRepository.findAll().stream()
                .collect(Collectors.toMap(s -> s.getCode(), s -> s.getLabel(), (a, b) -> a));
    }

    private Map<UUID, String> documentTypeNameMap() {
        return documentTypeRepository.findAll().stream()
                .collect(Collectors.toMap(DocumentType::getId, DocumentType::getName, (a, b) -> a));
    }

    private void requireView() {
        UserAccount u = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.isSuperAdmin(u)
                && !permissionEvaluationService.hasAnyPermission(u, VIEW_PERMISSION, MANAGE_PERMISSION)) {
            throw new AccessDeniedException("Workflow authorization view permission required");
        }
    }

    private void requireManage() {
        UserAccount u = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.isSuperAdmin(u)
                && !permissionEvaluationService.hasPermission(u, MANAGE_PERMISSION)) {
            throw new AccessDeniedException("Workflow authorization management permission required");
        }
    }

    private LifecycleStatePolicyResponse toResponse(
            LifecycleStatePolicy p, Map<String, String> statusLabels, Map<UUID, String> documentTypeNames) {
        return new LifecycleStatePolicyResponse(
                p.getId(), p.getModuleKey(), p.getObjectType(), p.getCapabilityCode(),
                p.getStatusCode(),
                p.getStatusCode() == null ? null : statusLabels.getOrDefault(p.getStatusCode(), p.getStatusCode()),
                p.getDocumentTypeId(),
                p.getDocumentTypeId() == null ? null : documentTypeNames.get(p.getDocumentTypeId()),
                p.getActorScope(), p.getRequiredPermissionCode(), p.getPriority(),
                p.isActive(), p.isSystem(), p.getDescription(), p.getCreatedAt(), p.getUpdatedAt());
    }
}
