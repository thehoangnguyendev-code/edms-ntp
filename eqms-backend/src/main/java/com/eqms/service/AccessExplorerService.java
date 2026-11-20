package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.user.AccessExplorerDtos.GrantingProfile;
import com.eqms.dto.user.AccessExplorerDtos.GrantingSet;
import com.eqms.dto.user.AccessExplorerDtos.Holder;
import com.eqms.dto.user.AccessExplorerDtos.HoldersResponse;
import com.eqms.dto.user.AccessExplorerDtos.PermissionOption;
import com.eqms.dto.user.AccessExplorerDtos.PermissionPage;
import com.eqms.dto.user.AccessExplorerDtos.PermissionRow;
import com.eqms.entity.AccessProfilePermissionSet;
import com.eqms.entity.Permission;
import com.eqms.entity.PermissionSet;
import com.eqms.entity.RoleDefinition;
import com.eqms.entity.TimeLimitedUserGrant;
import com.eqms.entity.UserAccessProfile;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.AccessProfilePermissionSetRepository;
import com.eqms.repository.PermissionRepository;
import com.eqms.repository.PermissionSetRepository;
import com.eqms.repository.TimeLimitedUserGrantRepository;
import com.eqms.repository.UserAccessProfileRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;

/**
 * Access Explorer (SECURITY-AUTHORIZATION-REVIEW D6, owner 2026-11-18): the question an auditor asks, "who holds this permission, and through what?", answered from the same
 * chain the sign-in uses to decide (person, active access profile, active permission set, permission), so the answer cannot differ from what the system enforces. It is read
 * only and gives nothing the user list does not already give to a person who may see users (the permissions of each person are part of that list), so it is open to the
 * same audience: whoever may view users or access profiles.
 */
@Service
public class AccessExplorerService {
    static final int MAX_PAGE_SIZE = 100;

    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissionEvaluationService;
    private final PermissionRepository permissionRepository;
    private final PermissionSetRepository permissionSetRepository;
    private final AccessProfilePermissionSetRepository profileSetRepository;
    private final UserAccessProfileRepository userProfileRepository;
    private final TimeLimitedUserGrantRepository timeLimitedGrantRepository;

    public AccessExplorerService(CurrentUserService currentUserService, PermissionEvaluationService permissionEvaluationService, PermissionRepository permissionRepository,
                                 PermissionSetRepository permissionSetRepository, AccessProfilePermissionSetRepository profileSetRepository,
                                 UserAccessProfileRepository userProfileRepository, TimeLimitedUserGrantRepository timeLimitedGrantRepository) {
        this.currentUserService = currentUserService;
        this.permissionEvaluationService = permissionEvaluationService;
        this.permissionRepository = permissionRepository;
        this.permissionSetRepository = permissionSetRepository;
        this.profileSetRepository = profileSetRepository;
        this.userProfileRepository = userProfileRepository;
        this.timeLimitedGrantRepository = timeLimitedGrantRepository;
    }

    private void requireView() {
        UserAccount actor = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.hasAnyPermission(actor, "settings.user.view", "security.access_profiles.view")) {
            throw new AccessDeniedException("Access Explorer requires permission to view users or access profiles");
        }
    }

    /** The module keys that have at least one permission, for the module filter of the list. */
    @Transactional(readOnly = true)
    public List<String> modules() {
        requireView();
        return permissionRepository.findAll().stream().map(Permission::getModuleKey).filter(StringUtils::hasText).map(com.eqms.util.ModuleKeys::canonical).distinct().sorted(String.CASE_INSENSITIVE_ORDER).toList();
    }

    /**
     * The list screen: every permission with how many permission sets, access profiles and people hold it. Searched, filtered, sorted and paged here, not in the browser. Every
     * word typed must be found somewhere in the permission, in any order ("paper verify" finds "Verify Paper Training"). {@code held}: "held" keeps the permissions somebody
     * holds, "none" the ones nobody holds (a permission nobody holds is worth a look), anything else keeps all.
     */
    @Transactional(readOnly = true)
    public PermissionPage listPermissions(String search, String module, String held, String sortBy, String sortDir, int page, int size) {
        requireView();
        String moduleKey = module == null ? "" : module.trim();
        String[] words = search == null || search.isBlank() ? new String[0] : search.trim().toLowerCase(Locale.ROOT).split("[ \t]+");
        Map<String, int[]> counts = new LinkedHashMap<>();
        for (Object[] row : permissionRepository.holderCountsByCode()) {
            counts.put(String.valueOf(row[0]), new int[] {((Number) row[1]).intValue(), ((Number) row[2]).intValue(), ((Number) row[3]).intValue(), ((Number) row[4]).intValue()});
        }
        int[] none = new int[4];
        List<PermissionRow> rows = permissionRepository.findAll().stream()
                .filter(p -> moduleKey.isEmpty() || com.eqms.util.ModuleKeys.same(moduleKey, p.getModuleKey()))
                .filter(p -> java.util.Arrays.stream(words).allMatch(word -> contains(p.getCode(), word) || contains(p.getName(), word) || contains(p.getModuleKey(), word)
                        || contains(p.getCategory(), word) || contains(p.getDescription(), word)))
                .map(p -> {
                    int[] c = counts.getOrDefault(p.getCode(), none);
                    return new PermissionRow(p.getCode(), p.getName(), p.getModuleKey(), p.getCategory(), p.getDescription(), c[0], c[1], c[2], c[3]);
                })
                .filter(r -> "held".equalsIgnoreCase(held) ? r.holderCount() > 0 : !"none".equalsIgnoreCase(held) || r.holderCount() == 0)
                .sorted(rowOrder(sortBy, sortDir))
                .toList();
        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        int safePage = Math.max(page, 0);
        int from = (int) Math.min((long) safePage * safeSize, rows.size());
        return new PermissionPage(rows.subList(from, Math.min(from + safeSize, rows.size())), rows.size(), Math.max(1, (rows.size() + safeSize - 1) / safeSize), safePage, safeSize);
    }

    private static Comparator<PermissionRow> rowOrder(String sortBy, String sortDir) {
        Comparator<PermissionRow> byCode = Comparator.comparing(PermissionRow::code, String.CASE_INSENSITIVE_ORDER);
        Comparator<PermissionRow> order = switch (sortBy == null ? "" : sortBy) {
            case "code" -> byCode;
            case "module" -> Comparator.comparing((PermissionRow r) -> r.moduleKey() == null ? "" : r.moduleKey(), String.CASE_INSENSITIVE_ORDER).thenComparing(byCode);
            case "category" -> Comparator.comparing((PermissionRow r) -> r.category() == null ? "" : r.category(), String.CASE_INSENSITIVE_ORDER).thenComparing(byCode);
            case "permissionSetCount" -> Comparator.comparingInt(PermissionRow::permissionSetCount).thenComparing(byCode);
            case "accessProfileCount" -> Comparator.comparingInt(PermissionRow::accessProfileCount).thenComparing(byCode);
            case "holderCount" -> Comparator.comparingInt(PermissionRow::holderCount).thenComparing(byCode);
            default -> Comparator.comparing((PermissionRow r) -> r.name() == null ? "" : r.name(), String.CASE_INSENSITIVE_ORDER).thenComparing(byCode);
        };
        return "desc".equalsIgnoreCase(sortDir) ? order.reversed() : order;
    }

    /**
     * Everyone who holds the permission through an ACTIVE access profile that holds an ACTIVE permission set that contains it. {@code activeOnly} keeps the people whose
     * account is Active (a suspended or terminated person holds nothing in practice). Nothing is written.
     */
    @Transactional(readOnly = true)
    public HoldersResponse whoHolds(String code, boolean activeOnly, String search, int page, int size) {
        requireView();
        if (!StringUtils.hasText(code)) throw new IllegalArgumentException("A permission code is required");
        Permission permission = permissionRepository.findByCode(code.trim().toLowerCase(Locale.ROOT))
                .orElseThrow(() -> new IllegalArgumentException("Unknown permission: " + code.trim()));

        Map<UUID, Holder> byUser = new LinkedHashMap<>();
        Map<UUID, Set<String>> profilesOf = new LinkedHashMap<>();
        Map<UUID, Set<String>> setsOf = new LinkedHashMap<>();
        Map<UUID, UserAccount> users = new LinkedHashMap<>();
        List<GrantingSet> sets = new ArrayList<>();

        for (PermissionSet set : permissionSetRepository.findActiveSetsGrantingCode(permission.getCode())) {
            List<GrantingProfile> profiles = new ArrayList<>();
            for (AccessProfilePermissionSet link : profileSetRepository.findByPermissionSetId(set.getId())) {
                RoleDefinition profile = link.getAccessProfile();
                if (profile == null || !profile.isActive()) continue;
                List<UserAccessProfile> assignments = userProfileRepository.findByAccessProfileId(profile.getId());
                profiles.add(new GrantingProfile(profile.getId(), profile.getCode(), profile.getName(), true, assignments.size()));
                for (UserAccessProfile assignment : assignments) {
                    UserAccount user = assignment.getUser();
                    if (user == null) continue;
                    users.putIfAbsent(user.getId(), user);
                    profilesOf.computeIfAbsent(user.getId(), k -> new TreeSet<>(String.CASE_INSENSITIVE_ORDER)).add(profile.getName());
                    setsOf.computeIfAbsent(user.getId(), k -> new TreeSet<>(String.CASE_INSENSITIVE_ORDER)).add(set.getName());
                }
            }
            sets.add(new GrantingSet(set.getId(), set.getCode(), set.getName(), profiles));
        }

        Map<UUID, Instant> limited = new LinkedHashMap<>();
        timeLimitedGrantRepository.findByStatus(TimeLimitedUserGrant.STATUS_ACTIVE)
                .forEach(g -> limited.merge(g.getUser().getId(), g.getEndAt(), (a, b) -> a.isAfter(b) ? a : b));

        String[] words = search == null || search.isBlank() ? new String[0] : search.trim().toLowerCase(Locale.ROOT).split("[ \t]+");
        List<Holder> matching = users.values().stream()
                .filter(u -> !activeOnly || u.getStatus() == UserStatus.Active)
                .map(u -> new Holder(u.getId(), u.getEmployeeCode(), u.getUsername(), u.getFullName(), u.getDepartment(),
                        u.getStatus() == null ? null : u.getStatus().name(),
                        List.copyOf(profilesOf.getOrDefault(u.getId(), Set.of())), List.copyOf(setsOf.getOrDefault(u.getId(), Set.of())),
                        u.getLastLoginAt(), limited.get(u.getId())))
                .filter(h -> java.util.Arrays.stream(words).allMatch(word -> contains(h.fullName(), word) || contains(h.username(), word) || contains(h.employeeCode(), word)
                        || contains(h.department(), word) || h.viaProfiles().stream().anyMatch(n -> contains(n, word)) || h.viaPermissionSets().stream().anyMatch(n -> contains(n, word))))
                .sorted(Comparator.comparing((Holder h) -> h.fullName() == null ? "" : h.fullName(), String.CASE_INSENSITIVE_ORDER))
                .toList();
        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        int from = (int) Math.min((long) Math.max(page, 0) * safeSize, matching.size());
        List<Holder> holders = matching.subList(from, Math.min(from + safeSize, matching.size()));
        int pages = Math.max(1, (matching.size() + safeSize - 1) / safeSize);
        int active = (int) users.values().stream().filter(u -> u.getStatus() == UserStatus.Active).count();
        return new HoldersResponse(option(permission), sets, holders, users.size(), active, matching.size(), pages);
    }

    private static boolean contains(String value, String needle) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(needle);
    }

    private static PermissionOption option(Permission p) {
        return new PermissionOption(p.getCode(), p.getName(), p.getModuleKey(), p.getCategory(), p.getDescription());
    }
}
