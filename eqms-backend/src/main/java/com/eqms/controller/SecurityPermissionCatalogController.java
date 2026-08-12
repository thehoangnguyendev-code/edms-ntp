package com.eqms.controller;

import com.eqms.dto.user.PageResponse;
import com.eqms.dto.user.PermissionCatalogFlatResponse;
import com.eqms.dto.user.PermissionGroupResponse;
import com.eqms.auth.CurrentUserService;
import com.eqms.entity.UserAccount;
import com.eqms.service.PermissionEvaluationService;
import com.eqms.service.UserManagementService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/security/permissions")
public class SecurityPermissionCatalogController {

    private final UserManagementService userManagementService;
    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissionEvaluationService;

    public SecurityPermissionCatalogController(
            UserManagementService userManagementService,
            CurrentUserService currentUserService,
            PermissionEvaluationService permissionEvaluationService
    ) {
        this.userManagementService = userManagementService;
        this.currentUserService = currentUserService;
        this.permissionEvaluationService = permissionEvaluationService;
    }

    @GetMapping("/catalog")
    public ResponseEntity<List<PermissionGroupResponse>> getPermissionCatalog(
            @RequestParam(required = false) String module,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String audit
    ) {
        requirePermissionCatalogAccess();
        return ResponseEntity.ok(userManagementService.getPermissionCatalog(module, search, audit));
    }

    @GetMapping("/catalog/paged")
    public ResponseEntity<PageResponse<PermissionCatalogFlatResponse>> getPermissionCatalogPaged(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String module,
            @RequestParam(defaultValue = "code") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDir
    ) {
        requirePermissionCatalogAccess();
        return ResponseEntity.ok(userManagementService.getPermissionCatalogPaged(module, search, page, limit, sortBy, sortDir));
    }

    private void requirePermissionCatalogAccess() {
        UserAccount user = currentUserService.requireCurrentUser();
        boolean allowed = permissionEvaluationService.isSuperAdmin(user)
                || permissionEvaluationService.hasAnyPermission(
                user,
                "security.permission_sets.view",
                "security.permission_sets.update",
                "security.access_profiles.view",
                "security.access_profiles.update"
        );
        if (!allowed) {
            throw new AccessDeniedException("Current user is not allowed to view the permission catalog");
        }
    }
}
