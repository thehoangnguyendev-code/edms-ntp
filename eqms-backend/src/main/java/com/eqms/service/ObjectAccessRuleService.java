package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import org.springframework.security.access.AccessDeniedException;
import com.eqms.dto.user.ObjectAccessRuleOptionsResponse;
import com.eqms.dto.user.ObjectAccessRuleRequest;
import com.eqms.service.PermissionEvaluationService;
import com.eqms.dto.user.ObjectAccessRuleResponse;
import com.eqms.entity.ObjectAccessRule;
import com.eqms.entity.RoleDefinition;
import com.eqms.entity.UserAccount;
import com.eqms.enums.ObjectAccessAction;
import com.eqms.enums.ObjectResourceType;
import com.eqms.repository.DocumentStatusDefinitionRepository;
import com.eqms.repository.DocumentSubTypeRepository;
import com.eqms.repository.DocumentTypeRepository;
import com.eqms.repository.ObjectAccessRuleRepository;
import com.eqms.repository.RoleDefinitionRepository;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class ObjectAccessRuleService {
    private static final String VIEW_PERMISSION = "security.object_rules.view";
    private static final String MANAGE_PERMISSION = "security.object_rules.manage";

    private final ObjectAccessRuleRepository ruleRepository;
    private final RoleDefinitionRepository roleRepository;
    private final DocumentSubTypeRepository documentSubTypeRepository;
    private final DocumentTypeRepository documentTypeRepository;
    private final DocumentStatusDefinitionRepository documentStatusDefinitionRepository;
    private final CurrentUserService currentUserService;
    private final AuditTrailService auditTrailService;
    private final PermissionEvaluationService permissionEvaluationService;
    private final SecurityChangeSignatureService securityChangeSignatureService;

    public ObjectAccessRuleService(
            ObjectAccessRuleRepository ruleRepository,
            RoleDefinitionRepository roleRepository,
            DocumentSubTypeRepository documentSubTypeRepository,
            DocumentTypeRepository documentTypeRepository,
            DocumentStatusDefinitionRepository documentStatusDefinitionRepository,
            CurrentUserService currentUserService,
            AuditTrailService auditTrailService,
            PermissionEvaluationService permissionEvaluationService,
            SecurityChangeSignatureService securityChangeSignatureService) {
        this.ruleRepository = ruleRepository;
        this.roleRepository = roleRepository;
        this.documentSubTypeRepository = documentSubTypeRepository;
        this.documentTypeRepository = documentTypeRepository;
        this.documentStatusDefinitionRepository = documentStatusDefinitionRepository;
        this.currentUserService = currentUserService;
        this.auditTrailService = auditTrailService;
        this.permissionEvaluationService = permissionEvaluationService;
        this.securityChangeSignatureService = securityChangeSignatureService;
    }

    @Transactional
    public List<ObjectAccessRuleResponse> listAll() {
        requireView();
        return ruleRepository.findAllByOrderByPriorityDescNameAsc()
                .stream().map(this::toResponse).toList();
    }

    /** Server-side list: search, filters, sort and pagination resolved here. */
    @Transactional
    public com.eqms.dto.user.PageResponse<ObjectAccessRuleResponse> listPaged(
            int page, int limit, String search, String resourceType, String effect,
            String status, String createdFrom, String createdTo, String updatedFrom, String updatedTo,
            String sortBy, String sortDir) {
        requireView();
        String q = search == null ? "" : search.trim().toLowerCase(java.util.Locale.ROOT);
        java.util.List<ObjectAccessRuleResponse> filtered = ruleRepository.findAllByOrderByPriorityDescNameAsc()
                .stream().map(this::toResponse)
                .filter(r -> {
                    if (org.springframework.util.StringUtils.hasText(resourceType)
                            && !"ALL".equalsIgnoreCase(resourceType) && !r.resourceType().equals(resourceType)) return false;
                    if (org.springframework.util.StringUtils.hasText(effect)
                            && !"ALL".equalsIgnoreCase(effect) && !r.effect().equalsIgnoreCase(effect)) return false;
                    if ("ACTIVE".equalsIgnoreCase(status) && !r.active()) return false;
                    if ("INACTIVE".equalsIgnoreCase(status) && r.active()) return false;
                    if (!com.eqms.util.DateRangeFilter.matches(r.createdAt(), createdFrom, createdTo)) return false;
                    if (!com.eqms.util.DateRangeFilter.matches(r.updatedAt(), updatedFrom, updatedTo)) return false;
                    if (q.isEmpty()) return true;
                    return (r.name() + " " + (r.description() == null ? "" : r.description()) + " "
                            + r.resourceType() + " " + (r.resourceName() == null ? "" : r.resourceName()))
                            .toLowerCase(java.util.Locale.ROOT).contains(q);
                })
                .collect(java.util.stream.Collectors.toList());
        java.util.Comparator<ObjectAccessRuleResponse> cmp = switch (sortBy == null ? "priority" : sortBy) {
            case "name" -> java.util.Comparator.comparing(ObjectAccessRuleResponse::name, String.CASE_INSENSITIVE_ORDER);
            case "resourceType" -> java.util.Comparator.comparing(ObjectAccessRuleResponse::resourceType);
            case "effect" -> java.util.Comparator.comparing(ObjectAccessRuleResponse::effect);
            case "createdAt" -> java.util.Comparator.comparing(ObjectAccessRuleResponse::createdAt);
            case "updatedAt" -> java.util.Comparator.comparing(ObjectAccessRuleResponse::updatedAt);
            default -> java.util.Comparator.comparingInt(ObjectAccessRuleResponse::priority);
        };
        if ("desc".equalsIgnoreCase(sortDir)) cmp = cmp.reversed();
        filtered.sort(cmp);
        return com.eqms.util.PagedList.paginate(filtered, page, limit);
    }

    @Transactional
    public ObjectAccessRuleOptionsResponse getOptions() {
        requireView();
        Map<String, List<String>> resourceValues = Map.of(
                ObjectResourceType.DOCUMENT_CATEGORY.name(),
                documentSubTypeRepository.findAllByOrderByNameAsc().stream()
                        .map(s -> s.getName()).distinct().toList(),
                ObjectResourceType.DOCUMENT_TYPE.name(),
                documentTypeRepository.findAllByActiveTrueOrderByNameAsc().stream()
                        .map(t -> t.getName()).toList(),
                ObjectResourceType.DOCUMENT_STATUS.name(),
                documentStatusDefinitionRepository.findAllByOrderBySortOrderAsc().stream()
                        .map(s -> s.getCode()).toList());
        return new ObjectAccessRuleOptionsResponse(
                Arrays.stream(ObjectResourceType.values()).map(Enum::name).toList(),
                Arrays.stream(ObjectAccessAction.values()).map(Enum::name).toList(),
                List.of("ALLOW", "DENY"),
                resourceValues,
                roleRepository.findAll().stream()
                        .filter(RoleDefinition::isActive)
                        .sorted(java.util.Comparator.comparing(RoleDefinition::getName, String.CASE_INSENSITIVE_ORDER))
                        .map(profile -> new ObjectAccessRuleOptionsResponse.AccessProfileOption(
                                profile.getId(), profile.getName(), profile.getCode()))
                        .toList());
    }

    @Transactional
    public ObjectAccessRuleResponse getById(UUID id) {
        requireView();
        return toResponse(require(id));
    }

    @Transactional
    public ObjectAccessRuleResponse create(ObjectAccessRuleRequest request) {
        requireManage();
        UserAccount actor = currentUserService.requireCurrentUser();
        securityChangeSignatureService.requireValidToken(actor, request.signatureToken());

        ObjectAccessRule rule = new ObjectAccessRule();
        applyRequest(rule, request);
        rule.setCreatedBy(actor);
        rule.setUpdatedBy(actor);
        ruleRepository.save(rule);

        auditTrailService.log("OBJECT_ACCESS_RULE", rule.getName(), rule.getId(),
                "CREATED", null, "Active",
                "Created " + rule.getEffect() + " rule for " + rule.getResourceType());

        securityChangeSignatureService.record(actor, request.signatureToken(),
                SecurityChangeSignatureService.MEANING_SECURITY_CONFIGURATION_CHANGE,
                "OBJECT_ACCESS_RULE", rule.getId(), rule.getName(), request.reason(),
                null, rule.getEffect() + " rule for " + rule.getResourceType());
        return toResponse(rule);
    }

    @Transactional
    public ObjectAccessRuleResponse update(UUID id, ObjectAccessRuleRequest request) {
        requireManage();
        UserAccount actor = currentUserService.requireCurrentUser();
        securityChangeSignatureService.requireValidToken(actor, request.signatureToken());
        ObjectAccessRule rule = require(id);
        String oldStatus = rule.isActive() ? "Active" : "Inactive";

        applyRequest(rule, request);
        rule.setUpdatedBy(actor);
        ruleRepository.save(rule);

        auditTrailService.log("OBJECT_ACCESS_RULE", rule.getName(), rule.getId(),
                "UPDATED", oldStatus, rule.isActive() ? "Active" : "Inactive",
                "Updated object access rule");

        securityChangeSignatureService.record(actor, request.signatureToken(),
                SecurityChangeSignatureService.MEANING_SECURITY_CONFIGURATION_CHANGE,
                "OBJECT_ACCESS_RULE", rule.getId(), rule.getName(), request.reason(),
                oldStatus, rule.isActive() ? "Active" : "Inactive");
        return toResponse(rule);
    }

    @Transactional
    public void delete(UUID id, com.eqms.dto.settings.SecurityChangeRequest sig) {
        requireManage();
        UserAccount actor = currentUserService.requireCurrentUser();
        sig = com.eqms.dto.settings.SecurityChangeRequest.orEmpty(sig);
        securityChangeSignatureService.requireValidToken(actor, sig.signatureToken());
        ObjectAccessRule rule = require(id);
        auditTrailService.log("OBJECT_ACCESS_RULE", rule.getName(), rule.getId(),
                "DELETED", rule.isActive() ? "Active" : "Inactive", null,
                "Deleted object access rule");
        ruleRepository.delete(rule);
        securityChangeSignatureService.record(actor, sig.signatureToken(),
                SecurityChangeSignatureService.MEANING_SECURITY_CONFIGURATION_CHANGE,
                "OBJECT_ACCESS_RULE", id, rule.getName(), sig.reason(),
                rule.getEffect() + " rule for " + rule.getResourceType(), null);
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private void applyRequest(ObjectAccessRule rule, ObjectAccessRuleRequest req) {
        validateResourceType(req.resourceType());
        validateActions(req.actions());
        validateEffect(req.effect());
        validateResourceTarget(req.resourceType(), req.resourceId());

        rule.setName(req.name());
        rule.setDescription(req.description());
        rule.setResourceType(req.resourceType());
        rule.setResourceId(req.resourceId());
        rule.setResourceName(req.resourceName());
        rule.setActions(req.actions());
        rule.setEffect(req.effect() != null ? req.effect() : "ALLOW");
        rule.setPriority(req.priority());
        rule.setActive(req.active());

        if (req.accessProfileId() != null) {
            RoleDefinition profile = roleRepository.findById(req.accessProfileId())
                    .orElseThrow(() -> new IllegalArgumentException(
                            "Access Profile not found: " + req.accessProfileId()));
            rule.setAccessProfiles(java.util.Set.of(profile));
        } else {
            rule.setAccessProfiles(java.util.Set.of());
        }
    }

    private void validateResourceType(String resourceType) {
        try {
            ObjectResourceType.valueOf(resourceType);
        } catch (IllegalArgumentException | NullPointerException ex) {
            throw new IllegalArgumentException("Invalid resource type: " + resourceType);
        }
    }

    private void validateActions(List<String> actions) {
        if (actions == null || actions.isEmpty()) {
            throw new IllegalArgumentException("At least one action is required");
        }
        for (String action : actions) {
            try {
                ObjectAccessAction.valueOf(action);
            } catch (IllegalArgumentException | NullPointerException ex) {
                throw new IllegalArgumentException("Invalid action: " + action);
            }
        }
    }

    private void validateEffect(String effect) {
        if (effect == null) {
            return;
        }
        if (!"ALLOW".equalsIgnoreCase(effect) && !"DENY".equalsIgnoreCase(effect)) {
            throw new IllegalArgumentException("Object access rule effect must be ALLOW or DENY");
        }
    }

    private void validateResourceTarget(String resourceType, UUID resourceId) {
        if (resourceId == null) {
            return;
        }
        boolean exists = switch (ObjectResourceType.valueOf(resourceType)) {
            case DOCUMENT_CATEGORY -> documentSubTypeRepository.findById(resourceId).isPresent();
            case DOCUMENT_TYPE -> documentTypeRepository.findById(resourceId).isPresent();
            // Document status is keyed by a business code, while the rule model stores UUID resource IDs.
            // Status rules therefore use resourceName and must not supply resourceId.
            case DOCUMENT_STATUS -> false;
        };
        if (!exists) {
            throw new IllegalArgumentException("Resource does not exist for type " + resourceType + ": " + resourceId);
        }
    }

    private ObjectAccessRule require(UUID id) {
        return ruleRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Object access rule not found: " + id));
    }

    private void requireView() {
        UserAccount u = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.isSuperAdmin(u)
                && !permissionEvaluationService.hasAnyPermission(u, VIEW_PERMISSION, MANAGE_PERMISSION)) {
            throw new AccessDeniedException("Object access rule view permission required");
        }
    }

    private void requireManage() {
        UserAccount u = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.isSuperAdmin(u)
                && !permissionEvaluationService.hasPermission(u, MANAGE_PERMISSION)) {
            throw new AccessDeniedException("Object access rule management permission required");
        }
    }

    private ObjectAccessRuleResponse toResponse(ObjectAccessRule r) {
        return new ObjectAccessRuleResponse(
                r.getId(), r.getName(), r.getDescription(),
                !r.getAccessProfiles().isEmpty() ? r.getAccessProfiles().iterator().next().getId() : null,
                !r.getAccessProfiles().isEmpty() ? r.getAccessProfiles().iterator().next().getName() : null,
                r.getResourceType(), r.getResourceId(), r.getResourceName(),
                r.getActions(), r.getEffect(), r.getPriority(), r.isActive(),
                r.getCreatedAt(), r.getUpdatedAt());
    }
}
