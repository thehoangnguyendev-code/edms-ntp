package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.settings.SystemInfoResponse;
import com.eqms.service.PermissionEvaluationService;
import com.eqms.service.SystemInfoService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/settings/system")
public class SystemInfoController {

    private final SystemInfoService systemInfoService;
    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissionEvaluationService;

    public SystemInfoController(
            SystemInfoService systemInfoService,
            CurrentUserService currentUserService,
            PermissionEvaluationService permissionEvaluationService
    ) {
        this.systemInfoService = systemInfoService;
        this.currentUserService = currentUserService;
        this.permissionEvaluationService = permissionEvaluationService;
    }

    /** Runtime server, database and backend technology-stack facts. Admin (Settings) only. */
    @GetMapping("/info")
    public ResponseEntity<SystemInfoResponse> getSystemInfo() {
        if (!permissionEvaluationService.hasPermission(
                currentUserService.requireCurrentUser(), "settings.configuration.view")) {
            throw new AccessDeniedException("Settings configuration view permission required");
        }
        return ResponseEntity.ok(systemInfoService.getSystemInfo());
    }
}
