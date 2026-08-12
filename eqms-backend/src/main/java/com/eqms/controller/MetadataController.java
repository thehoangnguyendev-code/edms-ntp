package com.eqms.controller;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.UserAccessProfileRepository;
import com.eqms.repository.UserAccountRepository;
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
}
