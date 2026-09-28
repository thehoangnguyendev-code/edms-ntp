package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.dictionary.DocumentComponentRequest;
import com.eqms.dto.dictionary.DocumentComponentResponse;
import com.eqms.dto.dictionary.DocumentNameFormatRequest;
import com.eqms.dto.dictionary.DocumentNameFormatResponse;
import com.eqms.dto.user.PageResponse;
import com.eqms.dto.user.PaginationResponse;
import com.eqms.entity.DocumentComponent;
import com.eqms.entity.DocumentNameFormat;
import com.eqms.entity.DocumentNameFormatComponent;
import com.eqms.entity.UserAccount;
import com.eqms.repository.DocumentComponentRepository;
import com.eqms.repository.DocumentNameFormatRepository;
import jakarta.persistence.EntityNotFoundException;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.util.DateTimeFormatUtils;

/**
 * Document Name Formats / Document Components — Phase 1 of the feature (catalog management only;
 * see the feature plan for why wiring this into real document-number generation is a separate,
 * higher-risk phase). Kept as its own service rather than folded into DictionaryManagementService
 * because a Format's per-component ordering is a genuine child-collection concept the other
 * dictionaries don't have.
 *
 * Gated by its own documents.admin.name_formats.* permission pair (split out of the old
 * catch-all documents.admin.* family so an Access Profile can delegate this screen without also
 * granting Document Types, Publishing Templates, etc.).
 */
@Service
public class DocumentNameFormatService {

    private static final String ACTION_COMPONENT_CREATED = "DOCUMENT_COMPONENT_CREATED";
    private static final String ACTION_COMPONENT_UPDATED = "DOCUMENT_COMPONENT_UPDATED";
    private static final String ACTION_FORMAT_CREATED = "DOCUMENT_NAME_FORMAT_CREATED";
    private static final String ACTION_FORMAT_UPDATED = "DOCUMENT_NAME_FORMAT_UPDATED";

    private final DocumentComponentRepository componentRepository;
    private final DocumentNameFormatRepository formatRepository;
    private final DocumentComponentResolver resolver;
    private final com.eqms.repository.DocumentTypeRepository documentTypeRepository;
    private final AuditTrailService auditTrailService;
    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissionEvaluationService;

    public DocumentNameFormatService(
            DocumentComponentRepository componentRepository,
            DocumentNameFormatRepository formatRepository,
            DocumentComponentResolver resolver,
            com.eqms.repository.DocumentTypeRepository documentTypeRepository,
            AuditTrailService auditTrailService,
            CurrentUserService currentUserService,
            PermissionEvaluationService permissionEvaluationService
    ) {
        this.componentRepository = componentRepository;
        this.formatRepository = formatRepository;
        this.resolver = resolver;
        this.documentTypeRepository = documentTypeRepository;
        this.auditTrailService = auditTrailService;
        this.currentUserService = currentUserService;
        this.permissionEvaluationService = permissionEvaluationService;
    }

    private void requireView() {
        UserAccount actor = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.hasAnyPermission(actor,
                "documents.admin.name_formats.view", "documents.admin.name_formats.manage",
                "settings.configuration.view", "settings.configuration.manage")) {
            throw new AccessDeniedException("Document Name Formats view permission required");
        }
    }

    private void requireManage() {
        UserAccount actor = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.hasAnyPermission(actor,
                "documents.admin.name_formats.manage", "settings.configuration.manage")) {
            throw new AccessDeniedException("Document Name Formats management permission required");
        }
    }

    // ── Document Components ─────────────────────────────────────────────────

    // Deliberately no permission gate: read-only reference data consumed by the Document Name
    // Format builder's component picker -- any user allowed to reach that builder already passed
    // requireManage() there; this unpaginated form only serves the dropdown itself.
    @Transactional(readOnly = true)
    public List<DocumentComponentResponse> listComponents() {
        return componentRepository.findAllByActiveTrueOrderByDisplayOrderAscNameAsc()
                .stream().map(this::toComponentResponse).toList();
    }

    @Transactional(readOnly = true)
    public PageResponse<DocumentComponentResponse> listComponentsPage(
            String search, String status, int page, int limit, String sortBy, String sortDirection
    ) {
        requireView();
        Page<DocumentComponent> result = componentRepository.findAll(
                buildComponentSpecification(search, status),
                buildPageable(page, limit, sortBy, sortDirection, "displayOrder")
        );
        return toPageResponse(result, this::toComponentResponse);
    }

    @Transactional
    public DocumentComponentResponse createComponent(DocumentComponentRequest request) {
        requireManage();
        if (!StringUtils.hasText(request.freeText())) {
            throw new IllegalArgumentException("Free text value is required for a new Document Component");
        }
        String trimmedName = request.name().trim();
        requireMaxLength(trimmedName, 120, "Component name");
        requireMaxLength(request.freeText(), 120, "Free text");
        requireMaxLength(request.shortDescription(), 512, "Description");
        validateUniqueComponentName(null, trimmedName);
        DocumentComponent component = new DocumentComponent();
        component.setName(trimmedName);
        component.setValue(generateUniqueComponentValue(trimmedName));
        component.setShortDescription(trimToNull(request.shortDescription()));
        component.setSourceTable(DocumentComponent.SOURCE_FREE_TEXT);
        component.setSourceField(null);
        component.setFreeText(request.freeText().trim());
        component.setSystemDefined(false);
        component.setActive(request.isActive() == null || request.isActive());
        component.setDisplayOrder(request.displayOrder() == null ? nextComponentDisplayOrder() : request.displayOrder());
        componentRepository.save(component);
        auditTrailService.logSafely("SETTINGS", component.getName(), component.getId(), ACTION_COMPONENT_CREATED, null, null,
                "Document Component created: " + component.getName() + " (Free Text: \"" + component.getFreeText() + "\")");
        return toComponentResponse(component);
    }

    @Transactional
    public DocumentComponentResponse updateComponent(UUID id, DocumentComponentRequest request) {
        requireManage();
        DocumentComponent component = requireComponent(id);
        List<AuditTrailChangeResponse> changes = new ArrayList<>();
        // System-defined (field-bound) components: only Active and display order are writable --
        // see the GMP/security boundary documented on DocumentComponent. Free-text components the
        // admin created themselves may also have their name/text edited.
        if (!component.isSystemDefined()) {
            String trimmedName = request.name().trim();
            requireMaxLength(trimmedName, 120, "Component name");
            requireMaxLength(request.freeText(), 120, "Free text");
            requireMaxLength(request.shortDescription(), 512, "Description");
            if (!trimmedName.equalsIgnoreCase(component.getName())) {
                validateUniqueComponentName(id, trimmedName);
            }
            addChange(changes, "Name", component.getName(), trimmedName);
            component.setName(trimmedName);
            String newShortDescription = trimToNull(request.shortDescription());
            addChange(changes, "Description", component.getShortDescription(), newShortDescription);
            component.setShortDescription(newShortDescription);
            if (StringUtils.hasText(request.freeText())) {
                String newFreeText = request.freeText().trim();
                addChange(changes, "Free Text", component.getFreeText(), newFreeText);
                component.setFreeText(newFreeText);
            }
        }
        boolean newActive = request.isActive() == null ? component.isActive() : request.isActive();
        addChange(changes, "Status", component.isActive() ? "Active" : "Inactive", newActive ? "Active" : "Inactive");
        component.setActive(newActive);
        if (request.displayOrder() != null) {
            addChange(changes, "Order", String.valueOf(component.getDisplayOrder()), String.valueOf(request.displayOrder()));
            component.setDisplayOrder(request.displayOrder());
        }
        auditTrailService.logAs(currentUserService.requireCurrentUser(), "SETTINGS", component.getName(), component.getId(),
                ACTION_COMPONENT_UPDATED, null, null, "Updated Document Component: " + component.getName(), changes);
        return toComponentResponse(component);
    }

    private static void requireMaxLength(String value, int max, String label) {
        if (value != null && value.trim().length() > max) {
            throw new IllegalArgumentException(label + " must be at most " + max + " characters");
        }
    }

    private void addChange(List<AuditTrailChangeResponse> changes, String field, String oldValue, String newValue) {
        if (!Objects.equals(oldValue, newValue)) {
            changes.add(new AuditTrailChangeResponse(field, oldValue, newValue));
        }
    }

    private int nextComponentDisplayOrder() {
        return componentRepository.findAllByOrderByDisplayOrderAscNameAsc().stream()
                .mapToInt(DocumentComponent::getDisplayOrder).max().orElse(0) + 10;
    }

    private String generateUniqueComponentValue(String name) {
        String base = name.trim().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "_").replaceAll("^_+|_+$", "");
        if (!StringUtils.hasText(base)) {
            base = "component";
        }
        String candidate = base;
        int suffix = 1;
        while (componentRepository.findByValueIgnoreCase(candidate).isPresent()) {
            suffix++;
            candidate = base + "_" + suffix;
        }
        return candidate;
    }

    private void validateUniqueComponentName(UUID currentId, String name) {
        componentRepository.findByNameIgnoreCase(name).ifPresent(existing -> {
            if (currentId == null || !existing.getId().equals(currentId)) {
                throw new IllegalArgumentException("A Document Component named \"" + name + "\" already exists");
            }
        });
    }

    private DocumentComponent requireComponent(UUID id) {
        return componentRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Document component not found"));
    }

    private DocumentComponentResponse toComponentResponse(DocumentComponent component) {
        return new DocumentComponentResponse(
                component.getId(),
                component.getName(),
                component.getValue(),
                component.getShortDescription(),
                component.getSourceTable(),
                component.getSourceField(),
                component.getFreeText(),
                component.isSystemDefined(),
                component.isActive(),
                component.getDisplayOrder(),
                formatDateTime(component.getCreatedAt()),
                formatDateTime(component.getUpdatedAt()),
                resolver.sampleFor(component)
        );
    }

    // ── Document Name Formats ───────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<DocumentNameFormatResponse> listFormats() {
        return formatRepository.findAllByOrderByNameAsc().stream().map(this::toFormatResponse).toList();
    }

    @Transactional(readOnly = true)
    public PageResponse<DocumentNameFormatResponse> listFormatsPage(
            String search, String status, int page, int limit, String sortBy, String sortDirection
    ) {
        requireView();
        Page<DocumentNameFormat> result = formatRepository.findAll(
                buildFormatSpecification(search, status),
                buildPageable(page, limit, sortBy, sortDirection, "name")
        );
        return toPageResponse(result, this::toFormatResponse);
    }

    @Transactional(readOnly = true)
    public DocumentNameFormatResponse getFormat(UUID id) {
        requireView();
        return toFormatResponse(requireFormat(id));
    }

    @Transactional
    public DocumentNameFormatResponse createFormat(DocumentNameFormatRequest request) {
        requireManage();
        String trimmedName = request.name().trim();
        requireMaxLength(trimmedName, 120, "Format name");
        requireMaxLength(request.description(), 512, "Description");
        validateUniqueFormatName(null, trimmedName);
        DocumentNameFormat format = new DocumentNameFormat();
        format.setName(trimmedName);
        format.setSeparator(request.separator() == null ? "" : request.separator());
        format.setDescription(trimToNull(request.description()));
        format.setActive(request.isActive() == null || request.isActive());
        applyComponents(format, request.components());
        formatRepository.save(format);
        auditTrailService.logSafely("SETTINGS", format.getName(), format.getId(), ACTION_FORMAT_CREATED, null, null,
                "Document Name Format created: " + format.getName() + " (" + describeComponents(format) + ")");
        return toFormatResponse(format);
    }

    @Transactional
    public DocumentNameFormatResponse updateFormat(UUID id, DocumentNameFormatRequest request) {
        requireManage();
        DocumentNameFormat format = requireFormat(id);
        List<AuditTrailChangeResponse> changes = new ArrayList<>();
        String trimmedName = request.name().trim();
        requireMaxLength(trimmedName, 120, "Format name");
        requireMaxLength(request.description(), 512, "Description");
        if (!trimmedName.equalsIgnoreCase(format.getName())) {
            validateUniqueFormatName(id, trimmedName);
        }
        addChange(changes, "Name", format.getName(), trimmedName);
        format.setName(trimmedName);
        String newSeparator = request.separator() == null ? "" : request.separator();
        addChange(changes, "Separator", format.getSeparator(), newSeparator);
        format.setSeparator(newSeparator);
        String newDescription = trimToNull(request.description());
        addChange(changes, "Description", format.getDescription(), newDescription);
        format.setDescription(newDescription);
        boolean newActive = request.isActive() == null ? format.isActive() : request.isActive();
        addChange(changes, "Status", format.isActive() ? "Active" : "Inactive", newActive ? "Active" : "Inactive");
        format.setActive(newActive);
        String beforeComponents = describeComponents(format);
        applyComponents(format, request.components());
        String afterComponents = describeComponents(format);
        requireStillValidForAssignedDocumentTypes(format);
        if (!Objects.equals(beforeComponents, afterComponents)) {
            changes.add(new AuditTrailChangeResponse("Components", beforeComponents, afterComponents));
        }
        auditTrailService.logAs(currentUserService.requireCurrentUser(), "SETTINGS", format.getName(), format.getId(),
                ACTION_FORMAT_UPDATED, null, null, "Updated Document Name Format: " + format.getName(), changes);
        return toFormatResponse(format);
    }

    /**
     * A Format assigned to Document Types generates their real document numbers, so editing it must not leave it
     * inactive or in a shape that {@link DocumentComponentResolver#isEligibleAsDocumentNumberFormat} rejects --
     * generation would then silently fall back to a different number shape. Detach it from those types first.
     */
    private void requireStillValidForAssignedDocumentTypes(DocumentNameFormat format) {
        List<com.eqms.entity.DocumentType> assigned = documentTypeRepository.findAllByNameFormat_Id(format.getId());
        if (assigned.isEmpty()) {
            return;
        }
        boolean eligible = resolver.isEligibleAsDocumentNumberFormat(format);
        if (format.isActive() && eligible) {
            return;
        }
        String types = assigned.stream().map(com.eqms.entity.DocumentType::getName).limit(5).collect(Collectors.joining(", "));
        throw new IllegalArgumentException("This Format is the Document Number Format of " + assigned.size()
                + " Document Type(s) (" + types + (assigned.size() > 5 ? ", ..." : "") + "), so it must stay Active and keep "
                + "exactly [Document Type, Serial Number] joined by \".\". Assign those types another Format before changing it.");
    }

    private void applyComponents(DocumentNameFormat format, List<DocumentNameFormatRequest.ComponentRef> refs) {
        java.util.Set<UUID> requestedIds = new java.util.LinkedHashSet<>();
        for (DocumentNameFormatRequest.ComponentRef ref : refs) {
            if (!requestedIds.add(ref.componentId())) {
                throw new IllegalArgumentException("A Document Component can appear only once in a Format");
            }
        }
        Map<UUID, DocumentComponent> componentsById = componentRepository.findAllById(requestedIds)
                .stream().collect(Collectors.toMap(DocumentComponent::getId, Function.identity()));
        // Reconcile in place instead of clear-and-recreate: (format, component) is unique, and Hibernate inserts the
        // new rows before it deletes the old ones, so re-adding a component that is kept would violate that constraint.
        Map<UUID, DocumentNameFormatComponent> existing = new java.util.HashMap<>();
        for (DocumentNameFormatComponent link : format.getComponents()) {
            existing.put(link.getComponent().getId(), link);
        }
        format.getComponents().removeIf(link -> !requestedIds.contains(link.getComponent().getId()));
        for (DocumentNameFormatRequest.ComponentRef ref : refs) {
            DocumentComponent component = componentsById.get(ref.componentId());
            if (component == null) {
                throw new EntityNotFoundException("Document component not found: " + ref.componentId());
            }
            DocumentNameFormatComponent link = existing.get(ref.componentId());
            if (link == null) {
                link = new DocumentNameFormatComponent();
                link.setFormat(format);
                link.setComponent(component);
                format.getComponents().add(link);
            }
            link.setDisplayOrder(ref.displayOrder());
        }
    }

    private String describeComponents(DocumentNameFormat format) {
        return format.getComponents().stream()
                .sorted((a, b) -> Integer.compare(a.getDisplayOrder(), b.getDisplayOrder()))
                .map(link -> link.getComponent().getName())
                .collect(Collectors.joining(format.getSeparator() == null ? " " : format.getSeparator()));
    }

    private void validateUniqueFormatName(UUID currentId, String name) {
        formatRepository.findByNameIgnoreCase(name).ifPresent(existing -> {
            if (currentId == null || !existing.getId().equals(currentId)) {
                throw new IllegalArgumentException("A Document Name Format named \"" + name + "\" already exists");
            }
        });
    }

    private DocumentNameFormat requireFormat(UUID id) {
        return formatRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Document name format not found"));
    }

    private DocumentNameFormatResponse toFormatResponse(DocumentNameFormat format) {
        List<DocumentNameFormatComponent> ordered = format.getComponents().stream()
                .sorted((a, b) -> Integer.compare(a.getDisplayOrder(), b.getDisplayOrder()))
                .toList();
        List<DocumentNameFormatResponse.ComponentItem> items = ordered.stream()
                .map(link -> new DocumentNameFormatResponse.ComponentItem(
                        link.getComponent().getId(), link.getComponent().getName(),
                        link.getComponent().getValue(), link.getDisplayOrder()))
                .toList();
        String separator = format.getSeparator() == null ? "" : format.getSeparator();
        String preview = ordered.stream()
                .map(link -> resolver.sampleFor(link.getComponent()))
                .collect(Collectors.joining(separator));
        return new DocumentNameFormatResponse(
                format.getId(), format.getName(), format.getSeparator(), format.getDescription(), format.isActive(),
                formatDateTime(format.getCreatedAt()), formatDateTime(format.getUpdatedAt()), items, preview,
                resolver.isEligibleAsDocumentNumberFormat(format)
        );
    }

    // ── shared helpers (mirrors DictionaryManagementService's own copies) ──

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String formatDateTime(Instant instant) {
        return DateTimeFormatUtils.formatDateTime(instant);
    }

    private <T, R> PageResponse<R> toPageResponse(Page<T> page, Function<T, R> mapper) {
        return new PageResponse<>(
                page.getContent().stream().map(mapper).toList(),
                new PaginationResponse(page.getNumber() + 1, page.getSize(), page.getTotalElements(), page.getTotalPages())
        );
    }

    private Pageable buildPageable(int page, int limit, String sortBy, String sortDirection, String defaultSortKey) {
        int safePage = Math.max(page, 1);
        int safeLimit = Math.max(limit, 1);
        String resolvedSortBy = StringUtils.hasText(sortBy) ? switch (sortBy.trim()) {
            case "name", "separator", "isActive", "displayOrder" -> sortBy.trim();
            case "modifiedDate" -> "updatedAt";
            default -> defaultSortKey;
        } : defaultSortKey;
        Sort.Direction direction = "desc".equalsIgnoreCase(sortDirection) ? Sort.Direction.DESC : Sort.Direction.ASC;
        return PageRequest.of(safePage - 1, safeLimit, Sort.by(direction, resolvedSortBy));
    }

    private Specification<DocumentComponent> buildComponentSpecification(String search, String status) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            addSearchPredicate(predicates, cb, search, root.get("name"), root.get("value"), root.get("shortDescription"));
            addStatusPredicate(predicates, cb, root.get("active"), status);
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    private Specification<DocumentNameFormat> buildFormatSpecification(String search, String status) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            addSearchPredicate(predicates, cb, search, root.get("name"), root.get("separator"), root.get("description"));
            addStatusPredicate(predicates, cb, root.get("active"), status);
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    @SafeVarargs
    private final void addSearchPredicate(List<Predicate> predicates, jakarta.persistence.criteria.CriteriaBuilder cb, String search, jakarta.persistence.criteria.Path<String>... fields) {
        if (!StringUtils.hasText(search) || fields.length == 0) {
            return;
        }
        String normalized = search.trim().toLowerCase(Locale.ROOT);
        List<Predicate> orPredicates = new ArrayList<>();
        for (jakarta.persistence.criteria.Path<String> field : fields) {
            orPredicates.add(cb.like(cb.lower(field), "%" + normalized + "%"));
        }
        predicates.add(cb.or(orPredicates.toArray(new Predicate[0])));
    }

    private void addStatusPredicate(List<Predicate> predicates, jakarta.persistence.criteria.CriteriaBuilder cb, jakarta.persistence.criteria.Path<Boolean> activeField, String status) {
        if (!StringUtils.hasText(status) || "All".equalsIgnoreCase(status)) {
            return;
        }
        predicates.add(cb.equal(activeField, "Active".equalsIgnoreCase(status)));
    }
}
