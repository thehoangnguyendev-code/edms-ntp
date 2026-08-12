package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.security.AuthorizationShadowMismatchResponse;
import com.eqms.dto.security.AuthorizationShadowMismatchSummaryResponse;
import com.eqms.dto.user.PageResponse;
import com.eqms.service.AuthorizationShadowEvaluationService;
import com.eqms.service.PermissionEvaluationService;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Technical rollout evidence, restricted to Security Administration. */
@RestController
@RequestMapping("/security/authorization-shadow-mismatches")
public class AuthorizationShadowEvaluationController {
    private final AuthorizationShadowEvaluationService shadow;
    private final CurrentUserService currentUser;
    private final PermissionEvaluationService permissions;

    public AuthorizationShadowEvaluationController(AuthorizationShadowEvaluationService shadow,
                                                   CurrentUserService currentUser,
                                                   PermissionEvaluationService permissions) {
        this.shadow = shadow; this.currentUser = currentUser; this.permissions = permissions;
    }

    @GetMapping
    public List<AuthorizationShadowMismatchResponse> list(@RequestParam(defaultValue = "100") int limit) {
        var user = currentUser.requireCurrentUser();
        if (!permissions.hasPermission(user, "security.access_profiles.update")) {
            throw new AccessDeniedException("Access profile management permission required");
        }
        return shadow.recentMismatches(limit);
    }

    /** Per-resource-type totals for the Engine Health summary cards. */
    @GetMapping("/summary")
    public List<AuthorizationShadowMismatchSummaryResponse> summary() {
        var user = currentUser.requireCurrentUser();
        if (!permissions.hasPermission(user, "security.access_profiles.update")) {
            throw new AccessDeniedException("Access profile management permission required");
        }
        return shadow.summaryByResourceType();
    }

    /** Server-side filter/search/sort/pagination for the Engine Health table. */
    @GetMapping("/paged")
    public PageResponse<AuthorizationShadowMismatchResponse> paged(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String resourceType,
            @RequestParam(defaultValue = "true") boolean mismatchesOnly,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir
    ) {
        var user = currentUser.requireCurrentUser();
        if (!permissions.hasPermission(user, "security.access_profiles.update")) {
            throw new AccessDeniedException("Access profile management permission required");
        }
        return shadow.pagedMismatches(page, limit, resourceType, mismatchesOnly, search, sortBy, sortDir);
    }
}
