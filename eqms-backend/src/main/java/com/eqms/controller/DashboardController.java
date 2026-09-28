package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.dashboard.DashboardActivityPointResponse;
import com.eqms.dto.dashboard.DashboardAdminStatsResponse;
import com.eqms.dto.dashboard.DashboardMyTaskResponse;
import com.eqms.dto.dashboard.DashboardRecentActivityResponse;
import com.eqms.dto.dashboard.DashboardSummaryResponse;
import com.eqms.service.DashboardService;
import com.eqms.service.PermissionEvaluationService;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/dashboard")
public class DashboardController {

    private final DashboardService dashboardService;
    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissionEvaluationService;

    public DashboardController(
            DashboardService dashboardService,
            CurrentUserService currentUserService,
            PermissionEvaluationService permissionEvaluationService
    ) {
        this.dashboardService = dashboardService;
        this.currentUserService = currentUserService;
        this.permissionEvaluationService = permissionEvaluationService;
    }

    @GetMapping("/summary")
    public ResponseEntity<DashboardSummaryResponse> getSummary() {
        requireDashboardView();
        var user = currentUserService.requireAuthenticatedPrincipal();
        return ResponseEntity.ok(dashboardService.getSummary(user));
    }

    @GetMapping("/document-activity")
    public ResponseEntity<List<DashboardActivityPointResponse>> getDocumentActivity(
            @RequestParam(defaultValue = "month") String period
    ) {
        requireDashboardView();
        return ResponseEntity.ok(dashboardService.getDocumentActivity(period));
    }

    @GetMapping("/my-tasks")
    public ResponseEntity<List<DashboardMyTaskResponse>> getMyTasks() {
        requireDashboardView();
        var user = currentUserService.requireAuthenticatedPrincipal();
        return ResponseEntity.ok(dashboardService.getMyTasks(user));
    }

    @GetMapping("/recent-activity")
    public ResponseEntity<List<DashboardRecentActivityResponse>> getRecentActivity() {
        requireAdminDashboardView();
        return ResponseEntity.ok(dashboardService.getRecentActivity());
    }

    @GetMapping("/admin-stats")
    public ResponseEntity<DashboardAdminStatsResponse> getAdminStats() {
        requireAdminDashboardView();
        return ResponseEntity.ok(dashboardService.getAdminStats());
    }

    private void requireDashboardView() {
        if (!permissionEvaluationService.hasPermission(currentUserService.requireCurrentUser(), "dashboard.module.view")) {
            throw new AccessDeniedException("Dashboard view permission required");
        }
    }

    private void requireAdminDashboardView() {
        if (!permissionEvaluationService.hasPermission(currentUserService.requireCurrentUser(), "dashboard.admin.view")) {
            throw new AccessDeniedException("Administrative dashboard permission required");
        }
    }
}
