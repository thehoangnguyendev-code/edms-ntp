package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.dto.knowledge.KnowledgeHierarchyDtos.FieldOption;
import com.eqms.dto.knowledge.KnowledgeHierarchyDtos.HierarchyRequest;
import com.eqms.dto.knowledge.KnowledgeHierarchyDtos.HierarchyResponse;
import com.eqms.dto.knowledge.KnowledgeHierarchyDtos.LevelRequest;
import com.eqms.dto.knowledge.KnowledgeHierarchyDtos.LevelResponse;
import com.eqms.dto.user.PageResponse;
import com.eqms.entity.KnowledgeCategoryHierarchy;
import com.eqms.entity.KnowledgeCategoryLevel;
import com.eqms.entity.UserAccount;
import com.eqms.enums.KnowledgeField;
import com.eqms.exception.RevisionLifecycleConflictException;
import com.eqms.repository.KnowledgeCategoryHierarchyRepository;
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
 * Administration of Knowledge Categories Hierarchies. Every change is written to the Audit Trail with
 * the before/after value of each field touched, so the record shows who changed what.
 */
@Service
public class KnowledgeHierarchyService {

    static final String ENTITY_TYPE = "KNOWLEDGE_HIERARCHY";
    private static final String VIEW = "documents.admin.knowledge_categories.view";
    private static final String MANAGE = "documents.admin.knowledge_categories.manage";

    private final KnowledgeCategoryHierarchyRepository repository;
    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissionEvaluationService;
    private final AuditTrailService auditTrailService;
    private final KnowledgeComponentService componentService;

    public KnowledgeHierarchyService(
            KnowledgeCategoryHierarchyRepository repository,
            CurrentUserService currentUserService,
            PermissionEvaluationService permissionEvaluationService,
            AuditTrailService auditTrailService,
            KnowledgeComponentService componentService
    ) {
        this.repository = repository;
        this.currentUserService = currentUserService;
        this.permissionEvaluationService = permissionEvaluationService;
        this.auditTrailService = auditTrailService;
        this.componentService = componentService;
    }

    // ---- reads ----------------------------------------------------------------------------

    @Transactional(readOnly = true)
    public PageResponse<HierarchyResponse> list(String search, String status, String updatedFrom, String updatedTo,
                                                 int page, int limit, String sortBy, String sortDir) {
        requireView();
        String query = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        List<HierarchyResponse> filtered = new ArrayList<>(repository.findAll().stream()
                .filter(h -> !StringUtils.hasText(status) || "ALL".equalsIgnoreCase(status)
                        || ("ACTIVE".equalsIgnoreCase(status) == h.isActive()))
                .filter(h -> com.eqms.util.DateRangeFilter.matches(h.getUpdatedAt(), updatedFrom, updatedTo))
                .filter(h -> query.isEmpty()
                        || h.getName().toLowerCase(Locale.ROOT).contains(query)
                        || (h.getDescription() != null && h.getDescription().toLowerCase(Locale.ROOT).contains(query)))
                .map(this::toResponse)
                .toList());
        Comparator<HierarchyResponse> comparator = switch (sortBy == null ? "name" : sortBy) {
            case "determinatorField" -> Comparator.comparing(HierarchyResponse::determinatorLabel, String.CASE_INSENSITIVE_ORDER);
            case "active" -> Comparator.comparing(HierarchyResponse::active);
            case "levels" -> Comparator.comparingInt((HierarchyResponse h) -> h.levels().size());
            case "updatedBy" -> Comparator.comparing((HierarchyResponse h) -> Objects.toString(h.updatedByName(), ""), String.CASE_INSENSITIVE_ORDER);
            case "updatedAt" -> Comparator.comparing(HierarchyResponse::updatedAt, Comparator.nullsLast(Comparator.naturalOrder()));
            default -> Comparator.comparing(HierarchyResponse::name, String.CASE_INSENSITIVE_ORDER);
        };
        if ("desc".equalsIgnoreCase(sortDir)) comparator = comparator.reversed();
        filtered.sort(comparator);
        return PagedList.paginate(filtered, page, limit);
    }

    @Transactional(readOnly = true)
    public HierarchyResponse get(UUID id) {
        requireView();
        return toResponse(require(id));
    }

    public List<FieldOption> fieldOptions() {
        requireView();
        return componentService.activeComponents().stream()
                .map(c -> new FieldOption(c.getSourceField(), c.getName(),
                        KnowledgeField.parse(c.getSourceField()).map(KnowledgeField::determinatorEligible).orElse(false)))
                .toList();
    }

    // ---- writes ---------------------------------------------------------------------------

    @Transactional
    public HierarchyResponse create(HierarchyRequest request) {
        UserAccount actor = requireManage();
        String name = requireName(request);
        KnowledgeField determinator = requireDeterminator(request);
        if (repository.existsByNameIgnoreCase(name)) {
            throw new IllegalArgumentException("A hierarchy named '" + name + "' already exists");
        }
        KnowledgeCategoryHierarchy hierarchy = new KnowledgeCategoryHierarchy();
        hierarchy.setName(name);
        hierarchy.setDescription(clean(request.description()));
        hierarchy.setDeterminatorField(determinator.name());
        hierarchy.setActive(request.active() == null || request.active());
        hierarchy.setCreatedBy(actor);
        hierarchy.setUpdatedBy(actor);
        // The first hierarchy ever created becomes the default so the portal always has one.
        hierarchy.setDefaultHierarchy(hierarchy.isActive() && repository.findByDefaultHierarchyTrue().isEmpty());
        hierarchy = repository.save(hierarchy);
        audit(actor, hierarchy, "KNOWLEDGE_HIERARCHY_CREATED", null, "Active".equals(state(hierarchy)) ? "Active" : "Inactive",
                "Created Knowledge Categories Hierarchy '" + name + "'",
                List.of(change("Name", null, name),
                        change("Knowledge Base Field Determinator", null, label(determinator.name())),
                        change("Description", null, hierarchy.getDescription()),
                        change("Active", null, yesNo(hierarchy.isActive())),
                        change("Default", null, yesNo(hierarchy.isDefaultHierarchy()))));
        return toResponse(hierarchy);
    }

    @Transactional
    public HierarchyResponse update(UUID id, HierarchyRequest request) {
        UserAccount actor = requireManage();
        KnowledgeCategoryHierarchy hierarchy = require(id);
        String name = requireName(request);
        KnowledgeField determinator = requireDeterminator(request);
        if (repository.existsByNameIgnoreCaseAndIdNot(name, id)) {
            throw new IllegalArgumentException("A hierarchy named '" + name + "' already exists");
        }
        boolean active = request.active() == null || request.active();
        if (!active && hierarchy.isDefaultHierarchy()) {
            throw new RevisionLifecycleConflictException("DEFAULT_HIERARCHY_INACTIVE",
                    "The default hierarchy cannot be deactivated. Make another hierarchy the default first.");
        }
        boolean determinatorChanged = !determinator.name().equals(hierarchy.getDeterminatorField());
        List<KnowledgeField> desiredLevels = request.levels() == null ? null : validateDesiredLevels(hierarchy, request.levels(), determinator);
        if (desiredLevels == null && hierarchy.getLevels().stream().anyMatch(l -> l.getFieldCode().equals(determinator.name()))) {
            throw new IllegalArgumentException("'" + label(determinator.name()) + "' is already used as a level. Remove that level first.");
        }
        List<AuditTrailChangeResponse> changes = new ArrayList<>();
        addIfChanged(changes, "Name", hierarchy.getName(), name);
        addIfChanged(changes, "Description", hierarchy.getDescription(), clean(request.description()));
        if (determinatorChanged) {
            changes.add(change("Knowledge Base Field Determinator", label(hierarchy.getDeterminatorField()), label(determinator.name())));
        }
        addIfChanged(changes, "Active", yesNo(hierarchy.isActive()), yesNo(active));
        List<AuditTrailChangeResponse> levelChanges = desiredLevels == null ? List.of() : levelChanges(hierarchy, desiredLevels);
        if (changes.isEmpty() && levelChanges.isEmpty()) {
            return toResponse(hierarchy);
        }
        hierarchy.setName(name);
        hierarchy.setDescription(clean(request.description()));
        hierarchy.setDeterminatorField(determinator.name());
        hierarchy.setActive(active);
        hierarchy.setUpdatedBy(actor);
        if (!levelChanges.isEmpty()) {
            applyLevels(hierarchy, request.levels(), desiredLevels);
        }
        repository.save(hierarchy);
        if (!changes.isEmpty()) {
            audit(actor, hierarchy, "KNOWLEDGE_HIERARCHY_UPDATED", null, null,
                    "Updated Knowledge Categories Hierarchy '" + name + "': " + summarize(changes), changes);
        }
        if (!levelChanges.isEmpty()) {
            audit(actor, hierarchy, "KNOWLEDGE_HIERARCHY_LEVELS_CHANGED", null, null,
                    "Changed the levels of '" + name + "': " + summarize(levelChanges), levelChanges);
        }
        return toResponse(hierarchy);
    }

    @Transactional
    public HierarchyResponse setDefault(UUID id) {
        UserAccount actor = requireManage();
        KnowledgeCategoryHierarchy hierarchy = require(id);
        if (!hierarchy.isActive()) {
            throw new RevisionLifecycleConflictException("HIERARCHY_INACTIVE", "An inactive hierarchy cannot be the default.");
        }
        if (hierarchy.isDefaultHierarchy()) {
            return toResponse(hierarchy);
        }
        KnowledgeCategoryHierarchy previous = repository.findByDefaultHierarchyTrue().orElse(null);
        if (previous != null) {
            previous.setDefaultHierarchy(false);
            previous.setUpdatedBy(actor);
            repository.saveAndFlush(previous);
        }
        hierarchy.setDefaultHierarchy(true);
        hierarchy.setUpdatedBy(actor);
        repository.save(hierarchy);
        audit(actor, hierarchy, "KNOWLEDGE_HIERARCHY_DEFAULT_CHANGED", null, null,
                "'" + hierarchy.getName() + "' is now the default Knowledge Categories Hierarchy"
                        + (previous == null ? "" : " (was '" + previous.getName() + "')"),
                List.of(change("Default hierarchy", previous == null ? "-" : previous.getName(), hierarchy.getName())));
        return toResponse(hierarchy);
    }

    @Transactional
    public void delete(UUID id) {
        UserAccount actor = requireManage();
        KnowledgeCategoryHierarchy hierarchy = require(id);
        if (hierarchy.isDefaultHierarchy()) {
            throw new RevisionLifecycleConflictException("DEFAULT_HIERARCHY_DELETE",
                    "The default hierarchy cannot be deleted. Make another hierarchy the default first.");
        }
        List<AuditTrailChangeResponse> changes = new ArrayList<>();
        changes.add(change("Name", hierarchy.getName(), null));
        changes.add(change("Knowledge Base Field Determinator", label(hierarchy.getDeterminatorField()), null));
        hierarchy.getLevels().forEach(l -> changes.add(change("Level " + l.getDisplayOrder(), label(l.getFieldCode()), null)));
        repository.delete(hierarchy);
        audit(actor, hierarchy, "KNOWLEDGE_HIERARCHY_DELETED", state(hierarchy), "Deleted",
                "Deleted Knowledge Categories Hierarchy '" + hierarchy.getName() + "' with " + hierarchy.getLevels().size() + " level(s)", changes);
    }

    @Transactional
    public HierarchyResponse addLevel(UUID hierarchyId, LevelRequest request) {
        UserAccount actor = requireManage();
        KnowledgeCategoryHierarchy hierarchy = require(hierarchyId);
        KnowledgeField field = requireField(request == null ? null : request.fieldCode());
        int order = requireOrder(request);
        validateLevel(hierarchy, field, order, null);
        KnowledgeCategoryLevel level = new KnowledgeCategoryLevel();
        level.setHierarchy(hierarchy);
        level.setFieldCode(field.name());
        level.setDisplayOrder(order);
        hierarchy.getLevels().add(level);
        hierarchy.setUpdatedBy(actor);
        repository.save(hierarchy);
        audit(actor, hierarchy, "KNOWLEDGE_HIERARCHY_LEVEL_ADDED", null, null,
                "Added level '" + label(field.name()) + "' (order " + order + ") to '" + hierarchy.getName() + "'",
                List.of(change("Level " + order, null, label(field.name()))));
        return toResponse(hierarchy);
    }

    @Transactional
    public HierarchyResponse updateLevel(UUID hierarchyId, UUID levelId, LevelRequest request) {
        UserAccount actor = requireManage();
        KnowledgeCategoryHierarchy hierarchy = require(hierarchyId);
        KnowledgeCategoryLevel level = hierarchy.getLevels().stream().filter(l -> l.getId().equals(levelId)).findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Level not found"));
        KnowledgeField field = requireField(request == null ? null : request.fieldCode());
        int order = requireOrder(request);
        validateLevel(hierarchy, field, order, levelId);
        List<AuditTrailChangeResponse> changes = new ArrayList<>();
        addIfChanged(changes, "Level field (order " + level.getDisplayOrder() + ")", label(level.getFieldCode()), label(field.name()));
        addIfChanged(changes, "Order of '" + label(field.name()) + "'", String.valueOf(level.getDisplayOrder()), String.valueOf(order));
        if (changes.isEmpty()) {
            return toResponse(hierarchy);
        }
        level.setFieldCode(field.name());
        level.setDisplayOrder(order);
        hierarchy.setUpdatedBy(actor);
        repository.save(hierarchy);
        audit(actor, hierarchy, "KNOWLEDGE_HIERARCHY_LEVEL_UPDATED", null, null,
                "Updated a level of '" + hierarchy.getName() + "': " + summarize(changes), changes);
        return toResponse(hierarchy);
    }

    private List<KnowledgeField> validateDesiredLevels(KnowledgeCategoryHierarchy hierarchy,
                                                       List<com.eqms.dto.knowledge.KnowledgeHierarchyDtos.LevelInput> desired,
                                                       KnowledgeField determinator) {
        java.util.Set<UUID> existingIds = hierarchy.getLevels().stream().map(KnowledgeCategoryLevel::getId).collect(java.util.stream.Collectors.toSet());
        java.util.Set<String> seenFields = new java.util.HashSet<>();
        java.util.Set<UUID> seenIds = new java.util.HashSet<>();
        List<KnowledgeField> fields = new ArrayList<>();
        for (var input : desired) {
            KnowledgeField field = requireField(input == null ? null : input.fieldCode());
            if (field == determinator) {
                throw new IllegalArgumentException("'" + label(field.name()) + "' is the Knowledge Base determinator and cannot also be a level");
            }
            if (!seenFields.add(field.name())) {
                throw new IllegalArgumentException("'" + label(field.name()) + "' is used by more than one level");
            }
            if (input.id() != null && (!existingIds.contains(input.id()) || !seenIds.add(input.id()))) {
                throw new IllegalArgumentException("Level not found");
            }
            fields.add(field);
        }
        return fields;
    }

    /** Position-by-position before/after of the level list (desired vs current). */
    private List<AuditTrailChangeResponse> levelChanges(KnowledgeCategoryHierarchy hierarchy, List<KnowledgeField> desiredFields) {
        List<KnowledgeCategoryLevel> current = hierarchy.getLevels().stream()
                .sorted(Comparator.comparingInt(KnowledgeCategoryLevel::getDisplayOrder)).toList();
        List<AuditTrailChangeResponse> changes = new ArrayList<>();
        int size = Math.max(current.size(), desiredFields.size());
        for (int i = 0; i < size; i++) {
            String before = i < current.size() ? label(current.get(i).getFieldCode()) : null;
            String after = i < desiredFields.size() ? label(desiredFields.get(i).name()) : null;
            if (!Objects.equals(before, after)) {
                changes.add(change("Level " + (i + 1), before, after));
            }
        }
        return changes;
    }

    /** Replaces the level list in place, in phases so the unique field and order constraints never collide. */
    private void applyLevels(KnowledgeCategoryHierarchy hierarchy,
                             List<com.eqms.dto.knowledge.KnowledgeHierarchyDtos.LevelInput> desired,
                             List<KnowledgeField> desiredFields) {
        java.util.Set<UUID> keep = desired.stream().map(com.eqms.dto.knowledge.KnowledgeHierarchyDtos.LevelInput::id)
                .filter(Objects::nonNull).collect(java.util.stream.Collectors.toSet());
        hierarchy.getLevels().removeIf(l -> !keep.contains(l.getId()));
        repository.saveAndFlush(hierarchy);
        int parking = 0;
        for (KnowledgeCategoryLevel level : hierarchy.getLevels()) {
            level.setDisplayOrder(1_000_000 + (++parking));
            level.setFieldCode("TMP" + parking + "_" + level.getId().toString().substring(0, 8));
        }
        repository.saveAndFlush(hierarchy);
        int order = 10;
        for (int i = 0; i < desired.size(); i++) {
            var input = desired.get(i);
            KnowledgeCategoryLevel level = input.id() == null ? null : hierarchy.getLevels().stream()
                    .filter(l -> l.getId().equals(input.id())).findFirst().orElse(null);
            if (level == null) {
                level = new KnowledgeCategoryLevel();
                level.setHierarchy(hierarchy);
                hierarchy.getLevels().add(level);
            }
            level.setFieldCode(desiredFields.get(i).name());
            level.setDisplayOrder(order);
            order += 10;
        }
    }

    /** Puts the levels in the given order (first = 10, then 20, ...). Every level must be listed exactly once. */
    @Transactional
    public HierarchyResponse reorderLevels(UUID hierarchyId, List<UUID> orderedLevelIds) {
        UserAccount actor = requireManage();
        KnowledgeCategoryHierarchy hierarchy = require(hierarchyId);
        List<KnowledgeCategoryLevel> current = hierarchy.getLevels();
        if (orderedLevelIds == null || orderedLevelIds.size() != current.size()
                || !new java.util.HashSet<>(orderedLevelIds).equals(
                        current.stream().map(KnowledgeCategoryLevel::getId).collect(java.util.stream.Collectors.toSet()))) {
            throw new IllegalArgumentException("The new order must list every level of this hierarchy exactly once");
        }
        String before = current.stream().sorted(Comparator.comparingInt(KnowledgeCategoryLevel::getDisplayOrder))
                .map(l -> label(l.getFieldCode())).collect(java.util.stream.Collectors.joining(" > "));
        // Two phases so the (hierarchy, order) unique constraint never sees a duplicate mid-update.
        current.forEach(l -> l.setDisplayOrder(l.getDisplayOrder() + 1_000_000));
        repository.saveAndFlush(hierarchy);
        int order = 10;
        for (UUID id : orderedLevelIds) {
            KnowledgeCategoryLevel level = current.stream().filter(l -> l.getId().equals(id)).findFirst().orElseThrow();
            level.setDisplayOrder(order);
            order += 10;
        }
        String after = orderedLevelIds.stream()
                .map(id -> current.stream().filter(l -> l.getId().equals(id)).findFirst().map(l -> label(l.getFieldCode())).orElse("?"))
                .collect(java.util.stream.Collectors.joining(" > "));
        hierarchy.setUpdatedBy(actor);
        repository.save(hierarchy);
        if (!before.equals(after)) {
            audit(actor, hierarchy, "KNOWLEDGE_HIERARCHY_LEVELS_REORDERED", null, null,
                    "Reordered the levels of '" + hierarchy.getName() + "'", List.of(change("Level order", before, after)));
        }
        return toResponse(hierarchy);
    }

    @Transactional
    public HierarchyResponse removeLevel(UUID hierarchyId, UUID levelId) {
        UserAccount actor = requireManage();
        KnowledgeCategoryHierarchy hierarchy = require(hierarchyId);
        KnowledgeCategoryLevel level = hierarchy.getLevels().stream().filter(l -> l.getId().equals(levelId)).findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Level not found"));
        hierarchy.getLevels().remove(level);
        hierarchy.setUpdatedBy(actor);
        repository.save(hierarchy);
        audit(actor, hierarchy, "KNOWLEDGE_HIERARCHY_LEVEL_REMOVED", null, null,
                "Removed level '" + label(level.getFieldCode()) + "' (order " + level.getDisplayOrder() + ") from '" + hierarchy.getName() + "'",
                List.of(change("Level " + level.getDisplayOrder(), label(level.getFieldCode()), null)));
        return toResponse(hierarchy);
    }

    // ---- shared ---------------------------------------------------------------------------

    /** The hierarchy that drives the portal and the Knowledge Base field of new documents, if any. */
    @Transactional(readOnly = true)
    public KnowledgeCategoryHierarchy defaultHierarchyOrNull() {
        return repository.findByDefaultHierarchyTrue().orElse(null);
    }

    private void validateLevel(KnowledgeCategoryHierarchy hierarchy, KnowledgeField field, int order, UUID ignoreLevelId) {
        if (field.name().equals(hierarchy.getDeterminatorField())) {
            throw new IllegalArgumentException("'" + label(field.name()) + "' is the Knowledge Base determinator and cannot also be a level");
        }
        for (KnowledgeCategoryLevel existing : hierarchy.getLevels()) {
            if (ignoreLevelId != null && Objects.equals(existing.getId(), ignoreLevelId)) continue;
            if (existing.getFieldCode().equals(field.name())) {
                throw new IllegalArgumentException("'" + label(field.name()) + "' is already a level of this hierarchy");
            }
            if (existing.getDisplayOrder() == order) {
                throw new IllegalArgumentException("Order " + order + " is already used by '" + label(existing.getFieldCode()) + "'");
            }
        }
    }

    private HierarchyResponse toResponse(KnowledgeCategoryHierarchy h) {
        List<LevelResponse> levels = h.getLevels().stream()
                .sorted(Comparator.comparingInt(KnowledgeCategoryLevel::getDisplayOrder))
                .map(l -> new LevelResponse(l.getId(), l.getFieldCode(), label(l.getFieldCode()), l.getDisplayOrder()))
                .toList();
        UserAccount updater = h.getUpdatedBy();
        return new HierarchyResponse(h.getId(), h.getName(), h.getDescription(), h.getDeterminatorField(),
                label(h.getDeterminatorField()), h.isActive(), h.isDefaultHierarchy(), levels, h.getCreatedAt(), h.getUpdatedAt(),
                updater == null ? null : (StringUtils.hasText(updater.getFullName()) ? updater.getFullName() : updater.getUsername()));
    }

    private void audit(UserAccount actor, KnowledgeCategoryHierarchy h, String action, String from, String to,
                       String comment, List<AuditTrailChangeResponse> changes) {
        auditTrailService.logAs(actor, ENTITY_TYPE, h.getName(), h.getId(), action, from, to, comment, changes);
    }

    private static AuditTrailChangeResponse change(String field, String oldValue, String newValue) {
        return new AuditTrailChangeResponse(field, oldValue == null ? "-" : oldValue, newValue == null ? "-" : newValue);
    }

    private static void addIfChanged(List<AuditTrailChangeResponse> changes, String field, String oldValue, String newValue) {
        if (!Objects.equals(oldValue == null ? "" : oldValue, newValue == null ? "" : newValue)) {
            changes.add(change(field, oldValue, newValue));
        }
    }

    private static String summarize(List<AuditTrailChangeResponse> changes) {
        return String.join("; ", changes.stream()
                .map(c -> c.field() + " '" + c.oldValue() + "' -> '" + c.newValue() + "'").toList());
    }

    private String label(String fieldCode) {
        return componentService.nameOf(fieldCode);
    }

    private static String yesNo(boolean value) {
        return value ? "Yes" : "No";
    }

    private static String state(KnowledgeCategoryHierarchy h) {
        return h.isActive() ? "Active" : "Inactive";
    }

    private static String clean(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private static String requireName(HierarchyRequest request) {
        if (request == null || !StringUtils.hasText(request.name())) {
            throw new IllegalArgumentException("Name is required");
        }
        String name = request.name().trim();
        if (name.length() > 200) {
            throw new IllegalArgumentException("Name must be at most 200 characters");
        }
        return name;
    }

    private KnowledgeField requireDeterminator(HierarchyRequest request) {
        KnowledgeField field = requireField(request == null ? null : request.determinatorField(), "Knowledge Base Field Determinator is required");
        if (!field.determinatorEligible()) {
            throw new IllegalArgumentException("'" + label(field.name()) + "' cannot be a Knowledge Base determinator. Choose a field with one low-cardinality value per document.");
        }
        return field;
    }

    private KnowledgeField requireField(String code) {
        return requireField(code, "Field is required");
    }

    private KnowledgeField requireField(String code, String missingMessage) {
        if (!StringUtils.hasText(code)) {
            throw new IllegalArgumentException(missingMessage);
        }
        KnowledgeField field = KnowledgeField.parse(code).orElseThrow(() -> new IllegalArgumentException("Unknown field: " + code));
        if (!componentService.isActiveSource(field.name())) {
            throw new IllegalArgumentException("'" + label(field.name()) + "' has no active Knowledge Category Component");
        }
        return field;
    }

    private static int requireOrder(LevelRequest request) {
        if (request == null || request.displayOrder() == null || request.displayOrder() < 1) {
            throw new IllegalArgumentException("Order must be a positive number");
        }
        return request.displayOrder();
    }

    private KnowledgeCategoryHierarchy require(UUID id) {
        return repository.findById(id).orElseThrow(() -> new IllegalArgumentException("Knowledge Categories Hierarchy not found"));
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
