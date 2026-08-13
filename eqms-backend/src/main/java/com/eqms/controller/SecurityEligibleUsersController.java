package com.eqms.controller;

import com.eqms.dto.security.EligibleUserResponse;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.PermissionEvaluationService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;

/**
 * Generic "eligible users for a given permission" lookup, shared across active modules. Any
 * module that needs to pick a user who is currently allowed to
 * perform an action gated by a permission code can call this same endpoint instead of rolling
 * its own query.
 *
 * Deliberately does NOT filter by document type / object access rules — that belongs to a
 * different layer (Object Access Rules). This endpoint answers a single question: "which active
 * users currently hold this permission code through active Access Profiles?"
 *
 * Reuses {@link PermissionEvaluationService#hasPermission(UserAccount, String)} per-user rather
 * than a hand-rolled SQL join across access_profile_permission_sets/permission_set_items — that
 * join alone would miss wildcard/profile evaluation rules. hasPermission() delegates to
 * EffectivePermissionService and remains the single source of truth used at runtime.
 */
@RestController
@RequestMapping("/security")
public class SecurityEligibleUsersController {

    private final UserAccountRepository userAccountRepository;
    private final PermissionEvaluationService permissionEvaluationService;

    public SecurityEligibleUsersController(
            UserAccountRepository userAccountRepository,
            PermissionEvaluationService permissionEvaluationService
    ) {
        this.userAccountRepository = userAccountRepository;
        this.permissionEvaluationService = permissionEvaluationService;
    }

    @GetMapping("/eligible-users")
    @Transactional(readOnly = true)
    public ResponseEntity<List<EligibleUserResponse>> getEligibleUsers(
            @RequestParam String permissionCode,
            @RequestParam(required = false) String search
    ) {
        if (!StringUtils.hasText(permissionCode)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "permissionCode is required");
        }
        String normalizedPermissionCode = permissionCode.trim();
        String normalizedSearch = StringUtils.hasText(search) ? search.trim().toLowerCase() : null;

        List<UserAccount> activeUsers = userAccountRepository.findAllByStatus(UserStatus.Active);

        List<EligibleUserResponse> eligible = activeUsers.stream()
                .filter(user -> permissionEvaluationService.hasPermission(user, normalizedPermissionCode))
                .filter(user -> matchesSearch(user, normalizedSearch))
                .sorted(Comparator.comparing(UserAccount::getFullName, Comparator.nullsLast(String::compareToIgnoreCase)))
                .map(user -> new EligibleUserResponse(
                        user.getId(),
                        user.getEmployeeCode(),
                        user.getFullName(),
                        user.getPosition(),
                        user.getEmail(),
                        user.getDepartment()
                ))
                .toList();

        return ResponseEntity.ok(eligible);
    }

    private boolean matchesSearch(UserAccount user, String normalizedSearch) {
        if (normalizedSearch == null) {
            return true;
        }
        String fullName = user.getFullName() != null ? user.getFullName().toLowerCase() : "";
        String employeeCode = user.getEmployeeCode() != null ? user.getEmployeeCode().toLowerCase() : "";
        return fullName.contains(normalizedSearch) || employeeCode.contains(normalizedSearch);
    }
}
