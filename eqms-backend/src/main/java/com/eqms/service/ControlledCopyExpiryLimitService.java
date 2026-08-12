package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.controlledcopypolicy.ControlledCopyExpiryLimitRequest;
import com.eqms.dto.controlledcopypolicy.ControlledCopyExpiryLimitResponse;
import com.eqms.entity.ControlledCopyExpiryLimit;
import com.eqms.entity.Department;
import com.eqms.entity.DocumentType;
import com.eqms.entity.UserAccount;
import com.eqms.repository.ControlledCopyExpiryLimitRepository;
import com.eqms.repository.DepartmentRepository;
import com.eqms.repository.DocumentTypeRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

/**
 * QA/Document Control policy: how many days into the future a Controlled Copy expiry date is set,
 * scoped to document type and/or department. Every Controlled Copy always has an expiry — there is
 * a mandatory, non-deletable "Global Default" row (documentType = department = null, is_system =
 * true) guaranteeing a resolution always exists. Resolution picks the most specific active rule:
 * (documentType+department) > documentType-only > department-only > the Global Default row.
 */
@Service
public class ControlledCopyExpiryLimitService {

    private final ControlledCopyExpiryLimitRepository repository;
    private final DocumentTypeRepository documentTypeRepository;
    private final DepartmentRepository departmentRepository;
    private final PermissionEvaluationService permissionEvaluationService;
    private final CurrentUserService currentUserService;
    private final SecurityChangeSignatureService securityChangeSignatureService;

    public ControlledCopyExpiryLimitService(
            ControlledCopyExpiryLimitRepository repository,
            DocumentTypeRepository documentTypeRepository,
            DepartmentRepository departmentRepository,
            PermissionEvaluationService permissionEvaluationService,
            CurrentUserService currentUserService,
            SecurityChangeSignatureService securityChangeSignatureService
    ) {
        this.repository = repository;
        this.documentTypeRepository = documentTypeRepository;
        this.departmentRepository = departmentRepository;
        this.permissionEvaluationService = permissionEvaluationService;
        this.currentUserService = currentUserService;
        this.securityChangeSignatureService = securityChangeSignatureService;
    }

    @Transactional(readOnly = true)
    public List<ControlledCopyExpiryLimitResponse> list() {
        requireViewAccess();
        return repository.findAllByOrderByCreatedAtDesc().stream().map(this::toResponse).toList();
    }

    @Transactional
    public ControlledCopyExpiryLimitResponse create(ControlledCopyExpiryLimitRequest request) {
        UserAccount currentUser = requireManageAccess();
        requireSignature(currentUser, request);
        ControlledCopyExpiryLimit limit = new ControlledCopyExpiryLimit();
        applyRequest(limit, request);
        limit.setCreatedBy(currentUser.getId());
        limit.setUpdatedBy(currentUser.getId());
        ControlledCopyExpiryLimit saved = repository.save(limit);
        recordSignature(currentUser, request, saved, null, summarize(saved));
        return toResponse(saved);
    }

    @Transactional
    public ControlledCopyExpiryLimitResponse update(UUID id, ControlledCopyExpiryLimitRequest request) {
        UserAccount currentUser = requireManageAccess();
        requireSignature(currentUser, request);
        ControlledCopyExpiryLimit limit = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Expiry limit not found"));
        String previous = summarize(limit);
        applyRequest(limit, request);
        limit.setUpdatedBy(currentUser.getId());
        ControlledCopyExpiryLimit saved = repository.save(limit);
        recordSignature(currentUser, request, saved, previous, summarize(saved));
        return toResponse(saved);
    }

    @Transactional
    public void delete(UUID id, ControlledCopyExpiryLimitRequest request) {
        UserAccount currentUser = requireManageAccess();
        requireSignature(currentUser, request);
        ControlledCopyExpiryLimit limit = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Expiry limit not found"));
        if (limit.isSystem()) {
            throw new IllegalArgumentException("System-defined expiry limits cannot be deleted");
        }
        String previous = summarize(limit);
        repository.delete(limit);
        recordSignature(currentUser, request, limit, previous, "deleted");
    }

    private void requireSignature(UserAccount actor, ControlledCopyExpiryLimitRequest request) {
        securityChangeSignatureService.requireValidToken(actor, request == null ? null : request.signatureToken());
    }

    private void recordSignature(UserAccount actor, ControlledCopyExpiryLimitRequest request, ControlledCopyExpiryLimit limit, String previous, String current) {
        securityChangeSignatureService.record(actor, request == null ? null : request.signatureToken(),
                SecurityChangeSignatureService.MEANING_SECURITY_CONFIGURATION_CHANGE,
                "CONTROLLED_COPY_EXPIRY_LIMIT", limit.getId(), "Controlled Copy Expiry Rule",
                request == null ? null : request.reason(), previous, current);
    }

    private String summarize(ControlledCopyExpiryLimit limit) {
        return "documentType=" + (limit.getDocumentType() == null ? "Any" : limit.getDocumentType().getName())
                + ", department=" + (limit.getDepartment() == null ? "Any" : limit.getDepartment().getName())
                + ", durationDays=" + limit.getMaxDurationDays()
                + ", active=" + limit.isActive()
                + ", description=" + (limit.getDescription() == null ? "" : limit.getDescription());
    }

    /**
     * Resolves the expiry duration (in days) to apply for a document. Always resolves to a value
     * in practice, since the mandatory Global Default row guarantees a fallback match.
     * Priority: (documentType + department) > documentType-only > department-only > Global Default.
     */
    @Transactional(readOnly = true)
    public Integer resolveDurationDays(DocumentType documentType, Department department) {
        UUID documentTypeId = documentType == null ? null : documentType.getId();
        UUID departmentId = department == null ? null : department.getId();

        List<ControlledCopyExpiryLimit> active = repository.findAllByActiveTrue();

        Optional<ControlledCopyExpiryLimit> exactMatch = active.stream()
                .filter(limit -> matchesId(limit.getDocumentType() == null ? null : limit.getDocumentType().getId(), documentTypeId)
                        && matchesId(limit.getDepartment() == null ? null : limit.getDepartment().getId(), departmentId)
                        && limit.getDocumentType() != null && limit.getDepartment() != null)
                .min(Comparator.comparingInt(ControlledCopyExpiryLimit::getMaxDurationDays));
        if (exactMatch.isPresent()) {
            return exactMatch.get().getMaxDurationDays();
        }

        Optional<ControlledCopyExpiryLimit> documentTypeMatch = active.stream()
                .filter(limit -> limit.getDepartment() == null
                        && limit.getDocumentType() != null
                        && Objects.equals(limit.getDocumentType().getId(), documentTypeId))
                .min(Comparator.comparingInt(ControlledCopyExpiryLimit::getMaxDurationDays));
        if (documentTypeMatch.isPresent()) {
            return documentTypeMatch.get().getMaxDurationDays();
        }

        Optional<ControlledCopyExpiryLimit> departmentMatch = active.stream()
                .filter(limit -> limit.getDocumentType() == null
                        && limit.getDepartment() != null
                        && Objects.equals(limit.getDepartment().getId(), departmentId))
                .min(Comparator.comparingInt(ControlledCopyExpiryLimit::getMaxDurationDays));
        if (departmentMatch.isPresent()) {
            return departmentMatch.get().getMaxDurationDays();
        }

        return active.stream()
                .filter(limit -> limit.getDocumentType() == null && limit.getDepartment() == null)
                .min(Comparator.comparingInt(ControlledCopyExpiryLimit::getMaxDurationDays))
                .map(ControlledCopyExpiryLimit::getMaxDurationDays)
                .orElse(null);
    }

    private boolean matchesId(UUID candidate, UUID target) {
        return target != null && Objects.equals(candidate, target);
    }

    private void applyRequest(ControlledCopyExpiryLimit limit, ControlledCopyExpiryLimitRequest request) {
        if (request.maxDurationDays() == null || request.maxDurationDays() <= 0) {
            throw new IllegalArgumentException("Duration (days) must be a positive number");
        }
        // The Global Default row's scope is fixed (Any document type / Any department) — ignore
        // any attempt to change it, only its duration/description may be edited.
        if (limit.isSystem()) {
            limit.setMaxDurationDays(request.maxDurationDays());
            limit.setDescription(request.description());
            return;
        }
        DocumentType documentType = null;
        if (StringUtils.hasText(request.documentTypeId())) {
            documentType = documentTypeRepository.findById(UUID.fromString(request.documentTypeId().trim()))
                    .orElseThrow(() -> new IllegalArgumentException("Document type not found"));
        }
        Department department = null;
        if (StringUtils.hasText(request.departmentId())) {
            department = departmentRepository.findById(UUID.fromString(request.departmentId().trim()))
                    .orElseThrow(() -> new IllegalArgumentException("Department not found"));
        }

        UUID excludeId = limit.getId();
        UUID nextDocumentTypeId = documentType == null ? null : documentType.getId();
        UUID nextDepartmentId = department == null ? null : department.getId();
        boolean duplicate = repository.findAllByActiveTrue().stream()
                .filter(existing -> !Objects.equals(existing.getId(), excludeId))
                .anyMatch(existing -> Objects.equals(existing.getDocumentType() == null ? null : existing.getDocumentType().getId(), nextDocumentTypeId)
                        && Objects.equals(existing.getDepartment() == null ? null : existing.getDepartment().getId(), nextDepartmentId));
        if (duplicate) {
            throw new IllegalArgumentException("An active expiry limit already exists for this document type/department combination");
        }

        limit.setDocumentType(documentType);
        limit.setDepartment(department);
        limit.setMaxDurationDays(request.maxDurationDays());
        limit.setActive(request.active() == null || request.active());
        limit.setDescription(request.description());
    }

    private ControlledCopyExpiryLimitResponse toResponse(ControlledCopyExpiryLimit limit) {
        DocumentType documentType = limit.getDocumentType();
        Department department = limit.getDepartment();
        return new ControlledCopyExpiryLimitResponse(
                limit.getId().toString(),
                documentType == null ? null : documentType.getId().toString(),
                documentType == null ? null : documentType.getName(),
                department == null ? null : department.getId().toString(),
                department == null ? null : department.getName(),
                limit.getMaxDurationDays(),
                limit.isActive(),
                limit.isSystem(),
                limit.getDescription()
        );
    }

    private void requireViewAccess() {
        UserAccount user = currentUserService.requireCurrentUser();
        boolean allowed = permissionEvaluationService.hasPermission(user, "settings.controlled_copy_policy.view")
                || permissionEvaluationService.hasPermission(user, "settings.controlled_copy_policy.manage")
                || permissionEvaluationService.isSuperAdmin(user);
        if (!allowed) {
            throw new AccessDeniedException("Access denied");
        }
    }

    private UserAccount requireManageAccess() {
        UserAccount user = currentUserService.requireCurrentUser();
        boolean allowed = permissionEvaluationService.hasPermission(user, "settings.controlled_copy_policy.manage")
                || permissionEvaluationService.isSuperAdmin(user);
        if (!allowed) {
            throw new AccessDeniedException("Access denied");
        }
        return user;
    }
}
