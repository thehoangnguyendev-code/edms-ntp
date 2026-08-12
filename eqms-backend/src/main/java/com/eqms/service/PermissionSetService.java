package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import org.springframework.security.access.AccessDeniedException;
import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.dto.user.PermissionSetCapabilitiesResponse;
import com.eqms.dto.user.PermissionSetRequest;
import com.eqms.dto.user.PermissionSetResponse;
import com.eqms.entity.Permission;
import com.eqms.entity.PermissionSet;
import com.eqms.entity.PermissionSetItem;
import com.eqms.entity.UserAccount;
import com.eqms.repository.AccessProfilePermissionSetRepository;
import com.eqms.repository.PermissionRepository;
import com.eqms.repository.PermissionSetItemRepository;
import com.eqms.repository.PermissionSetRepository;
import com.eqms.repository.UserAccessProfileRepository;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;

@Service
public class PermissionSetService {

    private static final String ENTITY_TYPE = "PERMISSION_SET";
    /** Code prefix of auto-managed per-role permission sets (created/edited only via the role editor). */
    static final String MANAGED_SET_PREFIX = "ROLE_";
    private static final String VIEW_PERMISSION = "security.permission_sets.view";
    private static final String MANAGE_PERMISSION = "security.permission_sets.update";

    private final PermissionSetRepository permissionSetRepository;
    private final PermissionSetItemRepository permissionSetItemRepository;
    private final PermissionRepository permissionRepository;
    private final AccessProfilePermissionSetRepository accessProfilePermissionSetRepository;
    private final UserAccessProfileRepository userAccessProfileRepository;
    private final CurrentUserService currentUserService;
    private final AuditTrailService auditTrailService;
    private final PermissionEvaluationService permissionEvaluationService;
    private final SecurityChangeSignatureService securityChangeSignatureService;

    public PermissionSetService(
            PermissionSetRepository permissionSetRepository,
            PermissionSetItemRepository permissionSetItemRepository,
            PermissionRepository permissionRepository,
            AccessProfilePermissionSetRepository accessProfilePermissionSetRepository,
            UserAccessProfileRepository userAccessProfileRepository,
            CurrentUserService currentUserService,
            AuditTrailService auditTrailService,
            PermissionEvaluationService permissionEvaluationService,
            SecurityChangeSignatureService securityChangeSignatureService) {
        this.permissionSetRepository = permissionSetRepository;
        this.permissionSetItemRepository = permissionSetItemRepository;
        this.permissionRepository = permissionRepository;
        this.accessProfilePermissionSetRepository = accessProfilePermissionSetRepository;
        this.userAccessProfileRepository = userAccessProfileRepository;
        this.currentUserService = currentUserService;
        this.auditTrailService = auditTrailService;
        this.permissionEvaluationService = permissionEvaluationService;
        this.securityChangeSignatureService = securityChangeSignatureService;
    }

    @Transactional
    public List<PermissionSetResponse> listAll() {
        return listAll(false);
    }

    @Transactional
    public List<PermissionSetResponse> listAll(boolean includeManaged) {
        requireView();
        return permissionSetRepository.findAllByOrderByNameAsc()
                .stream()
                .filter(ps -> includeManaged || !isManagedSetCode(ps.getCode()))
                .map(this::toResponse).toList();
    }

    /** Auto-managed per-role sets (ROLE_ prefix) are hidden from the shared list by default. */
    static boolean isManagedSetCode(String code) {
        return code != null && code.startsWith(MANAGED_SET_PREFIX);
    }

    @Transactional
    public PermissionSetResponse getById(UUID id) {
        requireView();
        return toResponse(require(id));
    }

    @Transactional
    public PermissionSetCapabilitiesResponse getCapabilities(UUID id) {
        UserAccount user = currentUserService.requireCurrentUser();
        PermissionSet ps = require(id);
        boolean canView = canView(user);
        boolean canManage = canManage(user);
        long usageCount = accessProfilePermissionSetRepository.countByPermissionSetId(id);
        Map<String, PermissionSetCapabilitiesResponse.ActionCapability> actions = new java.util.LinkedHashMap<>();
        actions.put("view", capability(canView, VIEW_PERMISSION, "Permission set view permission required"));
        actions.put("edit", capability(canManage, MANAGE_PERMISSION, "Permission set management permission required"));
        actions.put("clone", capability(canManage, MANAGE_PERMISSION, "Permission set management permission required"));
        actions.put("toggleStatus", capability(
                canManage && !(ps.isSystem() && ps.isActive()),
                MANAGE_PERMISSION,
                !canManage ? "Permission set management permission required"
                        : "System permission sets cannot be deactivated"));
        actions.put("delete", capability(
                canManage && !ps.isSystem() && usageCount == 0,
                MANAGE_PERMISSION,
                !canManage ? "Permission set management permission required"
                        : ps.isSystem() ? "System permission sets cannot be deleted"
                        : usageCount > 0 ? "Permission set is assigned to access profiles and cannot be deleted"
                        : null));
        return new PermissionSetCapabilitiesResponse(id, actions);
    }

    @Transactional
    public PermissionSetResponse create(PermissionSetRequest request) {
        requireManage();
        UserAccount actor = currentUserService.requireCurrentUser();
        securityChangeSignatureService.requireValidToken(actor, request.signatureToken());

        if (!StringUtils.hasText(request.name())) {
            throw new IllegalArgumentException("Permission set name is required");
        }
        if (permissionSetRepository.findByName(request.name()).isPresent()) {
            throw new IllegalArgumentException("A permission set with name \"" + request.name() + "\" already exists");
        }
        String code = StringUtils.hasText(request.code())
                ? request.code().trim().toUpperCase()
                : request.name().toUpperCase().replaceAll("[^A-Z0-9_]", "_");
        if (permissionSetRepository.findByCode(code).isPresent()) {
            throw new IllegalArgumentException("A permission set with code \"" + code + "\" already exists");
        }

        PermissionSet ps = new PermissionSet();
        ps.setName(request.name().trim());
        ps.setCode(code);
        ps.setDescription(request.description());
        ps.setActive(request.active());
        ps.setCreatedBy(actor);
        ps.setUpdatedBy(actor);
        permissionSetRepository.save(ps);

        List<String> assignedCodes = assignPermissions(ps, request.permissionCodes());

        List<AuditTrailChangeResponse> changes = new ArrayList<>();
        addChange(changes, "Name", null, ps.getName());
        addChange(changes, "Code", null, ps.getCode());
        addChange(changes, "Status", null, ps.isActive() ? "Active" : "Inactive");
        addChange(changes, "Permissions", null, formatCodes(assignedCodes));

        auditTrailService.log(
                ENTITY_TYPE,
                ps.getName(),
                ps.getId(),
                "CREATED",
                null,
                "Active",
                "Created permission set with " + assignedCodes.size() + " permissions",
                changes);

        securityChangeSignatureService.record(actor, request.signatureToken(),
                SecurityChangeSignatureService.MEANING_PERMISSION_SET_CHANGE,
                ENTITY_TYPE, ps.getId(), ps.getName(), request.reason(),
                null, formatCodes(assignedCodes));
        permissionEvaluationService.clearCache();
        return toResponse(permissionSetRepository.findById(ps.getId()).orElseThrow());
    }

    @Transactional
    public PermissionSetResponse update(UUID id, PermissionSetRequest request) {
        requireManage();
        UserAccount actor = currentUserService.requireCurrentUser();
        securityChangeSignatureService.requireValidToken(actor, request.signatureToken());
        PermissionSet ps = require(id);
        String oldName = ps.getName();
        String oldDescription = ps.getDescription();
        boolean oldActive = ps.isActive();
        List<String> oldCodes = getPermissionCodes(id);

        if (!StringUtils.hasText(request.name())) {
            throw new IllegalArgumentException("Permission set name is required");
        }
        if (ps.isSystem() && !request.active()) {
            throw new IllegalArgumentException("System permission sets cannot be deactivated");
        }

        permissionSetRepository.findByName(request.name()).ifPresent(existing -> {
            if (!existing.getId().equals(id)) {
                throw new IllegalArgumentException("A permission set with name \"" + request.name() + "\" already exists");
            }
        });

        ps.setName(request.name().trim());
        ps.setDescription(request.description());
        ps.setActive(request.active());
        ps.setUpdatedBy(actor);

        permissionSetItemRepository.deleteAllByPermissionSet_Id(id);
        List<String> newCodes = assignPermissions(ps, request.permissionCodes());

        List<AuditTrailChangeResponse> changes = new ArrayList<>();
        addChange(changes, "Name", oldName, ps.getName());
        addChange(changes, "Description", oldDescription, ps.getDescription());
        addChange(changes, "Status", oldActive ? "Active" : "Inactive", ps.isActive() ? "Active" : "Inactive");
        addChange(changes, "Permissions", formatCodes(oldCodes), formatCodes(newCodes));

        auditTrailService.log(
                ENTITY_TYPE,
                ps.getName(),
                ps.getId(),
                "UPDATED",
                oldActive ? "Active" : "Inactive",
                ps.isActive() ? "Active" : "Inactive",
                "Updated permission set",
                changes);

        securityChangeSignatureService.record(actor, request.signatureToken(),
                SecurityChangeSignatureService.MEANING_PERMISSION_SET_CHANGE,
                ENTITY_TYPE, ps.getId(), ps.getName(), request.reason(),
                formatCodes(oldCodes), formatCodes(newCodes));
        permissionEvaluationService.clearCache();
        return toResponse(permissionSetRepository.save(ps));
    }

    @Transactional
    public void delete(UUID id, com.eqms.dto.settings.SecurityChangeRequest sig) {
        requireManage();
        UserAccount actor = currentUserService.requireCurrentUser();
        sig = com.eqms.dto.settings.SecurityChangeRequest.orEmpty(sig);
        securityChangeSignatureService.requireValidToken(actor, sig.signatureToken());
        PermissionSet ps = require(id);
        if (ps.isSystem()) {
            throw new IllegalArgumentException("System permission sets cannot be deleted");
        }
        long usageCount = accessProfilePermissionSetRepository.countByPermissionSetId(id);
        if (usageCount > 0) {
            throw new IllegalArgumentException("Permission set is assigned to " + usageCount + " access profile(s). Deactivate it instead of deleting.");
        }
        List<String> oldCodes = getPermissionCodes(id);
        List<AuditTrailChangeResponse> changes = List.of(
                new AuditTrailChangeResponse("Name", ps.getName(), null),
                new AuditTrailChangeResponse("Code", ps.getCode(), null),
                new AuditTrailChangeResponse("Permissions", formatCodes(oldCodes), null)
        );
        auditTrailService.log(
                ENTITY_TYPE,
                ps.getName(),
                ps.getId(),
                "DELETED",
                ps.isActive() ? "Active" : "Inactive",
                null,
                "Deleted permission set",
                changes);
        permissionSetRepository.delete(ps);
        securityChangeSignatureService.record(actor, sig.signatureToken(),
                SecurityChangeSignatureService.MEANING_PERMISSION_SET_CHANGE,
                ENTITY_TYPE, id, ps.getName(), sig.reason(),
                formatCodes(oldCodes), null);
        permissionEvaluationService.clearCache();
    }

    @Transactional
    public List<com.eqms.dto.user.PermissionSetAssignedAccessProfileResponse> getAssignedAccessProfiles(UUID id) {
        requireView();
        require(id);
        return accessProfilePermissionSetRepository.findByPermissionSetId(id).stream()
                .map(com.eqms.entity.AccessProfilePermissionSet::getAccessProfile)
                .filter(Objects::nonNull)
                .sorted(Comparator.comparing(com.eqms.entity.RoleDefinition::getName, String.CASE_INSENSITIVE_ORDER))
                .map(profile -> new com.eqms.dto.user.PermissionSetAssignedAccessProfileResponse(
                        profile.getId(),
                        profile.getName(),
                        profile.getCode(),
                        profile.getBusinessUnitScope(),
                        profile.getDepartmentScope(),
                        profile.isActive(),
                        userAccessProfileRepository.countByAccessProfileId(profile.getId())))
                .toList();
    }

    /**
     * Creates an auto-managed permission set (ROLE_<profileCode>) on behalf of a role
     * orchestrator (e.g. atomic role creation). Deliberately does NOT check the
     * permission-set manage permission and does NOT consume/record an e-signature —
     * the calling orchestrator owns both, so exactly one signature covers the whole
     * role operation. Audit logging is still performed here.
     */
    public PermissionSet createManagedSet(String name, String code, List<String> codes, UserAccount actor) {
        String normalizedCode = code.trim().toUpperCase();
        if (permissionSetRepository.findByCode(normalizedCode).isPresent()) {
            throw new IllegalArgumentException("A permission set with code \"" + normalizedCode + "\" already exists");
        }
        PermissionSet ps = new PermissionSet();
        ps.setName(name);
        ps.setCode(normalizedCode);
        ps.setDescription("Individually picked permissions managed by the role editor.");
        ps.setActive(true);
        ps.setCreatedBy(actor);
        ps.setUpdatedBy(actor);
        permissionSetRepository.save(ps);
        List<String> assignedCodes = assignPermissions(ps, codes);
        auditTrailService.log(
                ENTITY_TYPE, ps.getName(), ps.getId(),
                "CREATED", null, "Active",
                "Created role-managed permission set with " + assignedCodes.size() + " permissions",
                List.of(new AuditTrailChangeResponse("Permissions", null, formatCodes(assignedCodes))));
        return ps;
    }

    /**
     * Replaces the items of an auto-managed set. Same no-gate/no-signature contract
     * as {@link #createManagedSet} — the orchestrator owns authorization and e-sign.
     */
    public List<String> replaceManagedSetItems(PermissionSet ps, List<String> codes, UserAccount actor) {
        List<String> oldCodes = getPermissionCodes(ps.getId());
        permissionSetItemRepository.deleteAllByPermissionSet_Id(ps.getId());
        List<String> newCodes = assignPermissions(ps, codes);
        ps.setUpdatedBy(actor);
        permissionSetRepository.save(ps);
        auditTrailService.log(
                ENTITY_TYPE, ps.getName(), ps.getId(),
                "UPDATED", "Active", "Active",
                "Replaced role-managed permissions",
                List.of(new AuditTrailChangeResponse("Permissions", formatCodes(oldCodes), formatCodes(newCodes))));
        return newCodes;
    }

    private List<String> assignPermissions(PermissionSet ps, List<String> codes) {
        if (codes == null || codes.isEmpty()) return List.of();
        List<String> normalizedCodes = codes.stream()
                .filter(StringUtils::hasText)
                .map(String::trim)
                .distinct()
                .toList();
        Map<String, Permission> byCode = permissionRepository.findAll().stream()
                .collect(Collectors.toMap(Permission::getCode, Function.identity(), (a, b) -> a));
        List<String> missing = normalizedCodes.stream()
                .filter(code -> !byCode.containsKey(code))
                .toList();
        if (!missing.isEmpty()) {
            throw new IllegalArgumentException("Unknown permission code(s): " + String.join(", ", missing));
        }

        Set<String> assigned = new LinkedHashSet<>();
        for (String code : normalizedCodes) {
            Permission p = byCode.get(code);
            PermissionSetItem item = new PermissionSetItem();
            item.setPermissionSet(ps);
            item.setPermission(p);
            permissionSetItemRepository.save(item);
            assigned.add(code);
        }
        return assigned.stream().sorted().toList();
    }

    private PermissionSet require(UUID id) {
        return permissionSetRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Permission set not found: " + id));
    }

    private void requireView() {
        UserAccount user = currentUserService.requireCurrentUser();
        if (!canView(user)) {
            throw new AccessDeniedException("Permission set view permission required");
        }
    }

    private void requireManage() {
        UserAccount user = currentUserService.requireCurrentUser();
        if (!canManage(user)) {
            throw new AccessDeniedException("Permission set management permission required");
        }
    }

    private boolean canView(UserAccount user) {
        return permissionEvaluationService.hasAnyPermission(user, VIEW_PERMISSION, MANAGE_PERMISSION);
    }

    private boolean canManage(UserAccount user) {
        return permissionEvaluationService.hasPermission(user, MANAGE_PERMISSION);
    }

    private PermissionSetCapabilitiesResponse.ActionCapability capability(boolean allowed, String requiredPermission, String deniedReason) {
        return new PermissionSetCapabilitiesResponse.ActionCapability(
                allowed,
                allowed ? null : deniedReason,
                requiredPermission);
    }

    private List<String> getPermissionCodes(UUID permissionSetId) {
        return permissionSetItemRepository.findAllByPermissionSet_Id(permissionSetId).stream()
                .map(i -> i.getPermission().getCode())
                .sorted()
                .toList();
    }

    private void addChange(List<AuditTrailChangeResponse> changes, String field, String oldValue, String newValue) {
        if (!Objects.equals(oldValue, newValue)) {
            changes.add(new AuditTrailChangeResponse(field, oldValue, newValue));
        }
    }

    private String formatCodes(List<String> codes) {
        if (codes == null || codes.isEmpty()) return "";
        return codes.stream()
                .sorted(Comparator.naturalOrder())
                .collect(Collectors.joining(", "));
    }

    private PermissionSetResponse toResponse(PermissionSet ps) {
        List<PermissionSetItem> items = permissionSetItemRepository.findAllByPermissionSet_Id(ps.getId());
        List<String> codes = items.stream().map(i -> i.getPermission().getCode()).sorted().toList();
        List<String> modules = items.stream()
                .map(i -> i.getPermission().getModuleKey())
                .filter(Objects::nonNull)
                .distinct()
                .sorted()
                .toList();
        return new PermissionSetResponse(
                ps.getId(), ps.getName(), ps.getCode(), ps.getDescription(),
                ps.isActive(), ps.isSystem(), codes.size(), codes,
                modules, inferCategory(modules),
                ps.getCreatedAt(), ps.getUpdatedAt());
    }

    /** Category bucket derived from module coverage — single source for the list filter. */
    static String inferCategory(List<String> modules) {
        if (modules.isEmpty()) return "Uncategorized";
        if (modules.size() > 1) return "Multi-Module";
        String module = modules.get(0).toLowerCase(java.util.Locale.ROOT);
        if (module.contains("document")) return "Document Management";
        if (module.contains("training")) return "Training";
        if (module.contains("report")) return "Reporting";
        if (module.contains("admin") || module.contains("security")) return "Administration";
        return modules.get(0);
    }

    /** Server-side list: search, filters, sort and pagination all resolved here. */
    @Transactional
    public com.eqms.dto.user.PageResponse<PermissionSetResponse> listPaged(
            int page, int limit, String search, String status, String type,
            String module, String category, String sortBy, String sortDir) {
        return listPaged(page, limit, search, status, type, module, category,
                null, null, null, null, sortBy, sortDir, false);
    }

    @Transactional
    public com.eqms.dto.user.PageResponse<PermissionSetResponse> listPaged(
            int page, int limit, String search, String status, String type,
            String module, String category, String sortBy, String sortDir, boolean includeManaged) {
        return listPaged(page, limit, search, status, type, module, category,
                null, null, null, null, sortBy, sortDir, includeManaged);
    }

    @Transactional
    public com.eqms.dto.user.PageResponse<PermissionSetResponse> listPaged(
            int page, int limit, String search, String status, String type,
            String module, String category,
            String createdFrom, String createdTo, String updatedFrom, String updatedTo,
            String sortBy, String sortDir, boolean includeManaged) {
        requireView();
        List<PermissionSetResponse> all = permissionSetRepository.findAllByOrderByNameAsc()
                .stream()
                .filter(ps -> includeManaged || !isManagedSetCode(ps.getCode()))
                .map(this::toResponse).collect(Collectors.toList());

        String q = search == null ? "" : search.trim().toLowerCase(java.util.Locale.ROOT);
        List<PermissionSetResponse> filtered = all.stream().filter(psr -> {
            if ("ACTIVE".equalsIgnoreCase(status) && !psr.active()) return false;
            if ("INACTIVE".equalsIgnoreCase(status) && psr.active()) return false;
            if ("SYSTEM".equalsIgnoreCase(type) && !psr.system()) return false;
            if ("CUSTOM".equalsIgnoreCase(type) && psr.system()) return false;
            if (StringUtils.hasText(module) && !"ALL".equalsIgnoreCase(module) && !psr.modules().contains(module)) return false;
            if (StringUtils.hasText(category) && !"ALL".equalsIgnoreCase(category) && !psr.category().equals(category)) return false;
            if (!isWithinDateRange(psr.createdAt(), createdFrom, createdTo)) return false;
            if (!isWithinDateRange(psr.updatedAt(), updatedFrom, updatedTo)) return false;
            if (q.isEmpty()) return true;
            return (psr.name() + " " + psr.code() + " " + (psr.description() == null ? "" : psr.description())
                    + " " + String.join(" ", psr.modules()) + " " + psr.category())
                    .toLowerCase(java.util.Locale.ROOT).contains(q);
        }).collect(Collectors.toList());

        Comparator<PermissionSetResponse> cmp = switch (sortBy == null ? "name" : sortBy) {
            case "permissionCount" -> Comparator.comparingInt(PermissionSetResponse::permissionCount);
            case "moduleCount" -> Comparator.comparingInt(psr -> psr.modules().size());
            case "status" -> Comparator.comparing(psr -> psr.active() ? 0 : 1);
            case "type" -> Comparator.comparing(psr -> psr.system() ? 0 : 1);
            case "createdAt" -> Comparator.comparing(PermissionSetResponse::createdAt, Comparator.nullsLast(Comparator.naturalOrder()));
            case "updatedAt" -> Comparator.comparing(PermissionSetResponse::updatedAt, Comparator.nullsLast(Comparator.naturalOrder()));
            default -> Comparator.comparing(PermissionSetResponse::name, String.CASE_INSENSITIVE_ORDER);
        };
        if ("desc".equalsIgnoreCase(sortDir)) cmp = cmp.reversed();
        filtered.sort(cmp);

        int safePage = Math.max(page, 1);
        int safeLimit = Math.max(limit, 1);
        int total = filtered.size();
        int totalPages = Math.max(1, (int) Math.ceil((double) total / safeLimit));
        int from = Math.min((safePage - 1) * safeLimit, total);
        int to = Math.min(from + safeLimit, total);
        return new com.eqms.dto.user.PageResponse<>(
                filtered.subList(from, to),
                new com.eqms.dto.user.PaginationResponse(safePage, safeLimit, total, totalPages));
    }

    /** Dropdown values for the list filters (modules, categories, statuses, types). */
    @Transactional
    public Map<String, List<String>> getListOptions() {
        requireView();
        List<PermissionSetResponse> all = permissionSetRepository.findAllByOrderByNameAsc()
                .stream().map(this::toResponse).toList();
        List<String> modules = all.stream().flatMap(psr -> psr.modules().stream()).distinct().sorted().toList();
        List<String> categories = all.stream().map(PermissionSetResponse::category).distinct().sorted().toList();
        return Map.of(
                "modules", modules,
                "categories", categories,
                "statuses", List.of("ACTIVE", "INACTIVE"),
                "types", List.of("SYSTEM", "CUSTOM"));
    }

    private static final DateTimeFormatter DATE_QUERY_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    /** DateRangePicker sends local calendar dates.  The end boundary is exclusive so an entire end day is included. */
    private boolean isWithinDateRange(Instant value, String from, String to) {
        if (value == null) return !StringUtils.hasText(from) && !StringUtils.hasText(to);
        Instant fromInstant = parseDayStart(from);
        if (fromInstant != null && value.isBefore(fromInstant)) return false;
        Instant toExclusive = parseDayEndExclusive(to);
        return toExclusive == null || value.isBefore(toExclusive);
    }

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
}
