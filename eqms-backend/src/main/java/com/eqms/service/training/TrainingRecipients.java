package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import com.eqms.repository.UserAccountRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Who has to be told: the active people of a department who hold a permission (the unit head, the training coordinator). The permission is read each time from the
 * Access Profiles through {@link TrainingAccess}; nothing is tied to a role name. The people of a department are those whose department text matches its name, as everywhere else in Training.
 */
@Component
public class TrainingRecipients {
    private final JdbcTemplate jdbc;
    private final UserAccountRepository users;
    private final TrainingAccess access;

    public TrainingRecipients(JdbcTemplate jdbc, UserAccountRepository users, TrainingAccess access) {
        this.jdbc = jdbc;
        this.users = users;
        this.access = access;
    }

    /** Active people of the department who hold the permission. A permission held for all departments (training.scope.all) is not enough: the person must belong to the department. */
    public List<UserAccount> holders(String permission, UUID departmentId) {
        List<UserAccount> out = new ArrayList<>();
        if (departmentId == null) return out;
        List<String> names = jdbc.queryForList("select name from departments where id=?", String.class, departmentId);
        if (names.isEmpty()) return out;
        for (UUID id : jdbc.queryForList("select id from app_users where status='Active' and lower(trim(department)) = lower(trim(?))", UUID.class, names.getFirst())) {
            users.findById(id).filter(user -> access.has(user, permission)).ifPresent(out::add);
        }
        return out;
    }
}
