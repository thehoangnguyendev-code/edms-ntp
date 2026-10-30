package com.eqms.service;

import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.entity.UserAccount;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class DashboardRoleLayoutService {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final AuditTrailService audit;
    public DashboardRoleLayoutService(JdbcTemplate jdbc, ObjectMapper mapper, AuditTrailService audit) { this.jdbc = jdbc; this.mapper = mapper; this.audit = audit; }
    public record RoleLayout(UUID roleId, String roleName, int priority, JsonNode layout) {}
    public record RoleOption(UUID id, String name) {}
    @Transactional(readOnly = true)
    public List<RoleOption> roles() {
        return jdbc.query("SELECT id,name FROM roles WHERE is_active=true ORDER BY name,id", (rs, row) -> new RoleOption(rs.getObject(1, UUID.class), rs.getString(2)));
    }
    @Transactional(readOnly = true)
    public Optional<JsonNode> effective(UUID userId) {
        return jdbc.query("SELECT d.layout::text FROM dashboard_role_layouts d JOIN user_access_profiles u ON u.access_profile_id=d.role_id JOIN roles r ON r.id=d.role_id AND r.is_active=true WHERE u.user_id=? ORDER BY d.priority, d.role_id LIMIT 1", (rs, row) -> parse(rs.getString(1)), userId).stream().findFirst();
    }
    @Transactional(readOnly = true)
    public List<RoleLayout> list() {
        return jdbc.query("SELECT d.role_id,r.name,d.priority,d.layout::text FROM dashboard_role_layouts d JOIN roles r ON r.id=d.role_id ORDER BY d.priority,d.role_id", (rs, row) -> new RoleLayout(rs.getObject(1, UUID.class), rs.getString(2), rs.getInt(3), parse(rs.getString(4))));
    }
    @Transactional
    public void save(UserAccount actor, UUID roleId, int priority, JsonNode layout) {
        if (priority < 1 || priority > 100000) throw new IllegalArgumentException("Priority must be between 1 and 100000");
        UserUiPreferenceService.validateDashboardLayout(layout);
        Integer active = jdbc.queryForObject("SELECT count(*) FROM roles WHERE id=? AND is_active=true", Integer.class, roleId);
        if (active == null || active != 1) throw new IllegalArgumentException("Active access profile required");
        var before = jdbc.query("SELECT priority,layout::text FROM dashboard_role_layouts WHERE role_id=?", (rs, row) -> rs.getInt(1) + ":" + rs.getString(2), roleId).stream().findFirst().orElse(null);
        String after = priority + ":" + layout;
        jdbc.update("INSERT INTO dashboard_role_layouts(role_id, priority, layout, updated_by) VALUES (?, ?, CAST(? AS jsonb), ?) ON CONFLICT(role_id) DO UPDATE SET priority=excluded.priority, layout=excluded.layout, updated_by=excluded.updated_by, updated_at=CURRENT_TIMESTAMP", roleId, priority, layout.toString(), actor.getId());
        audit.logAs(actor, "DASHBOARD_ROLE_LAYOUT", "Dashboard role layout", roleId, "DASHBOARD_ROLE_LAYOUT_UPDATED", null, null, "Dashboard role layout updated", List.of(new AuditTrailChangeResponse("Layout and priority", before, after)));
    }
    private JsonNode parse(String value) {
        try { return mapper.readTree(value); } catch (Exception ex) { throw new IllegalStateException("Stored dashboard layout is invalid", ex); }
    }
}
