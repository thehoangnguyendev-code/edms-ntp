package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.service.EffectivePermissionService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Who may do what in Training Management (SDS-TR-001 section 8). Permissions come from the Access Profiles of the person, read each time (no cache of
 * ours); nothing is tied to a role name or an account. A permission applies to the person's own department unless the person also holds
 * {@code training.scope.all}.
 */
@Component
public class TrainingAccess {
    public static final String DENIED = "TRAINING_SCOPE_DENIED";
    /** Lets a person act on the data of every department, not only the own one. */
    public static final String SCOPE_ALL = "training.scope.all";

    private final EffectivePermissionService permissions;
    private final JdbcTemplate jdbc;

    public TrainingAccess(EffectivePermissionService permissions, JdbcTemplate jdbc) {
        this.permissions = permissions;
        this.jdbc = jdbc;
    }

    public Set<String> codes(UserAccount user) {
        if (user == null || user.getId() == null || user.getStatus() != UserStatus.Active) return Set.of();
        return permissions.getEffectivePermissionCodes(user);
    }

    public boolean has(UserAccount user, String... anyOf) {
        Set<String> actual = codes(user);
        return Arrays.stream(anyOf).anyMatch(actual::contains);
    }

    /** Refuses unless the person holds at least one of the permissions. The refusal says nothing about the object. */
    public void require(UserAccount user, String... anyOf) {
        if (!has(user, anyOf)) throw new SecurityException(DENIED);
    }

    public boolean allDepartments(UserAccount user) {
        return codes(user).contains(SCOPE_ALL);
    }

    /** The department of the person (matched by name, as the user table keeps the department as text); null when it cannot be matched. */
    public UUID departmentOf(UserAccount user) {
        if (user == null || user.getDepartment() == null || user.getDepartment().isBlank()) return null;
        List<UUID> rows = jdbc.queryForList("select id from departments where lower(trim(name)) = lower(trim(?))", UUID.class, user.getDepartment());
        return rows.isEmpty() ? null : rows.getFirst();
    }

    public boolean inScope(UserAccount user, UUID departmentId) {
        if (allDepartments(user)) return true;
        UUID own = departmentOf(user);
        return own != null && own.equals(departmentId);
    }

    public void requireScope(UserAccount user, UUID departmentId) {
        if (!inScope(user, departmentId)) throw new SecurityException(DENIED);
    }
}
