package com.eqms.backup.agent;

import com.eqms.backup.agent.export.ExportException;
import com.eqms.backup.agent.ledger.LedgerService;
import com.eqms.backup.agent.restore.DatabaseSwap;
import com.eqms.backup.agent.restore.RestoreLifecycleService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Finalize and rollback after a swap, on throw-away databases. */
class RestoreLifecycleTest {

    @TempDir
    Path tmp;

    private final String adminUrl = System.getenv().getOrDefault("TEST_PG_URL", "jdbc:postgresql://localhost:5432/postgres");
    private final String user = System.getenv().getOrDefault("TEST_PG_USER", "eqms");
    private final String pw = System.getenv().getOrDefault("TEST_PG_PASSWORD", "eqms");

    ControlDbTestSupport db;
    RestoreLifecycleService service;
    DatabaseSwap swap;
    List<String> created = new ArrayList<>();

    @BeforeEach
    void setUp() throws Exception {
        db = new ControlDbTestSupport();
        var properties = new com.eqms.backup.agent.config.AgentProperties();
        properties.setLedgerDir(tmp.resolve("ledger"));
        swap = new DatabaseSwap(new DriverManagerDataSource(adminUrl, user, pw));
        service = new RestoreLifecycleService(db.jdbc, db.tx, new LedgerService(db.jdbc, db.tx, properties), swap);
    }

    @AfterEach
    void tearDown() throws Exception {
        try (Connection c = DriverManager.getConnection(adminUrl, user, pw); Statement s = c.createStatement()) {
            for (String n : created) s.execute("drop database if exists \"" + n + "\" with (force)");
        }
        db.close();
    }

    private String mk(String marker) throws Exception {
        String n = "rlc_" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        created.add(n);
        try (Connection c = DriverManager.getConnection(adminUrl, user, pw); Statement s = c.createStatement()) {
            s.execute("create database " + n);
        }
        try (Connection c = DriverManager.getConnection(adminUrl.substring(0, adminUrl.lastIndexOf('/') + 1) + n, user, pw); Statement s = c.createStatement()) {
            s.execute("create table m(v text)");
            s.execute("insert into m values ('" + marker + "')");
        }
        return n;
    }

    private String marker(String name) throws Exception {
        try (Connection c = DriverManager.getConnection(adminUrl.substring(0, adminUrl.lastIndexOf('/') + 1) + name, user, pw);
             Statement s = c.createStatement(); var rs = s.executeQuery("select v from m")) {
            rs.next();
            return rs.getString(1);
        }
    }

    /** Swaps a restored database in and records it, as a successful run would. */
    private String[] swapped(String run, String tag) throws Exception {
        String live = mk("old"), restored = mk("new");
        created.add(DatabaseSwap.preName(live, tag));
        created.add(DatabaseSwap.postName(live, tag));
        swap.swapIn(live, restored, tag);
        service.recordSwapped(run, "BK-1", live, tag, "qa.one", "SIG-1");
        return new String[]{live, tag};
    }

    private String status(String run) {
        return db.jdbc.queryForObject("select status from restore_outcome where run_code = ?", String.class, run);
    }

    @Test
    void finalizeClosesAndRollbackIsThenRefused() throws Exception {
        String[] r = swapped("RR-A", "fa1");
        service.finalizeRestore("RR-A", "qa.two", "SIG-2");
        assertThat(status("RR-A")).isEqualTo("FINALIZED");
        assertThat(marker(r[0])).isEqualTo("new");
        assertThatThrownBy(() -> service.rollBack("RR-A", "qa.two", "SIG-3")).isInstanceOf(ExportException.class).hasMessageContaining("already FINALIZED");
        assertThat(marker(r[0])).as("data unchanged by the refused rollback").isEqualTo("new");
    }

    @Test
    void rollbackBeforeFinalizeBringsOldDataBackAndFinalizeIsThenRefused() throws Exception {
        String[] r = swapped("RR-B", "fb1");
        service.rollBack("RR-B", "admin.one", "SIG-2");
        assertThat(status("RR-B")).isEqualTo("ROLLED_BACK");
        assertThat(marker(r[0])).isEqualTo("old");
        assertThat(db.jdbc.queryForObject("select post_db from restore_outcome where run_code = 'RR-B'", String.class)).isEqualTo(DatabaseSwap.postName(r[0], r[1]));
        assertThatThrownBy(() -> service.finalizeRestore("RR-B", "qa.two", "SIG-3")).isInstanceOf(ExportException.class);
    }

    @Test
    void signatureAndPersonAreRequired() throws Exception {
        swapped("RR-C", "fc1");
        assertThatThrownBy(() -> service.finalizeRestore("RR-C", "qa.two", " ")).isInstanceOf(ExportException.class).hasMessageContaining("signature");
        assertThatThrownBy(() -> service.rollBack("RR-C", "", "SIG")).isInstanceOf(ExportException.class);
        assertThat(status("RR-C")).isEqualTo("PENDING_FINALIZATION");
    }

    @Test
    void secondRestoreIsRefusedWhileOneWaits() throws Exception {
        swapped("RR-D", "fd1");
        assertThatThrownBy(() -> service.assertNoPending()).isInstanceOf(ExportException.class);
        assertThatThrownBy(() -> service.recordSwapped("RR-E", "BK-2", "x", "fd2", "qa.one", "SIG")).isInstanceOf(ExportException.class);
        service.finalizeRestore("RR-D", "qa.two", "SIG-2");
        service.assertNoPending();
    }

    @Test
    void outcomeFactsCannotBeAlteredAndRowsCannotBeDeleted() throws Exception {
        swapped("RR-F", "ff1");
        assertThatThrownBy(() -> db.jdbc.update("update restore_outcome set restored_by = 'someone else' where run_code = 'RR-F'")).hasMessageContaining("cannot be changed");
        assertThatThrownBy(() -> db.jdbc.update("delete from restore_outcome where run_code = 'RR-F'")).hasMessageContaining("cannot be deleted");
        service.finalizeRestore("RR-F", "qa.two", "SIG-2");
        assertThatThrownBy(() -> db.jdbc.update("update restore_outcome set status = 'ROLLED_BACK' where run_code = 'RR-F'")).hasMessageContaining("already FINALIZED");
    }

    @Test
    void failedRollbackLeavesRestoreWaiting() throws Exception {
        String[] r = swapped("RR-G", "fg1");
        try (Connection c = DriverManager.getConnection(adminUrl, user, pw); Statement s = c.createStatement()) {
            s.execute("create database \"" + DatabaseSwap.postName(r[0], r[1]) + "\"");  // blocks the rollback copy name
        }
        assertThatThrownBy(() -> service.rollBack("RR-G", "admin.one", "SIG-2")).isInstanceOf(ExportException.class);
        assertThat(status("RR-G")).isEqualTo("PENDING_FINALIZATION");
        assertThat(marker(r[0])).isEqualTo("new");
    }
}
