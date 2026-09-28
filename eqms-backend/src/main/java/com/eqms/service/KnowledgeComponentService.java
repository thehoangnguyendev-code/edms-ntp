package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.dto.knowledge.KnowledgeComponentDtos.ComponentRequest;
import com.eqms.dto.knowledge.KnowledgeComponentDtos.ComponentResponse;
import com.eqms.dto.knowledge.KnowledgeComponentDtos.SourceOption;
import com.eqms.dto.user.PageResponse;
import com.eqms.entity.KnowledgeCategoryComponent;
import com.eqms.entity.UserAccount;
import com.eqms.enums.KnowledgeField;
import com.eqms.exception.RevisionLifecycleConflictException;
import com.eqms.repository.KnowledgeCategoryComponentRepository;
import com.eqms.repository.KnowledgeCategoryHierarchyRepository;
import com.eqms.repository.KnowledgeCategoryLevelRepository;
import com.eqms.util.DateRangeFilter;
import com.eqms.util.PagedList;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;

/**
 * The catalogue of components a Knowledge Categories Hierarchy is built from. A component gives a
 * display name to one document field the code can read (its source field); administrators choose from
 * that closed list and never type a column name.
 */
@Service
public class KnowledgeComponentService {

    static final String ENTITY_TYPE = "KNOWLEDGE_COMPONENT";
    private static final String VIEW = "documents.admin.knowledge_categories.view";
    private static final String MANAGE = "documents.admin.knowledge_categories.manage";

    private final KnowledgeCategoryComponentRepository repository;
    private final KnowledgeCategoryHierarchyRepository hierarchyRepository;
    private final KnowledgeCategoryLevelRepository levelRepository;
    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissionEvaluationService;
    private final AuditTrailService auditTrailService;

    public KnowledgeComponentService(
            KnowledgeCategoryComponentRepository repository,
            KnowledgeCategoryHierarchyRepository hierarchyRepository,
            KnowledgeCategoryLevelRepository levelRepository,
            CurrentUserService currentUserService,
            PermissionEvaluationService permissionEvaluationService,
            AuditTrailService auditTrailService
    ) {
        this.repository = repository;
        this.hierarchyRepository = hierarchyRepository;
        this.levelRepository = levelRepository;
        this.currentUserService = currentUserService;
        this.permissionEvaluationService = permissionEvaluationService;
        this.auditTrailService = auditTrailService;
    }

    // ---- lookups used by the hierarchy and portal services --------------------------------

    /** The name administrators gave the component for this source field (the built-in label if none exists). */
    @Transactional(readOnly = true)
    public String nameOf(String sourceField) {
        return repository.findBySourceField(sourceField == null ? "" : sourceField.trim().toUpperCase(Locale.ROOT))
                .map(KnowledgeCategoryComponent::getName)
                .orElseGet(() -> KnowledgeField.parse(sourceField).map(KnowledgeField::label).orElse(sourceField));
    }

    /** Whether an active component exists for the source field. */
    @Transactional(readOnly = true)
    public boolean isActiveSource(String sourceField) {
        return repository.findBySourceField(sourceField == null ? "" : sourceField.trim().toUpperCase(Locale.ROOT))
                .map(KnowledgeCategoryComponent::isActive).orElse(false);
    }

    /** Active components, as the choices for a Determinator or a Level. */
    @Transactional(readOnly = true)
    public List<KnowledgeCategoryComponent> activeComponents() {
        return repository.findAllByActiveTrue().stream()
                .sorted(Comparator.comparing(KnowledgeCategoryComponent::getName, String.CASE_INSENSITIVE_ORDER)).toList();
    }

    // ---- reads ----------------------------------------------------------------------------

    @Transactional(readOnly = true)
    public PageResponse<ComponentResponse> list(String search, String status, String updatedFrom, String updatedTo,
                                                int page, int limit, String sortBy, String sortDir) {
        requireView();
        String query = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        List<ComponentResponse> filtered = new ArrayList<>(repository.findAll().stream()
                .filter(c -> !StringUtils.hasText(status) || "ALL".equalsIgnoreCase(status) || ("ACTIVE".equalsIgnoreCase(status) == c.isActive()))
                .filter(c -> DateRangeFilter.matches(c.getUpdatedAt(), updatedFrom, updatedTo))
                .filter(c -> query.isEmpty()
                        || c.getName().toLowerCase(Locale.ROOT).contains(query)
                        || sourceLabel(c).toLowerCase(Locale.ROOT).contains(query)
                        || (c.getDescription() != null && c.getDescription().toLowerCase(Locale.ROOT).contains(query)))
                .map(this::toResponse).toList());
        Comparator<ComponentResponse> comparator = switch (sortBy == null ? "name" : sortBy) {
            case "sourceField" -> Comparator.comparing(ComponentResponse::sourceLabel, String.CASE_INSENSITIVE_ORDER);
            case "active" -> Comparator.comparing(ComponentResponse::active);
            case "usedByHierarchies" -> Comparator.comparingLong(ComponentResponse::usedByHierarchies);
            case "updatedAt" -> Comparator.comparing(ComponentResponse::updatedAt, Comparator.nullsLast(Comparator.naturalOrder()));
            case "updatedBy" -> Comparator.comparing((ComponentResponse c) -> Objects.toString(c.updatedByName(), ""), String.CASE_INSENSITIVE_ORDER);
            default -> Comparator.comparing(ComponentResponse::name, String.CASE_INSENSITIVE_ORDER);
        };
        if ("desc".equalsIgnoreCase(sortDir)) comparator = comparator.reversed();
        filtered.sort(comparator);
        return PagedList.paginate(filtered, page, limit);
    }

    @Transactional(readOnly = true)
    public ComponentResponse get(UUID id) {
        requireView();
        return toResponse(require(id));
    }

    /** Source fields that do not have a component yet, i.e. what "New Component" can still create. */
    @Transactional(readOnly = true)
    public List<SourceOption> availableSources() {
        requireView();
        return Arrays.stream(KnowledgeField.values())
                .filter(f -> !repository.existsBySourceField(f.name()))
                .map(f -> new SourceOption(f.name(), f.label(), f.determinatorEligible())).toList();
    }

    // ---- writes ---------------------------------------------------------------------------

    @Transactional
    public ComponentResponse create(ComponentRequest request) {
        UserAccount actor = requireManage();
        String name = requireName(request);
        KnowledgeField source = requireSource(request);
        if (repository.existsBySourceField(source.name())) {
            throw new IllegalArgumentException("A component for '" + source.label() + "' already exists");
        }
        if (repository.existsByNameIgnoreCase(name)) {
            throw new IllegalArgumentException("A component named '" + name + "' already exists");
        }
        KnowledgeCategoryComponent component = new KnowledgeCategoryComponent();
        component.setName(name);
        component.setSourceField(source.name());
        component.setDescription(clean(request.description()));
        component.setActive(request.active() == null || request.active());
        component.setCreatedBy(actor);
        component.setUpdatedBy(actor);
        component = repository.save(component);
        auditTrailService.logAs(actor, ENTITY_TYPE, name, component.getId(), "KNOWLEDGE_COMPONENT_CREATED", null,
                component.isActive() ? "Active" : "Inactive", "Created Knowledge Category Component '" + name + "'",
                List.of(change("Name", null, name), change("Source Field", null, source.label()),
                        change("Description", null, component.getDescription()), change("Active", null, yesNo(component.isActive()))));
        return toResponse(component);
    }

    @Transactional
    public ComponentResponse update(UUID id, ComponentRequest request) {
        UserAccount actor = requireManage();
        KnowledgeCategoryComponent component = require(id);
        String name = requireName(request);
        if (repository.existsByNameIgnoreCaseAndIdNot(name, id)) {
            throw new IllegalArgumentException("A component named '" + name + "' already exists");
        }
        if (request.sourceField() != null && !component.getSourceField().equalsIgnoreCase(request.sourceField().trim())) {
            throw new IllegalArgumentException("The source field of a component cannot be changed");
        }
        boolean active = request.active() == null || request.active();
        if (!active && component.isActive() && usedBy(component) > 0) {
            throw new RevisionLifecycleConflictException("COMPONENT_IN_USE",
                    "This component is used by " + usedBy(component) + " hierarchy(ies) and cannot be deactivated. Remove it from them first.");
        }
        List<AuditTrailChangeResponse> changes = new ArrayList<>();
        addIfChanged(changes, "Name", component.getName(), name);
        addIfChanged(changes, "Description", component.getDescription(), clean(request.description()));
        addIfChanged(changes, "Active", yesNo(component.isActive()), yesNo(active));
        if (changes.isEmpty()) {
            return toResponse(component);
        }
        component.setName(name);
        component.setDescription(clean(request.description()));
        component.setActive(active);
        component.setUpdatedBy(actor);
        repository.save(component);
        auditTrailService.logAs(actor, ENTITY_TYPE, name, component.getId(), "KNOWLEDGE_COMPONENT_UPDATED", null, null,
                "Updated Knowledge Category Component '" + name + "': " + String.join("; ",
                        changes.stream().map(c -> c.field() + " '" + c.oldValue() + "' -> '" + c.newValue() + "'").toList()),
                changes);
        return toResponse(component);
    }

    @Transactional
    public void delete(UUID id) {
        UserAccount actor = requireManage();
        KnowledgeCategoryComponent component = require(id);
        if (component.isSystemDefined()) {
            throw new RevisionLifecycleConflictException("SYSTEM_COMPONENT", "A system-defined component cannot be deleted. Deactivate it instead.");
        }
        long used = usedBy(component);
        if (used > 0) {
            throw new RevisionLifecycleConflictException("COMPONENT_IN_USE",
                    "This component is used by " + used + " hierarchy(ies) and cannot be deleted. Remove it from them first.");
        }
        repository.delete(component);
        auditTrailService.logAs(actor, ENTITY_TYPE, component.getName(), component.getId(), "KNOWLEDGE_COMPONENT_DELETED",
                component.isActive() ? "Active" : "Inactive", "Deleted",
                "Deleted Knowledge Category Component '" + component.getName() + "'",
                List.of(change("Name", component.getName(), null), change("Source Field", sourceLabel(component), null)));
    }

    // ---- helpers --------------------------------------------------------------------------

    private long usedBy(KnowledgeCategoryComponent component) {
        return hierarchyRepository.countByDeterminatorField(component.getSourceField())
                + levelRepository.countHierarchiesUsingLevel(component.getSourceField());
    }

    private ComponentResponse toResponse(KnowledgeCategoryComponent c) {
        UserAccount updater = c.getUpdatedBy();
        KnowledgeField field = KnowledgeField.parse(c.getSourceField()).orElse(null);
        return new ComponentResponse(c.getId(), c.getName(), c.getSourceField(), sourceLabel(c), c.getDescription(), c.isActive(),
                c.isSystemDefined(), field != null && field.determinatorEligible(), usedBy(c), c.getCreatedAt(), c.getUpdatedAt(),
                updater == null ? null : (StringUtils.hasText(updater.getFullName()) ? updater.getFullName() : updater.getUsername()));
    }

    private static String sourceLabel(KnowledgeCategoryComponent c) {
        return KnowledgeField.parse(c.getSourceField()).map(KnowledgeField::label).orElse(c.getSourceField());
    }

    private static AuditTrailChangeResponse change(String field, String oldValue, String newValue) {
        return new AuditTrailChangeResponse(field, oldValue == null ? "-" : oldValue, newValue == null ? "-" : newValue);
    }

    private static void addIfChanged(List<AuditTrailChangeResponse> changes, String field, String oldValue, String newValue) {
        if (!Objects.equals(oldValue == null ? "" : oldValue, newValue == null ? "" : newValue)) {
            changes.add(change(field, oldValue, newValue));
        }
    }

    private static String yesNo(boolean value) {
        return value ? "Yes" : "No";
    }

    private static String clean(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private static String requireName(ComponentRequest request) {
        if (request == null || !StringUtils.hasText(request.name())) {
            throw new IllegalArgumentException("Name is required");
        }
        String name = request.name().trim();
        if (name.length() > 200) {
            throw new IllegalArgumentException("Name must be at most 200 characters");
        }
        return name;
    }

    private static KnowledgeField requireSource(ComponentRequest request) {
        if (request == null || !StringUtils.hasText(request.sourceField())) {
            throw new IllegalArgumentException("Source Field is required");
        }
        return KnowledgeField.parse(request.sourceField()).orElseThrow(() -> new IllegalArgumentException("Unknown source field: " + request.sourceField()));
    }

    private KnowledgeCategoryComponent require(UUID id) {
        return repository.findById(id).orElseThrow(() -> new IllegalArgumentException("Knowledge Category Component not found"));
    }

    private void requireView() {
        UserAccount user = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.hasAnyPermission(user, VIEW, MANAGE)) {
            throw new AccessDeniedException("Knowledge categories view permission required");
        }
    }

    private UserAccount requireManage() {
        UserAccount user = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.hasPermission(user, MANAGE)) {
            throw new AccessDeniedException("Knowledge categories management permission required");
        }
        return user;
    }
}
