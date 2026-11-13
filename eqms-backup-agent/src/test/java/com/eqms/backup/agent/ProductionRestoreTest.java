package com.eqms.backup.agent;

import com.eqms.backup.agent.export.ExportException;
import com.eqms.backup.agent.ledger.LedgerService;
import com.eqms.backup.agent.restore.DatabaseSwap;
import com.eqms.backup.agent.restore.ProductionRestore;
import com.eqms.backup.agent.restore.RestoreLifecycleService;
import com.eqms.backup.agent.restore.RestoreRunEngine;
import com.eqms.backup.agent.restore.RestoreRunEngine.Step;
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
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** The whole restore run with real swaps on throw-away databases and fake stages for keys and storage. */
class ProductionRestoreTest {

    @TempDir
    Path tmp;

    private final String adminUrl = System.getenv().getOrDefault("TEST_PG_URL", "jdbc:postgresql://localhost:5432/postgres");
    private final String user = System.getenv().getOrDefault("TEST_PG_USER", "eqms");
    private final String pw = System.getenv().getOrDefault("TEST_PG_PASSWORD", "eqms");

    ControlDbTestSupport db;
    DatabaseSwap swap;
    RestoreLifecycleService lifecycle;
    RestoreRunEngine engine;
    List<String> alerts = new ArrayList<>();
    List<String> created = new ArrayList<>();
    String live;
    List<String> filesTarget = new ArrayList<>();

    @BeforeEach
    void setUp() throws Exception {
        db = new ControlDbTestSupport();
        var properties = new com.eqms.backup.agent.config.AgentProperties();
        properties.setLedgerDir(tmp.resolve("ledger"));
        var ledger = new LedgerService(db.jdbc, db.tx, properties);
        swap = new DatabaseSwap(new DriverManagerDataSource(adminUrl, user, pw));
        lifecycle = new RestoreLifecycleService(db.jdbc, db.tx, ledger, swap);
        engine = new RestoreRunEngine(db.jdbc, ledger, (c, d, r) -> alerts.add(c));
        live = mk("old");
    }

    @AfterEach
    void tearDown() throws Exception {
        try (Connection c = DriverManager.getConnection(adminUrl, user, pw); Statement s = c.createStatement()) {
            for (String n : created) s.execute("drop database if exists \"" + n + "\" with (force)");
            for (String n : new String[]{"pre", "post"}) {
                try (var rs = s.executeQuery("select datname from pg_database where datname like '" + live + "\\_" + n + "\\_%'")) {
                    List<String> names = new ArrayList<>();
                    while (rs.next()) names.add(rs.getString(1));
                    for (String x : names) c.createStatement().execute("drop database \"" + x + "\" with (force)");
                }
            }
        }
        db.close();
    }

    private String url(String n) {
        return adminUrl.substring(0, adminUrl.lastIndexOf('/') + 1) + n;
    }

    private String mk(String marker) throws Exception {
        String n = "prt_" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        created.add(n);
        try (Connection c = DriverManager.getConnection(adminUrl, user, pw); Statement s = c.createStatement()) {
            s.execute("create database " + n);
        }
        try (Connection c = DriverManager.getConnection(url(n), user, pw); Statement s = c.createStatement()) {
            s.execute("create table m(v text)");
            s.execute("insert into m values ('" + marker + "')");
        }
        return n;
    }

    private String marker(String n) throws Exception {
        try (Connection c = DriverManager.getConnection(url(n), user, pw); Statement s = c.createStatement(); var rs = s.executeQuery("select v from m")) {
            rs.next();
            return rs.getString(1);
        }
    }

    /** Stages that succeed unless told to fail at one point. */
    private ProductionRestore.Stages stages(String failAt) {
        return new ProductionRestore.Stages() {
            public void assertGate(String n) throws Exception {
                if ("R5".equals(failAt)) throw new RestoreRunEngine.StepFailure("NOT_LOCKED", "system not locked");
            }

            public String restoreToKeptDatabase(String b, String by) throws Exception {
                if ("R6".equals(failAt)) throw new RestoreRunEngine.StepFailure("RESTORE_FAILED", "dump broken");
                return mk("new");
            }

            public Map<String, Object> addMissingFiles(String b, String restoredDatabase) throws Exception {
                filesTarget.add(restoredDatabase == null ? "<live>" : "<restored>");
                if ("R8".equals(failAt)) throw new RestoreRunEngine.StepFailure("FILES_MISSING", "file cannot be supplied");
                return Map.of("added", 0);
            }

            public void discardKept(String database) throws Exception {
                try (Connection c = DriverManager.getConnection(adminUrl, user, pw); Statement s = c.createStatement()) {
                    s.execute("drop database if exists \"" + database + "\" with (force)");
                }
            }

            public Map<String, Object> checkLive(String b) throws Exception {
                if ("R11".equals(failAt)) throw new RestoreRunEngine.StepFailure("LIVE_CHECK", "a reference is broken");
                return Map.of("ok", true);
            }
        };
    }

    private ProductionRestore restore(String failAt) {
        return new ProductionRestore(engine, swap, lifecycle, stages(failAt), live, (c, d, r) -> alerts.add(c));
    }

    private int keptDatabases() throws Exception {
        // every database made by mk() after the live one is a restored copy
        int n = 0;
        try (Connection c = DriverManager.getConnection(adminUrl, user, pw); Statement s = c.createStatement()) {
            for (String d : created) {
                if (d.equals(live)) continue;
                try (var rs = s.executeQuery("select 1 from pg_database where datname = '" + d + "'")) {
                    if (rs.next()) n++;
                }
            }
        }
        return n;
    }

    private int outcomes() {
        return db.jdbc.queryForObject("select count(*) from restore_outcome", Integer.class);
    }

    @Test
    void successSwapsAndWaitsForFinalization() throws Exception {
        var out = restore(null).run("BK-1", "qa.one", "SIG-1");
        assertThat(out.completed()).isTrue();
        assertThat(marker(live)).isEqualTo("new");
        assertThat(db.jdbc.queryForObject("select status from restore_outcome", String.class)).isEqualTo("PENDING_FINALIZATION");
        assertThat(db.jdbc.queryForObject("select restore_signature from restore_outcome", String.class)).isEqualTo("SIG-1");
    }

    @Test
    void failureBeforeSwapChangesNothing() throws Exception {
        for (String at : new String[]{"R5", "R6", "R8"}) {
            var out = restore(at).run("BK-1", "qa.one", "SIG-1");
            assertThat(out.completed()).as(at).isFalse();
            assertThat(out.failedStep()).hasToString(at);
            assertThat(marker(live)).as(at).isEqualTo("old");
            assertThat(outcomes()).as(at).isZero();
        }
        assertThat(keptDatabases()).as("restored databases of failed runs are dropped").isZero();
        assertThat(alerts).isEmpty();
    }

    @Test
    void failedLiveCheckRollsBackAndRecordsNothing() throws Exception {
        var out = restore("R11").run("BK-1", "qa.one", "SIG-1");
        assertThat(out.failedStep()).isEqualTo(Step.R11);
        assertThat(out.errorCode()).isEqualTo("ROLLED_BACK");
        assertThat(marker(live)).isEqualTo("old");
        assertThat(outcomes()).isZero();
        assertThat(alerts).isEmpty();
    }

    @Test
    void secondRestoreIsRefusedWhileFirstWaitsAndThenAllowedAfterFinalize() throws Exception {
        restore(null).run("BK-1", "qa.one", "SIG-1");
        var refused = restore(null).run("BK-2", "qa.one", "SIG-2");
        assertThat(refused.failedStep()).isEqualTo(Step.R5);
        assertThat(marker(live)).isEqualTo("new");
        String run = db.jdbc.queryForObject("select run_code from restore_outcome", String.class);
        lifecycle.finalizeRestore(run, "qa.two", "SIG-3");
        assertThat(restore(null).run("BK-3", "qa.one", "SIG-4").completed()).isTrue();
    }

    @Test
    void personRollbackAfterSuccessfulRunRestoresOldData() throws Exception {
        restore(null).run("BK-1", "qa.one", "SIG-1");
        String run = db.jdbc.queryForObject("select run_code from restore_outcome", String.class);
        lifecycle.rollBack(run, "admin.one", "SIG-2");
        assertThat(marker(live)).isEqualTo("old");
    }

    @Test
    void filesOnlyAddsFilesToTheLiveSystemWithoutSwappingAndIsRecordedAsFinalized() throws Exception {
        var out = restore(null).run("BK-1", "qa.one", "SIG-1", java.util.Set.of("OBJECT_STORE"));
        assertThat(out.completed()).isTrue();
        assertThat(marker(live)).as("no database was swapped").isEqualTo("old");
        assertThat(filesTarget).containsExactly("<live>");
        assertThat(db.jdbc.queryForObject("select status from restore_outcome", String.class)).isEqualTo("FINALIZED");
        assertThat(db.jdbc.queryForObject("select components from restore_outcome", String.class)).isEqualTo("OBJECT_STORE");
        assertThat(keptDatabases()).isZero();
        // nothing waits, so another restore may follow at once
        assertThat(restore(null).run("BK-2", "qa.one", "SIG-2", java.util.Set.of("OBJECT_STORE")).completed()).isTrue();
    }

    @Test
    void databaseOnlySwapsAndDoesNotTouchTheFiles() throws Exception {
        var out = restore(null).run("BK-1", "qa.one", "SIG-1", java.util.Set.of("DATABASE"));
        assertThat(out.completed()).isTrue();
        assertThat(marker(live)).isEqualTo("new");
        assertThat(filesTarget).isEmpty();
        assertThat(db.jdbc.queryForObject("select components from restore_outcome", String.class)).isEqualTo("DATABASE");
    }

    @Test
    void databaseAndFilesTogetherAddFilesToTheRestoredDatabaseBeforeTheSwap() throws Exception {
        var out = restore(null).run("BK-1", "qa.one", "SIG-1", java.util.Set.of("DATABASE", "OBJECT_STORE"));
        assertThat(out.completed()).isTrue();
        assertThat(filesTarget).containsExactly("<restored>");
        assertThat(db.jdbc.queryForObject("select components from restore_outcome", String.class)).isEqualTo("DATABASE,OBJECT_STORE");
    }

    @Test
    void theRemovedSettingsPartIsRefusedBeforeAnythingRuns() throws Exception {
        assertThatThrownBy(() -> restore(null).run("BK-1", "qa.one", "SIG-1", java.util.Set.of("CONFIGURATION")))
                .isInstanceOf(ExportException.class).hasMessageContaining("part of the database");
        assertThatThrownBy(() -> restore(null).run("BK-1", "qa.one", "SIG-1", java.util.Set.of("CONFIGURATION", "OBJECT_STORE")))
                .isInstanceOf(ExportException.class);
        assertThatThrownBy(() -> restore(null).run("BK-1", "qa.one", "SIG-1", java.util.Set.of())).isInstanceOf(ExportException.class);
        assertThat(db.jdbc.queryForObject("select count(*) from restore_run", Integer.class)).isZero();
    }

    @Test
    void noSignatureOrPersonMeansNoRun() throws Exception {
        assertThatThrownBy(() -> restore(null).run("BK-1", "qa.one", "")).isInstanceOf(ExportException.class);
        assertThatThrownBy(() -> restore(null).run("BK-1", " ", "SIG")).isInstanceOf(ExportException.class);
        assertThat(db.jdbc.queryForObject("select count(*) from restore_run", Integer.class)).isZero();
        assertThat(marker(live)).isEqualTo("old");
    }
}
