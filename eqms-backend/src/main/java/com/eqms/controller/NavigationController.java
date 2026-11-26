package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.auth.AuthenticatedUser;
import com.eqms.dto.navigation.NavigationItemResponse;
import com.eqms.entity.UserAccount;
import com.eqms.service.NavigationService;
import com.eqms.service.NavigationTaskCountService;
import com.eqms.service.PermissionEvaluationService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Set;

@RestController
@RequestMapping("/navigation")
public class NavigationController {

    private final NavigationService navigationService;
    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissionEvaluationService;
    private final NavigationTaskCountService taskCountService;

    public NavigationController(
            NavigationService navigationService,
            CurrentUserService currentUserService,
            PermissionEvaluationService permissionEvaluationService,
            NavigationTaskCountService taskCountService
    ) {
        this.taskCountService = taskCountService;
        this.navigationService = navigationService;
        this.currentUserService = currentUserService;
        this.permissionEvaluationService = permissionEvaluationService;
    }

    @GetMapping
    public List<NavigationItemResponse> getNavigation() {
        return navigationService.getNavigation(resolveUser(), resolvePermissions());
    }

    /** What waits for the signed-in person, per menu entry. The person is always the authenticated one, never a parameter. */
    @GetMapping("/task-counts")
    public NavigationTaskCountService.TaskCounts getTaskCounts() {
        return taskCountService.counts(currentUserService.requireCurrentUser());
    }

    @GetMapping("/search")
    public List<NavigationService.FlatMenuItem> searchNavigation(@RequestParam("q") String query) {
        return navigationService.searchNavigation(query, resolveUser(), resolvePermissions());
    }

    /** The signed-in account, or null when it cannot be loaded: the menu then follows permissions alone (the server still decides every list and action). */
    private UserAccount resolveUser() {
        try {
            return currentUserService.requireCurrentUser();
        } catch (Exception ignored) {
            return null;
        }
    }

    private Set<String> resolvePermissions() {
        try {
            UserAccount user = currentUserService.requireCurrentUser();
            return permissionEvaluationService.getPermissionCodes(user);
        } catch (Exception ignored) {
            AuthenticatedUser principal = currentUserService.requireAuthenticatedPrincipal();
            return principal.permissions() == null ? Set.of() : principal.permissions();
        }
    }
}
