package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.dto.controlledcopypolicy.ControlledCopyExpiryLimitRequest;
import com.eqms.dto.controlledcopypolicy.ControlledCopyExpiryLimitResponse;
import com.eqms.entity.ControlledCopyExpiryLimit;
import com.eqms.entity.Department;
import com.eqms.entity.DocumentType;
import com.eqms.entity.ElectronicSignature;
import com.eqms.entity.UserAccount;
import com.eqms.repository.ControlledCopyExpiryLimitRepository;
import com.eqms.repository.DepartmentRepository;
import com.eqms.repository.DocumentTypeRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
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
    private final AuditTrailService auditTrailService;

    public ControlledCopyExpiryLimitService(
            ControlledCopyExpiryLimitRepository repository,
            DocumentTypeRepository documentTypeRepository,
            DepartmentRepository departmentRepository,
            PermissionEvaluationService permissionEvaluationService,
            CurrentUserService currentUserService,
            SecurityChangeSignatureService securityChangeSignatureService,
            AuditTrailService auditTrailService
    ) {
        this.repository = repository;
        this.documentTypeRepository = documentTypeRepository;
        this.departmentRepository = departmentRepository;
        this.permissionEvaluationService = permissionEvaluationService;
        this.currentUserService = currentUserService;
        this.securityChangeSignatureService = securityChangeSignatureService;
        this.auditTrailService = auditTrailService;
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
        recordSignatureAndAudit(currentUser, request, saved, "CREATED", diff(null, snapshot(saved)));
        return toResponse(saved);
    }

    @Transactional
    public ControlledCopyExpiryLimitResponse update(UUID id, ControlledCopyExpiryLimitRequest request) {
        UserAccount currentUser = requireManageAccess();
        requireSignature(currentUser, request);
        ControlledCopyExpiryLimit limit = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Expiry limit not found"));
        RuleSnapshot before = snapshot(limit);
        applyRequest(limit, request);
        limit.setUpdatedBy(currentUser.getId());
        ControlledCopyExpiryLimit saved = repository.save(limit);
        recordSignatureAndAudit(currentUser, request, saved, "UPDATED", diff(before, snapshot(saved)));
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
        RuleSnapshot before = snapshot(limit);
        String scope = describeScope(limit);
        UUID limitId = limit.getId();
        repository.delete(limit);
        recordSignatureAndAudit(currentUser, request, limitId, scope, "DELETED", diff(before, null));
    }

    private void requireSignature(UserAccount actor, ControlledCopyExpiryLimitRequest request) {
        securityChangeSignatureService.requireValidToken(actor, request == null ? null : request.signatureToken());
    }

    /** Immutable snapshot of a rule's fields, captured before/after applyRequest() so diff() can compare them field by field. */
    private record RuleSnapshot(String documentType, String department, String duration, boolean active) {}

    private RuleSnapshot snapshot(ControlledCopyExpiryLimit limit) {
        return new RuleSnapshot(
                limit.getDocumentType() == null ? "Any" : limit.getDocumentType().getName(),
                limit.getDepartment() == null ? "Any" : limit.getDepartment().getName(),
                limit.getDurationValue() + " " + limit.getDurationUnit(),
                limit.isActive()
        );
    }

    /**
     * Only the fields that actually changed -- not the whole rule dumped as one blob. {@code before}
     * is null on create (every field shown as newly set), {@code after} is null on delete (every
     * field shown as removed).
     */
    private List<AuditTrailChangeResponse> diff(RuleSnapshot before, RuleSnapshot after) {
        List<AuditTrailChangeResponse> changes = new java.util.ArrayList<>();
        addIfChanged(changes, "documentType", before == null ? null : before.documentType(), after == null ? null : after.documentType());
        addIfChanged(changes, "department", before == null ? null : before.department(), after == null ? null : after.department());
        addIfChanged(changes, "duration", before == null ? null : before.duration(), after == null ? null : after.duration());
        Boolean beforeActive = before == null ? null : before.active();
        Boolean afterActive = after == null ? null : after.active();
        if (!java.util.Objects.equals(beforeActive, afterActive)) {
            changes.add(new AuditTrailChangeResponse("active",
                    beforeActive == null ? null : (beforeActive ? "Enabled" : "Disabled"),
                    afterActive == null ? null : (afterActive ? "Enabled" : "Disabled")));
        }
        return changes;
    }

    private void addIfChanged(List<AuditTrailChangeResponse> changes, String field, String before, String after) {
        if (!java.util.Objects.equals(before, after)) {
            changes.add(new AuditTrailChangeResponse(field, before, after));
        }
    }

    // This service had NO audit trail entries at all before -- create/update/delete were only ever
    // visible via the (now-retired) generic "ENTITY_ELECTRONICALLY_SIGNED" companion row that
    // ElectronicSignatureService used to log for every signed action. Electronic signing is a step
    // that accompanies the real action, not a separate audit event of its own (see
    // ElectronicSignatureService#createEntitySignature) -- so this rule change needs its own proper
    // Audit Trail entry, carrying the signature's ID directly, same as every other action in the app.
    private void recordSignatureAndAudit(
            UserAccount actor,
            ControlledCopyExpiryLimitRequest request,
            ControlledCopyExpiryLimit limit,
            String actionType,
            List<AuditTrailChangeResponse> changes
    ) {
        recordSignatureAndAudit(actor, request, limit.getId(), describeScope(limit), actionType, changes);
    }

    /**
     * Human-identifiable scope of a rule ("SOP / Quality Assurance", "Global Default", ...) -- used
     * as the Audit Trail entity name/object code so a reviewer can tell WHICH rule an entry is about
     * (multiple rules can exist at once; a generic "Controlled Copy Expiry Rule" label for all of
     * them made every entry indistinguishable from every other). Computed here (not looked up by
     * AuditTrailService alone) because on delete the row is already gone by the time this runs.
     */
    private String describeScope(ControlledCopyExpiryLimit limit) {
        boolean hasType = limit.getDocumentType() != null;
        boolean hasDept = limit.getDepartment() != null;
        if (!hasType && !hasDept) {
            return "Global Default";
        }
        if (hasType && hasDept) {
            return limit.getDocumentType().getName() + " / " + limit.getDepartment().getName();
        }
        if (hasType) {
            return limit.getDocumentType().getName() + " (Any Department)";
        }
        return limit.getDepartment().getName() + " (Any Document Type)";
    }

    // This service had NO audit trail entries at all before -- create/update/delete were only ever
    // visible via the (now-retired) generic "ENTITY_ELECTRONICALLY_SIGNED" companion row that
    // ElectronicSignatureService used to log for every signed action. Electronic signing is a step
    // that accompanies the real action, not a separate audit event of its own (see
    // ElectronicSignatureService#createEntitySignature) -- so this rule change needs its own proper
    // Audit Trail entry, carrying the signature's ID directly, same as every other action in the app.
    //
    // Action type is plain CREATED/UPDATED/DELETED, not "CONTROLLED_COPY_EXPIRY_LIMIT_..." --
    // Target Module already says "Controlled Copy Expiry Limit" and entityName/objectCode now
    // carries the specific rule's scope, so repeating the entity type in the action label would
    // only be noise.
    private void recordSignatureAndAudit(
            UserAccount actor,
            ControlledCopyExpiryLimitRequest request,
            UUID limitId,
            String scopeLabel,
            String actionType,
            List<AuditTrailChangeResponse> changes
    ) {
        String reason = request == null ? null : request.reason();
        ElectronicSignature signature = securityChangeSignatureService.record(actor, request == null ? null : request.signatureToken(),
                SecurityChangeSignatureService.MEANING_SECURITY_CONFIGURATION_CHANGE,
                "CONTROLLED_COPY_EXPIRY_LIMIT", limitId, scopeLabel,
                reason, null, null);
        // fromStatus/toStatus stay null -- audit_logs.from_status/to_status are varchar(40) and a
        // full-rule summary there previously overflowed the column and failed the save outright.
        // Field Modifications must list only the fields that actually changed (see diff() above).
        auditTrailService.logAs(
                actor,
                "CONTROLLED_COPY_EXPIRY_LIMIT",
                scopeLabel,
                limitId,
                actionType,
                null,
                null,
                StringUtils.hasText(reason) ? "Reason: " + reason : null,
                changes,
                signature == null ? null : signature.getId()
        );
    }

    /** Comparable magnitude used only to pick the "shortest" rule when several rules tie in specificity. */
    private static long toApproxHours(ControlledCopyExpiryLimit limit) {
        return toApproxHours(limit.getDurationValue(), limit.getDurationUnit());
    }

    private static long toApproxHours(int value, String unit) {
        return switch (unit == null ? "DAYS" : unit) {
            case "HOURS" -> value;
            case "WEEKS" -> value * 24L * 7;
            case "MONTHS" -> value * 24L * 30;
            default -> value * 24L;
        };
    }

    /**
     * Resolves the expiry limit to apply for a document as a maximum {@link Instant}, computed from
     * "now". Always resolves to a value in practice, since the mandatory Global Default row
     * guarantees a fallback match. Priority: (documentType + department) > documentType-only >
     * department-only > Global Default.
     */
    @Transactional(readOnly = true)
    public Instant resolveMaximumExpiry(DocumentType documentType, Department department) {
        return resolveMatchingLimit(documentType, department).map(this::addDuration).orElse(null);
    }

    /**
     * Same rule matching as {@link #resolveMaximumExpiry}, but the duration is added to the given
     * {@code anchor} instead of "now". Used to recompute a policy-derived (non-explicit) Controlled
     * Copy expiry at Distribute time, anchored to the actual distribution moment rather than to
     * whenever the request happened to be created.
     */
    @Transactional(readOnly = true)
    public Instant resolveExpiryFrom(DocumentType documentType, Department department, Instant anchor) {
        return resolveMatchingLimit(documentType, department).map(limit -> addDuration(limit, anchor)).orElse(null);
    }

    /**
     * Same resolution/priority as {@link #resolveMaximumExpiry}, but returns the matched rule
     * itself (duration value + unit) instead of a computed Instant -- for callers that need to
     * *display* the applicable policy (e.g. "valid for 3 day(s)") rather than compute a deadline.
     * Kept as one shared matching implementation so the two never drift apart.
     */
    @Transactional(readOnly = true)
    public Optional<ControlledCopyExpiryLimit> resolveMatchingLimit(DocumentType documentType, Department department) {
        UUID documentTypeId = documentType == null ? null : documentType.getId();
        UUID departmentId = department == null ? null : department.getId();

        List<ControlledCopyExpiryLimit> active = repository.findAllByActiveTrue();

        Optional<ControlledCopyExpiryLimit> exactMatch = active.stream()
                .filter(limit -> matchesId(limit.getDocumentType() == null ? null : limit.getDocumentType().getId(), documentTypeId)
                        && matchesId(limit.getDepartment() == null ? null : limit.getDepartment().getId(), departmentId)
                        && limit.getDocumentType() != null && limit.getDepartment() != null)
                .min(Comparator.comparingLong(ControlledCopyExpiryLimitService::toApproxHours));
        if (exactMatch.isPresent()) {
            return exactMatch;
        }

        Optional<ControlledCopyExpiryLimit> documentTypeMatch = active.stream()
                .filter(limit -> limit.getDepartment() == null
                        && limit.getDocumentType() != null
                        && Objects.equals(limit.getDocumentType().getId(), documentTypeId))
                .min(Comparator.comparingLong(ControlledCopyExpiryLimitService::toApproxHours));
        if (documentTypeMatch.isPresent()) {
            return documentTypeMatch;
        }

        Optional<ControlledCopyExpiryLimit> departmentMatch = active.stream()
                .filter(limit -> limit.getDocumentType() == null
                        && limit.getDepartment() != null
                        && Objects.equals(limit.getDepartment().getId(), departmentId))
                .min(Comparator.comparingLong(ControlledCopyExpiryLimitService::toApproxHours));
        if (departmentMatch.isPresent()) {
            return departmentMatch;
        }

        return active.stream()
                .filter(limit -> limit.getDocumentType() == null && limit.getDepartment() == null)
                .min(Comparator.comparingLong(ControlledCopyExpiryLimitService::toApproxHours));
    }

    private Instant addDuration(ControlledCopyExpiryLimit limit) {
        return addDuration(limit, Instant.now());
    }

    private Instant addDuration(ControlledCopyExpiryLimit limit, Instant anchor) {
        ZonedDateTime now = anchor.atZone(ZoneOffset.UTC);
        int value = limit.getDurationValue();
        ZonedDateTime result = switch (limit.getDurationUnit() == null ? "DAYS" : limit.getDurationUnit()) {
            case "HOURS" -> now.plusHours(value);
            case "WEEKS" -> now.plusWeeks(value);
            case "MONTHS" -> now.plusMonths(value);
            default -> now.plusDays(value);
        };
        return result.toInstant();
    }

    private boolean matchesId(UUID candidate, UUID target) {
        return target != null && Objects.equals(candidate, target);
    }

    private static final Set<String> VALID_DURATION_UNITS = Set.of("HOURS", "DAYS", "WEEKS", "MONTHS");

    private void applyRequest(ControlledCopyExpiryLimit limit, ControlledCopyExpiryLimitRequest request) {
        if (request.durationValue() == null || request.durationValue() <= 0) {
            throw new IllegalArgumentException("Duration must be a positive number");
        }
        String unit = StringUtils.hasText(request.durationUnit()) ? request.durationUnit().trim().toUpperCase() : "DAYS";
        if (!VALID_DURATION_UNITS.contains(unit)) {
            throw new IllegalArgumentException("Duration unit must be one of HOURS, DAYS, WEEKS, MONTHS");
        }
        // Bound the duration so the computed expiry date can never overflow when a copy is requested.
        int maxDuration = switch (unit) {
            case "HOURS" -> 24 * 365;
            case "DAYS" -> 3650;
            case "WEEKS" -> 520;
            default -> 120;
        };
        if (request.durationValue() > maxDuration) {
            throw new IllegalArgumentException("Duration for " + unit + " must not exceed " + maxDuration);
        }
        // The Global Default row's scope is fixed (Any document type / Any department) — ignore
        // any attempt to change it, only its duration may be edited.
        if (limit.isSystem()) {
            limit.setDurationValue(request.durationValue());
            limit.setDurationUnit(unit);
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
        limit.setDurationValue(request.durationValue());
        limit.setDurationUnit(unit);
        limit.setActive(request.active() == null || request.active());
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
                limit.getDurationValue(),
                limit.getDurationUnit(),
                limit.isActive(),
                limit.isSystem()
        );
    }

    private void requireViewAccess() {
        UserAccount user = currentUserService.requireCurrentUser();
        boolean allowed = permissionEvaluationService.hasAnyPermission(user,
                "documents.admin.controlled_copies_policy.view", "documents.admin.controlled_copies_policy.manage",
                "settings.configuration.view", "settings.configuration.manage");
        if (!allowed) {
            throw new AccessDeniedException("Access denied");
        }
    }

    private UserAccount requireManageAccess() {
        UserAccount user = currentUserService.requireCurrentUser();
        boolean allowed = permissionEvaluationService.hasAnyPermission(user,
                "documents.admin.controlled_copies_policy.manage", "settings.configuration.manage");
        if (!allowed) {
            throw new AccessDeniedException("Access denied");
        }
        return user;
    }
}
