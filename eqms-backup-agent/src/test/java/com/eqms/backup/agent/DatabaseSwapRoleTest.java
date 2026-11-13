package com.eqms.backup.agent;

import com.eqms.backup.agent.restore.DatabaseSwap;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The swap with a login that is NOT a superuser, as in production: it owns the live database, is a member of the role that owns the
 * restored database, and ends sessions only through a limited SECURITY DEFINER function. The application's own login (a superuser here)
 * keeps a session open on the live database during the swap. Everything is created and dropped by the test.
 */
class DatabaseSwapRoleTest {

    private final String adminUrl = System.getenv().getOrDefault("TEST_PG_URL", "jdbc:postgresql://localhost:5432/postgres");
    private final String admin = System.getenv().getOrDefault("TEST_PG_USER", "eqms");
    private final String adminPw = System.getenv().getOrDefault("TEST_PG_PASSWORD", "eqms");

    private String url(String db) {
        return adminUrl.substring(0, adminUrl.lastIndexOf('/') + 1) + db;
    }

    private String owner(Statement s, String db) throws SQLException {
        try (var rs = s.executeQuery("select pg_get_userbyid(datdba) from pg_database where datname = '" + db + "'")) {
            return rs.next() ? rs.getString(1) : null;
        }
    }

    @Test
    void aNonSuperuserSwapsAndRollsBackWhileTheApplicationLoginHoldsASession() throws Exception {
        String id = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        String swapRole = "swt_swap_" + id, restoreRole = "swt_rest_" + id, fn = "swt_end_" + id;
        String live = "swt_live_" + id, kept = "eqms_keep_" + id, tag = "r" + id;
        String pre = DatabaseSwap.preName(live, tag), post = DatabaseSwap.postName(live, tag);
        try (Connection c = DriverManager.getConnection(adminUrl, admin, adminPw); Statement s = c.createStatement()) {
            s.execute("create role " + restoreRole + " nosuperuser createdb");
            s.execute("create role " + swapRole + " login nosuperuser createdb password 'pw" + id + "'");
            s.execute("grant " + restoreRole + " to " + swapRole);
            s.execute("create database " + live + " owner " + swapRole);
            s.execute("create database " + kept + " owner " + restoreRole);
            s.execute("create function public." + fn + "(target text) returns integer language plpgsql security definer set search_path = pg_catalog as $b$ "
                    + "declare ended integer; begin "
                    + "if target <> '" + live + "' and target !~ '^eqms_(keep|restore)_[a-z0-9_]+$' and target !~ '^.*_(pre|post)_[a-z0-9_]+$' then raise exception 'not allowed'; end if; "
                    + "select count(*) into ended from (select pg_terminate_backend(pid) from pg_stat_activity where datname = target and pid <> pg_backend_pid()) x; return ended; end $b$");
            s.execute("revoke all on function public." + fn + "(text) from public");
            s.execute("grant execute on function public." + fn + "(text) to " + swapRole);
        }
        for (String[] d : new String[][]{{live, "old"}, {kept, "new"}}) {
            try (Connection c = DriverManager.getConnection(url(d[0]), admin, adminPw); Statement s = c.createStatement()) {
                s.execute("create table m(v text)");
                s.execute("insert into m values ('" + d[1] + "')");
            }
        }
        try {
            DatabaseSwap swap = new DatabaseSwap(new DriverManagerDataSource(adminUrl, swapRole, "pw" + id), fn, swapRole);
            try (Connection app = DriverManager.getConnection(url(live), admin, adminPw)) {  // the application's own session
                swap.swapIn(live, kept, tag);
                assertThat(app.isValid(1)).as("the session on the old database was ended").isFalse();
            }
            try (Connection c = DriverManager.getConnection(adminUrl, admin, adminPw); Statement s = c.createStatement()) {
                assertThat(owner(s, live)).isEqualTo(swapRole);
            }
            assertThat(marker(live)).isEqualTo("new");
            assertThat(marker(pre)).isEqualTo("old");

            swap.rollBack(live, tag);
            assertThat(marker(live)).isEqualTo("old");
            assertThat(marker(post)).isEqualTo("new");

            // the function may not be used on any other database
            try (Connection c = DriverManager.getConnection(adminUrl, swapRole, "pw" + id); Statement s = c.createStatement()) {
                assertThatThrownBy(() -> s.execute("select public." + fn + "('template1')")).hasMessageContaining("not allowed");
            }
        } finally {
            try (Connection c = DriverManager.getConnection(adminUrl, admin, adminPw); Statement s = c.createStatement()) {
                for (String db : new String[]{live, kept, pre, post}) s.execute("drop database if exists \"" + db + "\" with (force)");
                s.execute("drop function if exists public." + fn + "(text)");
                s.execute("drop role if exists " + swapRole);
                s.execute("drop role if exists " + restoreRole);
            }
        }
    }

    private String marker(String db) throws SQLException {
        try (Connection c = DriverManager.getConnection(url(db), admin, adminPw); Statement s = c.createStatement(); var rs = s.executeQuery("select v from m")) {
            rs.next();
            return rs.getString(1);
        }
    }
}
