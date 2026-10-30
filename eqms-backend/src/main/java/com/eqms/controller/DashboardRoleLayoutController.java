package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.entity.UserAccount;
import com.eqms.service.DashboardRoleLayoutService;
import com.eqms.service.PermissionEvaluationService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/dashboard/layout")
public class DashboardRoleLayoutController {
    private final DashboardRoleLayoutService service;
    private final CurrentUserService current;
    private final PermissionEvaluationService permissions;
    private final ObjectMapper mapper;
    public DashboardRoleLayoutController(DashboardRoleLayoutService service, CurrentUserService current, PermissionEvaluationService permissions, ObjectMapper mapper) { this.service = service; this.current = current; this.permissions = permissions; this.mapper = mapper; }
    private UserAccount require(String permission) {
        UserAccount user = current.requireCurrentUser();
        if (!permissions.hasPermission(user, permission)) throw new AccessDeniedException("Permission required");
        return user;
    }
    @GetMapping("/default")
    public JsonNode effective() { return service.effective(require("dashboard.module.view").getId()).orElseGet(mapper::createObjectNode); }
    @GetMapping("/roles")
    public List<DashboardRoleLayoutService.RoleLayout> list() { require("settings.configuration.manage"); return service.list(); }
    @GetMapping("/roles/options")
    public List<DashboardRoleLayoutService.RoleOption> roles() { require("settings.configuration.manage"); return service.roles(); }
    public record Update(int priority, JsonNode layout) {}
    @PutMapping("/roles/{roleId}")
    public void save(@PathVariable UUID roleId, @RequestBody Update update) { service.save(require("settings.configuration.manage"), roleId, update.priority(), update.layout()); }
}
