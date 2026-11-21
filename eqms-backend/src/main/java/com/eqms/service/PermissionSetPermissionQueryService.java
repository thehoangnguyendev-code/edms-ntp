package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.user.PageResponse;
import com.eqms.dto.user.PermissionLifecycleUsageResponse;
import com.eqms.dto.user.PermissionSetPermissionPageResponse;
import com.eqms.dto.user.PermissionSetPermissionRowResponse;
import com.eqms.entity.Permission;
import com.eqms.entity.PermissionSetItem;
import com.eqms.entity.UserAccount;
import com.eqms.repository.PermissionSetItemRepository;
import com.eqms.repository.PermissionSetRepository;
import com.eqms.util.ModuleKeys;
import com.eqms.util.PagedList;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Search, Module filter and paging of the permissions of one Permission Set, done on the server (the dialog shows ten at a time).
 * Same access rule as reading the set itself: the Permission Set view (or manage) permission.
 */
@Service
public class PermissionSetPermissionQueryService {

    private static final String VIEW_PERMISSION = "security.permission_sets.view";
    private static final String MANAGE_PERMISSION = "security.permission_sets.manage";
    static final int MAX_LIMIT = 50;

    private final PermissionSetRepository permissionSetRepository;
    private final PermissionSetItemRepository permissionSetItemRepository;
    private final UserManagementService userManagementService;
    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissionEvaluationService;

    public PermissionSetPermissionQueryService(
            PermissionSetRepository permissionSetRepository,
            PermissionSetItemRepository permissionSetItemRepository,
            UserManagementService userManagementService,
            CurrentUserService currentUserService,
            PermissionEvaluationService permissionEvaluationService) {
        this.permissionSetRepository = permissionSetRepository;
        this.permissionSetItemRepository = permissionSetItemRepository;
        this.userManagementService = userManagementService;
        this.currentUserService = currentUserService;
        this.permissionEvaluationService = permissionEvaluationService;
    }

    @Transactional(readOnly = true)
    public PermissionSetPermissionPageResponse page(UUID permissionSetId, int page, int limit, String search, String module) {
        UserAccount user = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.hasAnyPermission(user, VIEW_PERMISSION, MANAGE_PERMISSION)) {
            throw new AccessDeniedException("Permission set view permission required");
        }
        if (!permissionSetRepository.existsById(permissionSetId)) {
            throw new IllegalArgumentException("Permission set not found");
        }

        String needle = StringUtils.hasText(search) ? search.trim().toLowerCase(Locale.ROOT) : null;
        List<Permission> matching = permissionSetItemRepository.findAllByPermissionSet_Id(permissionSetId).stream()
                .map(PermissionSetItem::getPermission)
                .filter(p -> needle == null || contains(p, needle))
                .sorted(Comparator
                        .comparing((Permission p) -> moduleOf(p), String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(p -> p.getDisplayOrder() == null ? Integer.MAX_VALUE : p.getDisplayOrder())
                        .thenComparing(Permission::getCode, String.CASE_INSENSITIVE_ORDER))
                .toList();

        // The Module filter lists the modules of what the search found, so a module is never offered with nothing behind it.
        Map<String, Long> counts = matching.stream().collect(Collectors.groupingBy(
                PermissionSetPermissionQueryService::moduleOf, LinkedHashMap::new, Collectors.counting()));
        List<PermissionSetPermissionPageResponse.ModuleCount> modules = counts.entrySet().stream()
                .map(e -> new PermissionSetPermissionPageResponse.ModuleCount(e.getKey(), e.getValue()))
                .toList();

        List<Permission> filtered = StringUtils.hasText(module)
                ? matching.stream().filter(p -> ModuleKeys.same(module, p.getModuleKey())).toList()
                : matching;

        PageResponse<Permission> slice = PagedList.paginate(filtered, page, Math.min(Math.max(limit, 1), MAX_LIMIT));
        Map<String, List<PermissionLifecycleUsageResponse>> usages = userManagementService.buildLifecycleUsagesByPermissionCode(
                slice.data().stream().map(Permission::getCode).collect(Collectors.toSet()));
        List<PermissionSetPermissionRowResponse> rows = new ArrayList<>();
        for (Permission p : slice.data()) {
            rows.add(new PermissionSetPermissionRowResponse(
                    p.getCode(), p.getName(), p.getDescription(), moduleOf(p), p.isRequiresAudit(),
                    usages.getOrDefault(p.getCode(), List.of())));
        }
        return new PermissionSetPermissionPageResponse(rows, slice.pagination(), modules);
    }

    private static String moduleOf(Permission p) {
        String key = ModuleKeys.canonical(p.getModuleKey());
        return StringUtils.hasText(key) ? key : "general";
    }

    private static boolean contains(Permission p, String needle) {
        return lower(p.getName()).contains(needle) || lower(p.getCode()).contains(needle) || lower(p.getDescription()).contains(needle);
    }

    private static String lower(String value) {
        return value == null ? "" : value.toLowerCase(Locale.ROOT);
    }
}
