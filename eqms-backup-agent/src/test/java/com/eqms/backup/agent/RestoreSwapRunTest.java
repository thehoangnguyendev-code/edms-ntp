package com.eqms.backup.agent;

import com.eqms.backup.agent.ledger.LedgerService;
import com.eqms.backup.agent.restore.DatabaseSwap;
import com.eqms.backup.agent.restore.RestoreRunEngine;
import com.eqms.backup.agent.restore.RestoreRunEngine.Step;
import com.eqms.backup.agent.restore.RestoreSwapActions;
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
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** The engine with the real swap and rollback, on throw-away databases: a failure after the swap must leave the old data live. */
class RestoreSwapRunTest {

    @TempDir
    Path tmp;

    private final String adminUrl = System.getenv().getOrDefault("TEST_PG_URL", "jdbc:postgresql://localhost:5432/postgres");
    private final String user = System.getenv().getOrDefault("TEST_PG_USER", "eqms");
    private final String pw = System.getenv().getOrDefault("TEST_PG_PASSWORD", "eqms");

    ControlDbTestSupport db;
    RestoreRunEngine engine;
    List<String> alerts = new ArrayList<>();
    List<String> created = new ArrayList<>();

    @BeforeEach
    void setUp() throws Exception {
        db = new ControlDbTestSupport();
        var properties = new com.eqms.backup.agent.config.AgentProperties();
        properties.setLedgerDir(tmp.resolve("ledger"));
        engine = new RestoreRunEngine(db.jdbc, new LedgerService(db.jdbc, db.tx, properties), (code, detail, ref) -> alerts.add(code));
    }

    @AfterEach
    void tearDown() throws Exception {
        try (Connection c = DriverManager.getConnection(adminUrl, user, pw); Statement s = c.createStatement()) {
            for (String n : created) s.execute("drop database if exists \"" + n + "\" with (force)");
        }
        db.close();
    }

    private String mk(String marker) throws Exception {
        String n = "rsr_" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
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

    private String url(String db) {
        return adminUrl.substring(0, adminUrl.lastIndexOf('/') + 1) + db;
    }

    private String marker(String name) throws Exception {
        try (Connection c = DriverManager.getConnection(url(name), user, pw); Statement s = c.createStatement(); var rs = s.executeQuery("select v from m")) {
            rs.next();
            return rs.getString(1);
        }
    }

    private Map<Step, RestoreRunEngine.Action> actions(DatabaseSwap swap, String live, String restored, String tag, Step failAt) {
        Map<Step, RestoreRunEngine.Action> out = new EnumMap<>(Step.class);
        for (Step s : Step.values()) out.put(s, () -> Map.of("step", s.name()));
        out.put(Step.R10, RestoreSwapActions.swap(swap, live, restored, tag));
        if (failAt != null) out.put(failAt, () -> { throw new RestoreRunEngine.StepFailure("INJECTED", failAt + " failed"); });
        return out;
    }

    @Test
    void failureAfterSwapRollsBackToOldData() throws Exception {
        String live = mk("old"), restored = mk("new");
        String tag = "a" + UUID.randomUUID().toString().replace("-", "").substring(0, 6);
        DatabaseSwap swap = new DatabaseSwap(new DriverManagerDataSource(adminUrl, user, pw));
        created.add(DatabaseSwap.preName(live, tag));
        created.add(DatabaseSwap.postName(live, tag));
        var outcome = engine.run("RS-1", "BK-1", "tester", actions(swap, live, restored, tag, Step.R11), RestoreSwapActions.rollback(swap, live, tag));
        assertThat(outcome.completed()).isFalse();
        assertThat(outcome.failedStep()).isEqualTo(Step.R11);
        assertThat(outcome.errorCode()).isEqualTo("ROLLED_BACK");
        assertThat(marker(live)).isEqualTo("old");
        assertThat(marker(DatabaseSwap.postName(live, tag))).isEqualTo("new");
        assertThat(alerts).isEmpty();
    }

    @Test
    void failureBeforeSwapChangesNothing() throws Exception {
        String live = mk("old"), restored = mk("new");
        String tag = "b" + UUID.randomUUID().toString().replace("-", "").substring(0, 6);
        DatabaseSwap swap = new DatabaseSwap(new DriverManagerDataSource(adminUrl, user, pw));
        var outcome = engine.run("RS-2", "BK-2", "tester", actions(swap, live, restored, tag, Step.R9), RestoreSwapActions.rollback(swap, live, tag));
        assertThat(outcome.failedStep()).isEqualTo(Step.R9);
        assertThat(marker(live)).isEqualTo("old");
        assertThat(marker(restored)).isEqualTo("new");
    }

    @Test
    void successLeavesNewDataLiveAndOldKept() throws Exception {
        String live = mk("old"), restored = mk("new");
        String tag = "c" + UUID.randomUUID().toString().replace("-", "").substring(0, 6);
        DatabaseSwap swap = new DatabaseSwap(new DriverManagerDataSource(adminUrl, user, pw));
        created.add(DatabaseSwap.preName(live, tag));
        var outcome = engine.run("RS-3", "BK-3", "tester", actions(swap, live, restored, tag, null), RestoreSwapActions.rollback(swap, live, tag));
        assertThat(outcome.completed()).isTrue();
        assertThat(marker(live)).isEqualTo("new");
        assertThat(marker(DatabaseSwap.preName(live, tag))).isEqualTo("old");
    }

    @Test
    void failedSwapItselfLeavesOldDataLiveAndRollsBackSafely() throws Exception {
        String live = mk("old");
        String tag = "d" + UUID.randomUUID().toString().replace("-", "").substring(0, 6);
        DatabaseSwap swap = new DatabaseSwap(new DriverManagerDataSource(adminUrl, user, pw));
        var outcome = engine.run("RS-4", "BK-4", "tester", actions(swap, live, "rsr_missing_db", tag, null), RestoreSwapActions.rollback(swap, live, tag));
        assertThat(outcome.failedStep()).isEqualTo(Step.R10);
        assertThat(marker(live)).isEqualTo("old");
        assertThat(alerts).as("no false rollback alarm").isEmpty();
    }
}
