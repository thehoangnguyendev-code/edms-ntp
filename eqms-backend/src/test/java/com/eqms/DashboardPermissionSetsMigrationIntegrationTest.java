package com.eqms;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * V551 against the real schema: the two dashboard Permission Sets exist and bundle exactly the permissions the dashboard
 * endpoints already check, so creating them cannot change what any user can open.
 */
@SpringBootTest
@Transactional
class DashboardPermissionSetsMigrationIntegrationTest {

    @Autowired
    private JdbcTemplate jdbc;

    private List<String> permissionsOf(String setCode) {
        return jdbc.queryForList("""
                select p.code
                from permission_sets ps
                join permission_set_items psi on psi.permission_set_id = ps.id
                join permissions p on p.id = psi.permission_id
                where ps.code = ?
                order by p.code
                """, String.class, setCode);
    }

    @Test
    void the_user_set_bundles_only_the_dashboard_module_permission() {
        assertThat(permissionsOf("DASHBOARD_USER")).containsExactly("dashboard.module.view");
    }

    @Test
    void the_admin_set_bundles_the_admin_permission_together_with_the_module_permission_it_requires() {
        assertThat(permissionsOf("DASHBOARD_ADMIN")).containsExactly("dashboard.admin.view", "dashboard.module.view");

        // V403 records dashboard.admin.view as REQUIRES dashboard.module.view; the set must not hand out the first without the second.
        Integer requires = jdbc.queryForObject(
                "select count(*) from permission_dependencies where permission_code = ? and depends_on_code = ? and relation_type = 'REQUIRES'",
                Integer.class, "dashboard.admin.view", "dashboard.module.view");
        assertThat(requires).isEqualTo(1);
    }

    @Test
    void both_sets_are_active_custom_sets_with_distinct_names() {
        List<String> rows = jdbc.queryForList(
                "select code || ':' || name || ':' || active || ':' || system from permission_sets where code in ('DASHBOARD_USER', 'DASHBOARD_ADMIN') order by code",
                String.class);

        assertThat(rows).containsExactly(
                "DASHBOARD_ADMIN:Dashboard Admin:true:false",
                "DASHBOARD_USER:Dashboard User:true:false");
    }
}
