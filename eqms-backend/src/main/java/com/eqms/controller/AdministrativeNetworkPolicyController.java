package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.entity.UserAccount;
import com.eqms.service.AdministrativeNetworkPolicyService;
import com.eqms.service.PermissionEvaluationService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/settings/network-access")
public class AdministrativeNetworkPolicyController {
    private final AdministrativeNetworkPolicyService service;
    private final CurrentUserService current;
    private final PermissionEvaluationService permissions;
    private final JdbcTemplate jdbc;
    public AdministrativeNetworkPolicyController(AdministrativeNetworkPolicyService service, CurrentUserService current,
                                                 PermissionEvaluationService permissions, JdbcTemplate jdbc) {
        this.service = service; this.current = current; this.permissions = permissions; this.jdbc = jdbc;
    }
    private UserAccount requireManager() {
        var user = current.requireCurrentUser();
        if (!permissions.hasPermission(user, "settings.configuration.manage")) throw new AccessDeniedException("Permission required");
        return user;
    }
    @GetMapping
    public AdministrativeNetworkPolicyService.Settings get() { requireManager(); return service.get(); }
    @PutMapping
    public AdministrativeNetworkPolicyService.Settings save(@RequestBody AdministrativeNetworkPolicyService.Settings settings, HttpServletRequest request) {
        return service.save(requireManager(), settings, request.getRemoteAddr(), request.getHeader("X-Forwarded-For"));
    }
    /** How the server sees the caller under the saved trusted proxies, and whether the saved allowlist (or the one being edited) lets that address in: the administrator checks it before saving. */
    public record ClientAddress(String address, boolean allowed, boolean recoveryDisabled) {}
    @PostMapping("/check-address")
    public ClientAddress checkAddress(@RequestBody AdministrativeNetworkPolicyService.Settings settings, HttpServletRequest request) {
        requireManager();
        return service.checkAddress(settings, request.getRemoteAddr(), request.getHeader("X-Forwarded-For"), recoveryDisabled);
    }
    @org.springframework.beans.factory.annotation.Value("${app.admin-network.recovery-disable:false}")
    private boolean recoveryDisabled;
    public record UserOption(UUID id, String fullName) {}
    @GetMapping("/emergency-users")
    public List<UserOption> emergencyUsers(@RequestParam(defaultValue = "") String search) {
        requireManager();
        if (search.length() > 100) throw new IllegalArgumentException("Search too long");
        return jdbc.query("""
            SELECT u.id,u.full_name FROM app_users u WHERE u.status='Active'
            AND (position(lower(?) in lower(u.full_name))>0 OR position(lower(?) in lower(u.username))>0 OR u.id::text=?)
            AND EXISTS(SELECT 1 FROM user_access_profiles ua
            JOIN roles r ON r.id=ua.access_profile_id AND r.is_active=true
            JOIN access_profile_permission_sets aps ON aps.access_profile_id=r.id
            JOIN permission_sets ps ON ps.id=aps.permission_set_id AND ps.active=true
            JOIN permission_set_items psi ON psi.permission_set_id=ps.id
            JOIN permissions p ON p.id=psi.permission_id
            WHERE ua.user_id=u.id AND lower(trim(p.code))='settings.configuration.manage')
            ORDER BY u.full_name,u.id LIMIT 30
            """, (rs,row) -> new UserOption(rs.getObject(1,UUID.class),rs.getString(2)), search, search, search);
    }
}
