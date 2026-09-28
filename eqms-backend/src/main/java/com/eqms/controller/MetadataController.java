package com.eqms.controller;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.UserAccessProfileRepository;
import com.eqms.repository.UserAccountRepository;
import com.eqms.dto.user.PageResponse;
import com.eqms.dto.user.PaginationResponse;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Lightweight, read-only lookup data shared across modules — the same design principle as the
 * dictionary plain-list endpoints in {@code SettingsDictionaryController} (business units,
 * departments, positions, ...): any authenticated user may READ these values to populate a
 * picker/dropdown elsewhere in the app; only the dedicated admin management screens (User
 * Management, Dictionaries) require an elevated permission to VIEW the full paginated record set
 * or to create/update/delete.
 *
 * Deliberately does not reuse {@code UserManagementService.getUsers()} (gated by
 * settings.user.view) — that endpoint returns full HR/administrative records and is meant for the
 * User Management admin screen, not for "pick a person" pickers used throughout the app.
 */
@RestController
@RequestMapping("/metadata")
public class MetadataController {

    private final UserAccountRepository userAccountRepository;
    private final UserAccessProfileRepository userAccessProfileRepository;

    public MetadataController(
            UserAccountRepository userAccountRepository,
            UserAccessProfileRepository userAccessProfileRepository
    ) {
        this.userAccountRepository = userAccountRepository;
        this.userAccessProfileRepository = userAccessProfileRepository;
    }

    public record AccessProfileLookupResponse(
            String id,
            String code,
            String name
    ) {
    }

    public record UserLookupResponse(
            String id,
            String username,
            String fullName,
            List<AccessProfileLookupResponse> accessProfiles,
            String department,
            String businessUnit,
            String position,
            String employeeCode,
            String email
    ) {
    }

    @GetMapping("/users")
    @Transactional(readOnly = true)
    public ResponseEntity<List<UserLookupResponse>> getUsersLookup(
            @RequestParam(required = false) String department,
            @RequestParam(required = false) String search
    ) {
        String departmentFilter = StringUtils.hasText(department) ? department.trim().toLowerCase(Locale.ROOT) : null;
        String searchFilter = StringUtils.hasText(search) ? search.trim().toLowerCase(Locale.ROOT) : null;

        List<UserAccount> activeUsers = userAccountRepository.findAllByStatus(UserStatus.Active);

        List<UserLookupResponse> results = activeUsers.stream()
                .filter(user -> departmentFilter == null
                        || (user.getDepartment() != null && user.getDepartment().toLowerCase(Locale.ROOT).contains(departmentFilter)))
                .filter(user -> searchFilter == null
                        || (user.getFullName() != null && user.getFullName().toLowerCase(Locale.ROOT).contains(searchFilter))
                        || (user.getEmployeeCode() != null && user.getEmployeeCode().toLowerCase(Locale.ROOT).contains(searchFilter)))
                .sorted(Comparator.comparing(UserAccount::getFullName, Comparator.nullsLast(String::compareToIgnoreCase)))
                .map(user -> new UserLookupResponse(
                        user.getId().toString(),
                        user.getUsername(),
                        user.getFullName(),
                        userAccessProfileRepository.findByUserId(user.getId()).stream()
                                .filter(assignment -> assignment.getAccessProfile() != null)
                                .map(assignment -> new AccessProfileLookupResponse(
                                        assignment.getAccessProfileId().toString(),
                                        assignment.getAccessProfile().getCode(),
                                        assignment.getAccessProfile().getName()))
                                .sorted(Comparator.comparing(AccessProfileLookupResponse::name, String.CASE_INSENSITIVE_ORDER))
                                .toList(),
                        user.getDepartment(),
                        user.getBusinessUnit(),
                        user.getPosition(),
                        user.getEmployeeCode(),
                        user.getEmail()
                ))
                .toList();

        return ResponseEntity.ok(results);
    }

    /**
     * Server-paged counterpart to {@code /metadata/users}. New high-cardinality person pickers
     * must use this endpoint so filtering, sorting and paging stay off the browser. The existing
     * list endpoint remains for backwards compatibility with small static lookup consumers.
     */
    @GetMapping("/users/paged")
    @Transactional(readOnly = true)
    public ResponseEntity<PageResponse<UserLookupResponse>> getUsersLookupPaged(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String department,
            @RequestParam(defaultValue = "fullName") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDir
    ) {
        int safePage = Math.max(page, 1);
        int safeLimit = Math.min(Math.max(limit, 1), 100);
        String normalizedSearch = StringUtils.hasText(search) ? search.trim() : null;
        String normalizedDepartment = StringUtils.hasText(department) ? department.trim() : null;
        String safeSortBy = switch (sortBy == null ? "fullName" : sortBy) {
            case "email", "employeeCode", "department", "position" -> sortBy;
            default -> "fullName";
        };
        Sort.Direction direction = "desc".equalsIgnoreCase(sortDir) ? Sort.Direction.DESC : Sort.Direction.ASC;
        Sort sort = Sort.by(direction, safeSortBy);
        if (!"fullName".equals(safeSortBy)) {
            sort = sort.and(Sort.by(Sort.Direction.ASC, "fullName"));
        }

        var userPage = userAccountRepository.findMetadataLookupCandidates(
                UserStatus.Active,
                normalizedSearch,
                normalizedDepartment,
                PageRequest.of(safePage - 1, safeLimit, sort)
        );
        List<UUID> userIds = userPage.getContent().stream().map(UserAccount::getId).toList();
        Map<UUID, List<AccessProfileLookupResponse>> profilesByUser = (userIds.isEmpty()
                ? List.<com.eqms.entity.UserAccessProfile>of()
                : userAccessProfileRepository.findByUserIdInOrderByAssignedAtAsc(userIds))
                .stream()
                .filter(assignment -> assignment.getAccessProfile() != null)
                .collect(Collectors.groupingBy(
                        assignment -> assignment.getUserId(),
                        Collectors.mapping(assignment -> new AccessProfileLookupResponse(
                                assignment.getAccessProfileId().toString(),
                                assignment.getAccessProfile().getCode(),
                                assignment.getAccessProfile().getName()), Collectors.toList())
                ));

        List<UserLookupResponse> data = userPage.getContent().stream()
                .map(user -> toLookupResponse(user, profilesByUser.getOrDefault(user.getId(), List.of())))
                .toList();
        return ResponseEntity.ok(new PageResponse<>(data, new PaginationResponse(
                safePage, safeLimit, userPage.getTotalElements(), userPage.getTotalPages())));
    }

    private UserLookupResponse toLookupResponse(UserAccount user, List<AccessProfileLookupResponse> accessProfiles) {
        return new UserLookupResponse(
                user.getId().toString(), user.getUsername(), user.getFullName(), accessProfiles,
                user.getDepartment(), user.getBusinessUnit(), user.getPosition(), user.getEmployeeCode(), user.getEmail());
    }
}
