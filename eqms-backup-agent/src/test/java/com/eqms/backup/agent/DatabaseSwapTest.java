package com.eqms.backup.agent;

import com.eqms.backup.agent.restore.DatabaseSwap;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/** Runs on throw-away databases only; it never touches the eQMS database. */
class DatabaseSwapTest {

    private final String adminUrl = System.getenv().getOrDefault("TEST_PG_URL", "jdbc:postgresql://localhost:5432/postgres");
    private final String user = System.getenv().getOrDefault("TEST_PG_USER", "eqms");
    private final String pw = System.getenv().getOrDefault("TEST_PG_PASSWORD", "eqms");

    private String mk(String marker) throws Exception {
        String n = "swt_" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        try (Connection c = DriverManager.getConnection(adminUrl, user, pw); Statement s = c.createStatement()) {
            s.execute("create database " + n);
        }
        try (Connection c = DriverManager.getConnection(url(n), user, pw); Statement s = c.createStatement()) {
            s.execute("create table m(v text)");
            s.execute("insert into m values ('" + marker + "')");
        }
        return n;
    }

    private String url(String db) {
        return adminUrl.substring(0, adminUrl.lastIndexOf('/') + 1) + db;
    }

    private String marker(String db) throws Exception {
        try (Connection c = DriverManager.getConnection(url(db), user, pw); Statement s = c.createStatement();
             var rs = s.executeQuery("select v from m")) {
            rs.next();
            return rs.getString(1);
        }
    }

    private boolean exists(String db) throws Exception {
        try (Connection c = DriverManager.getConnection(adminUrl, user, pw); Statement s = c.createStatement();
             var rs = s.executeQuery("select 1 from pg_database where datname='" + db + "'")) {
            return rs.next();
        }
    }

    private void drop(String... dbs) throws Exception {
        try (Connection c = DriverManager.getConnection(adminUrl, user, pw); Statement s = c.createStatement()) {
            for (String d : dbs) s.execute("drop database if exists " + d + " with (force)");
        }
    }

    @Test
    void swapKeepsOldAndRollbackBringsItBackEvenWithOpenConnection() throws Exception {
        String live = mk("old"), restored = mk("new");
        String tag = "t" + UUID.randomUUID().toString().replace("-", "").substring(0, 6);
        DatabaseSwap swap = new DatabaseSwap(new DriverManagerDataSource(adminUrl, user, pw));
        try (Connection open = DriverManager.getConnection(url(live), user, pw)) {
            swap.swapIn(live, restored, tag);
            assertTrue(open.isClosed() || !open.isValid(1));
        }
        assertEquals("new", marker(live));
        assertEquals("old", marker(DatabaseSwap.preName(live, tag)));
        assertFalse(exists(restored));

        swap.rollBack(live, tag);
        assertEquals("old", marker(live));
        assertEquals("new", marker(DatabaseSwap.postName(live, tag)));
        assertFalse(exists(DatabaseSwap.preName(live, tag)));
        drop(live, DatabaseSwap.postName(live, tag));
    }

    @Test
    void refusesWhenRestoredMissingAndChangesNothing() throws Exception {
        String live = mk("old");
        DatabaseSwap swap = new DatabaseSwap(new DriverManagerDataSource(adminUrl, user, pw));
        assertThrows(Exception.class, () -> swap.swapIn(live, "swt_does_not_exist", "t1"));
        assertEquals("old", marker(live));
        assertFalse(exists(DatabaseSwap.preName(live, "t1")));
        drop(live);
    }

    @Test
    void refusesWhenKeptCopyAlreadyExists() throws Exception {
        String live = mk("old"), restored = mk("new");
        DatabaseSwap swap = new DatabaseSwap(new DriverManagerDataSource(adminUrl, user, pw));
        swap.swapIn(live, restored, "t2");
        String again = mk("again");
        assertThrows(Exception.class, () -> swap.swapIn(live, again, "t2"));
        assertEquals("new", marker(live));
        drop(live, DatabaseSwap.preName(live, "t2"), again);
    }

    @Test
    void worksWithHyphenatedLiveNameLikeTheRealDatabase() throws Exception {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        String live = "swt-live-" + suffix, restored = "swt_new_" + suffix;
        try (Connection c = DriverManager.getConnection(adminUrl, user, pw); Statement s = c.createStatement()) {
            s.execute("create database \"" + live + "\"");
            s.execute("create database \"" + restored + "\"");
        }
        for (String n : new String[]{live, restored}) {
            try (Connection c = DriverManager.getConnection(url(n), user, pw); Statement s = c.createStatement()) {
                s.execute("create table m(v text)");
                s.execute("insert into m values ('" + (n.equals(live) ? "old" : "new") + "')");
            }
        }
        DatabaseSwap swap = new DatabaseSwap(new DriverManagerDataSource(adminUrl, user, pw));
        swap.swapIn(live, restored, "h1");
        assertEquals("new", marker(live));
        swap.rollBack(live, "h1");
        assertEquals("old", marker(live));
        drop("\"" + live + "\"", "\"" + DatabaseSwap.postName(live, "h1") + "\"");
    }

    @Test
    void rejectsUnsafeNames() {
        DatabaseSwap swap = new DatabaseSwap(new DriverManagerDataSource(adminUrl, user, pw));
        assertThrows(IllegalArgumentException.class, () -> swap.swapIn("a\"; drop", "b", "t"));
    }
}
