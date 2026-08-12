package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import org.springframework.security.access.AccessDeniedException;
import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.dto.settings.SecurityChangeRequest;
import com.eqms.dto.user.WorkflowRoleCatalogRequest;
import com.eqms.dto.user.WorkflowRoleCatalogResponse;
import com.eqms.dto.user.PageResponse;
import com.eqms.dto.user.PaginationResponse;
import com.eqms.entity.UserAccount;
import com.eqms.entity.WorkflowRole;
import com.eqms.repository.WorkflowRoleRepository;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;

import jakarta.persistence.criteria.Predicate;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;

/**
 * CRUD service for the Workflow Roles catalog (see
 * docs/SECURITY_AUTHORIZATION_IMPLEMENTATION_PLAN.md 0.5a). Replaces the
 * hardcoded {@code WorkflowRoleCode} enum + {@code WorkflowPoolTypes}
 * constants with a DB-backed, admin-manageable catalog. Follows the same
 * e-signature + audit trail pattern as {@link PermissionSetService}.
 */
@Service
public class WorkflowRoleCatalogService {

    private static final String ENTITY_TYPE = "WORKFLOW_ROLE";
    private static final String VIEW_PERMISSION = "security.workflow_authorization.view";
    private static final String MANAGE_PERMISSION = "security.workflow_authorization.manage";

    private final WorkflowRoleRepository workflowRoleRepository;
    private final CurrentUserService currentUserService;
    private final AuditTrailService auditTrailService;
    private final PermissionEvaluationService permissionEvaluationService;
    private final SecurityChangeSignatureService securityChangeSignatureService;

    public WorkflowRoleCatalogService(
            WorkflowRoleRepository workflowRoleRepository,
            CurrentUserService currentUserService,
            AuditTrailService auditTrailService,
            PermissionEvaluationService permissionEvaluationService,
            SecurityChangeSignatureService securityChangeSignatureService) {
        this.workflowRoleRepository = workflowRoleRepository;
        this.currentUserService = currentUserService;
        this.auditTrailService = auditTrailService;
        this.permissionEvaluationService = permissionEvaluationService;
        this.securityChangeSignatureService = securityChangeSignatureService;
    }

    @Transactional
    public List<WorkflowRoleCatalogResponse> listAll() {
        requireView();
        return workflowRoleRepository.findAllByOrderByDisplayOrderAscLabelAsc()
                .stream().map(this::toResponse).toList();
    }

    /**
     * Server-side list used by the Workflow Role Catalog.  Keeping filtering and
     * pagination here prevents an administrator browser from loading the whole
     * catalog as more GMP modules register their own workflow participants.
     */
    @Transactional
    public PageResponse<WorkflowRoleCatalogResponse> listPage(
            int page, int limit, String search, String module, String type, String status,
            String sortBy, String sortDir) {
        return listPage(page, limit, search, module, type, status,
                null, null, null, null, sortBy, sortDir);
    }

    @Transactional
    public PageResponse<WorkflowRoleCatalogResponse> listPage(
            int page, int limit, String search, String module, String type, String status,
            String createdFrom, String createdTo, String updatedFrom, String updatedTo,
            String sortBy, String sortDir) {
        requireView();
        int safePage = Math.max(page, 1);
        int safeLimit = Math.min(Math.max(limit, 1), 100);
        String sortProperty = switch (sortBy == null ? "" : sortBy) {
            case "code", "label", "moduleKey", "displayOrder", "createdAt", "updatedAt" -> sortBy;
            default -> "displayOrder";
        };
        Sort.Direction direction = "desc".equalsIgnoreCase(sortDir) ? Sort.Direction.DESC : Sort.Direction.ASC;
        Pageable pageable = PageRequest.of(safePage - 1, safeLimit,
                Sort.by(direction, sortProperty).and(Sort.by(Sort.Direction.ASC, "label")));

        Specification<WorkflowRole> specification = (root, query, builder) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (StringUtils.hasText(search)) {
                String term = "%" + search.trim().toLowerCase(Locale.ROOT) + "%";
                predicates.add(builder.or(
                        builder.like(builder.lower(root.get("code")), term),
                        builder.like(builder.lower(root.get("label")), term),
                        builder.like(builder.lower(root.get("moduleKey")), term)));
            }
            if (StringUtils.hasText(module) && !"ALL".equalsIgnoreCase(module)) {
                predicates.add(builder.equal(builder.lower(root.get("moduleKey")), module.trim().toLowerCase(Locale.ROOT)));
            }
            if ("SYSTEM".equalsIgnoreCase(type)) {
                predicates.add(builder.isTrue(root.get("system")));
            } else if ("CUSTOM".equalsIgnoreCase(type)) {
                predicates.add(builder.isFalse(root.get("system")));
            }
            if ("ACTIVE".equalsIgnoreCase(status)) {
                predicates.add(builder.isTrue(root.get("active")));
            } else if ("INACTIVE".equalsIgnoreCase(status)) {
                predicates.add(builder.isFalse(root.get("active")));
            }
            Instant createdStart = parseDayStart(createdFrom);
            Instant createdEnd = parseDayEndExclusive(createdTo);
            Instant updatedStart = parseDayStart(updatedFrom);
            Instant updatedEnd = parseDayEndExclusive(updatedTo);
            if (createdStart != null) predicates.add(builder.greaterThanOrEqualTo(root.get("createdAt"), createdStart));
            if (createdEnd != null) predicates.add(builder.lessThan(root.get("createdAt"), createdEnd));
            if (updatedStart != null) predicates.add(builder.greaterThanOrEqualTo(root.get("updatedAt"), updatedStart));
            if (updatedEnd != null) predicates.add(builder.lessThan(root.get("updatedAt"), updatedEnd));
            return builder.and(predicates.toArray(Predicate[]::new));
        };
        Page<WorkflowRole> result = workflowRoleRepository.findAll(specification, pageable);
        return new PageResponse<>(result.getContent().stream().map(this::toResponse).toList(),
                new PaginationResponse(safePage, safeLimit, result.getTotalElements(), result.getTotalPages()));
    }

    @Transactional
    public List<String> listModuleKeys() {
        requireView();
        return workflowRoleRepository.findDistinctModuleKeys();
    }

    @Transactional
    public WorkflowRoleCatalogResponse getById(UUID id) {
        requireView();
        return toResponse(require(id));
    }

    @Transactional
    public WorkflowRoleCatalogResponse create(WorkflowRoleCatalogRequest request) {
        requireManage();
        UserAccount actor = currentUserService.requireCurrentUser();
        securityChangeSignatureService.requireValidToken(actor, request.signatureToken());

        if (!StringUtils.hasText(request.code())) {
            throw new IllegalArgumentException("Workflow role code is required");
        }
        if (!StringUtils.hasText(request.label())) {
            throw new IllegalArgumentException("Workflow role label is required");
        }
        if (!StringUtils.hasText(request.moduleKey())) {
            throw new IllegalArgumentException("Workflow role module is required");
        }
        String code = request.code().trim().toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9_]", "_");
        if (workflowRoleRepository.findByCodeIgnoreCase(code).isPresent()) {
            throw new IllegalArgumentException("A workflow role with code \"" + code + "\" already exists");
        }

        WorkflowRole role = new WorkflowRole();
        role.setCode(code);
        role.setLabel(request.label().trim());
        role.setModuleKey(request.moduleKey().trim().toLowerCase(Locale.ROOT));
        role.setDescription(request.description());
        role.setDisplayOrder(request.displayOrder() != null ? request.displayOrder() : 100);
        role.setActive(request.active());
        role.setSystem(false);
        role.setCreatedBy(actor);
        role.setUpdatedBy(actor);
        workflowRoleRepository.save(role);

        List<AuditTrailChangeResponse> changes = new ArrayList<>();
        addChange(changes, "Code", null, role.getCode());
        addChange(changes, "Label", null, role.getLabel());
        addChange(changes, "Module", null, role.getModuleKey());
        addChange(changes, "Status", null, role.isActive() ? "Active" : "Inactive");

        auditTrailService.log(
                ENTITY_TYPE, role.getLabel(), role.getId(), "CREATED",
                null, role.isActive() ? "Active" : "Inactive",
                "Created workflow role " + role.getCode(), changes);

        securityChangeSignatureService.record(actor, request.signatureToken(),
                SecurityChangeSignatureService.MEANING_WORKFLOW_AUTHORIZATION_CHANGE,
                ENTITY_TYPE, role.getId(), role.getLabel(), request.reason(), null, role.getCode());

        return toResponse(workflowRoleRepository.findById(role.getId()).orElseThrow());
    }

    @Transactional
    public WorkflowRoleCatalogResponse update(UUID id, WorkflowRoleCatalogRequest request) {
        requireManage();
        UserAccount actor = currentUserService.requireCurrentUser();
        securityChangeSignatureService.requireValidToken(actor, request.signatureToken());
        WorkflowRole role = require(id);

        if (!StringUtils.hasText(request.label())) {
            throw new IllegalArgumentException("Workflow role label is required");
        }
        if (!StringUtils.hasText(request.moduleKey())) {
            throw new IllegalArgumentException("Workflow role module is required");
        }
        if (role.isSystem() && !request.active()) {
            throw new IllegalArgumentException("System workflow roles cannot be deactivated");
        }
        if (role.isSystem() && !role.getModuleKey().equalsIgnoreCase(request.moduleKey().trim())) {
            throw new IllegalArgumentException("System workflow role module cannot be changed");
        }

        String oldLabel = role.getLabel();
        String oldModule = role.getModuleKey();
        String oldDescription = role.getDescription();
        boolean oldActive = role.isActive();
        int oldDisplayOrder = role.getDisplayOrder();

        // Code is immutable once created — renaming is done via label only
        // (see plan criterion: DCO label rename requires no code change).
        role.setLabel(request.label().trim());
        role.setModuleKey(request.moduleKey().trim().toLowerCase(Locale.ROOT));
        role.setDescription(request.description());
        role.setDisplayOrder(request.displayOrder() != null ? request.displayOrder() : role.getDisplayOrder());
        role.setActive(request.active());
        role.setUpdatedBy(actor);

        List<AuditTrailChangeResponse> changes = new ArrayList<>();
        addChange(changes, "Label", oldLabel, role.getLabel());
        addChange(changes, "Module", oldModule, role.getModuleKey());
        addChange(changes, "Description", oldDescription, role.getDescription());
        addChange(changes, "Display Order", String.valueOf(oldDisplayOrder), String.valueOf(role.getDisplayOrder()));
        addChange(changes, "Status", oldActive ? "Active" : "Inactive", role.isActive() ? "Active" : "Inactive");

        auditTrailService.log(
                ENTITY_TYPE, role.getLabel(), role.getId(), "UPDATED",
                oldActive ? "Active" : "Inactive", role.isActive() ? "Active" : "Inactive",
                "Updated workflow role " + role.getCode(), changes);

        securityChangeSignatureService.record(actor, request.signatureToken(),
                SecurityChangeSignatureService.MEANING_WORKFLOW_AUTHORIZATION_CHANGE,
                ENTITY_TYPE, role.getId(), role.getLabel(), request.reason(), oldLabel, role.getLabel());

        return toResponse(workflowRoleRepository.save(role));
    }

    @Transactional
    public void deactivate(UUID id, SecurityChangeRequest sig) {
        requireManage();
        UserAccount actor = currentUserService.requireCurrentUser();
        SecurityChangeRequest s = SecurityChangeRequest.orEmpty(sig);
        securityChangeSignatureService.requireValidToken(actor, s.signatureToken());
        WorkflowRole role = require(id);
        if (role.isSystem()) {
            throw new IllegalArgumentException("System workflow roles cannot be deleted or deactivated");
        }
        boolean oldActive = role.isActive();
        role.setActive(false);
        role.setUpdatedBy(actor);
        workflowRoleRepository.save(role);

        auditTrailService.log(
                ENTITY_TYPE, role.getLabel(), role.getId(), "DEACTIVATED",
                oldActive ? "Active" : "Inactive", "Inactive",
                "Deactivated workflow role " + role.getCode(), List.of());

        securityChangeSignatureService.record(actor, s.signatureToken(),
                SecurityChangeSignatureService.MEANING_WORKFLOW_AUTHORIZATION_CHANGE,
                ENTITY_TYPE, role.getId(), role.getLabel(), s.reason(), "Active", "Inactive");
    }

    private WorkflowRole require(UUID id) {
        return workflowRoleRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Workflow role not found: " + id));
    }

    private void requireView() {
        UserAccount user = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.isSuperAdmin(user)
                && !permissionEvaluationService.hasAnyPermission(user, VIEW_PERMISSION, MANAGE_PERMISSION)) {
            throw new AccessDeniedException("Workflow authorization view permission required");
        }
    }

    private void requireManage() {
        UserAccount user = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.isSuperAdmin(user)
                && !permissionEvaluationService.hasAnyPermission(user, MANAGE_PERMISSION)) {
            throw new AccessDeniedException("Workflow authorization management permission required");
        }
    }

    private void addChange(List<AuditTrailChangeResponse> changes, String field, String oldValue, String newValue) {
        if (!Objects.equals(oldValue, newValue)) {
            changes.add(new AuditTrailChangeResponse(field, oldValue, newValue));
        }
    }

    private static final DateTimeFormatter DATE_QUERY_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    /** DateRangePicker submits local calendar dates; end date is inclusive for the user. */
    private Instant parseDayStart(String value) {
        LocalDate date = parseFilterDate(value);
        return date == null ? null : date.atStartOfDay(ZoneId.systemDefault()).toInstant();
    }

    private Instant parseDayEndExclusive(String value) {
        LocalDate date = parseFilterDate(value);
        return date == null ? null : date.plusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant();
    }

    private LocalDate parseFilterDate(String value) {
        if (!StringUtils.hasText(value)) return null;
        try {
            return LocalDate.parse(value.trim(), DATE_QUERY_FORMAT);
        } catch (DateTimeParseException ignored) {
            return null;
        }
    }

    private WorkflowRoleCatalogResponse toResponse(WorkflowRole role) {
        return new WorkflowRoleCatalogResponse(
                role.getId(), role.getCode(), role.getLabel(), role.getModuleKey(),
                role.getDescription(), role.getDisplayOrder(), role.isActive(), role.isSystem(),
                role.getCreatedAt(), role.getUpdatedAt());
    }
}
