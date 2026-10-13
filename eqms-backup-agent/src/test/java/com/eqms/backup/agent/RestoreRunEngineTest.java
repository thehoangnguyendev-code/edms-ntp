package com.eqms.backup.agent;

import com.eqms.backup.agent.export.ExportException;
import com.eqms.backup.agent.ledger.LedgerService;
import com.eqms.backup.agent.restore.RestoreRunEngine;
import com.eqms.backup.agent.restore.RestoreRunEngine.Step;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** The restore run's order, stop rules and rollback (SDS 11.3, R5-R12). The actions are fakes; the record is the real control database. */
class RestoreRunEngineTest {

    @TempDir
    Path tmp;

    ControlDbTestSupport db;
    LedgerService ledger;
    RestoreRunEngine engine;
    List<String> alerts;
    List<Step> called;
    boolean rolledBack;

    @BeforeEach
    void setUp() throws Exception {
        db = new ControlDbTestSupport();
        var properties = new com.eqms.backup.agent.config.AgentProperties();
        properties.setLedgerDir(tmp.resolve("ledger"));
        ledger = new LedgerService(db.jdbc, db.tx, properties);
        alerts = new ArrayList<>();
        called = new ArrayList<>();
        rolledBack = false;
        engine = new RestoreRunEngine(db.jdbc, ledger, (code, detail, ref) -> alerts.add(code));
    }

    @AfterEach
    void tearDown() throws Exception {
        db.close();
    }

    /** Every step succeeds unless the test replaces it. */
    private Map<Step, RestoreRunEngine.Action> actions(Map<Step, RestoreRunEngine.Action> overrides) {
        Map<Step, RestoreRunEngine.Action> out = new EnumMap<>(Step.class);
        for (Step s : Step.values()) {
            out.put(s, () -> {
                called.add(s);
                return Map.of("step", s.name());
            });
        }
        out.putAll(overrides);
        return out;
    }

    private RestoreRunEngine.Action failing(Step s, String code) {
        return () -> {
            called.add(s);
            throw new RestoreRunEngine.StepFailure(code, s + " refused");
        };
    }

    /** The rollback of the swap: it sets its own flag, so that it is not mistaken for a step. */
    private RestoreRunEngine.Action rollbackAction() {
        return () -> {
            rolledBack = true;
            return Map.of();
        };
    }

    private String statusOfLastRun() {
        return db.jdbc.queryForObject("select status from restore_run order by started_at desc limit 1", String.class);
    }

    private List<String> recordedSteps() {
        return db.jdbc.queryForList("select step_code || ':' || status from restore_run_step order by id", String.class);
    }

    @Test
    void allStepsInOrderCompleteTheRunAndAreRecorded() {
        RestoreRunEngine.Outcome out = engine.run("RS-1", "BK-1", "admin", actions(Map.of()), rollbackAction());
        assertThat(out.completed()).isTrue();
        assertThat(called).containsExactly(Step.values());
        assertThat(recordedSteps()).containsExactly("R5:PASSED", "R6:PASSED", "R7:PASSED", "R8:PASSED", "R9:PASSED", "R10:PASSED", "R11:PASSED", "R12:PASSED");
        assertThat(statusOfLastRun()).isEqualTo("COMPLETED");
        assertThat(alerts).isEmpty();
    }

    @Test
    void aFailureBeforeTheSwapStopsTheRunAndNothingIsSwapped() {
        RestoreRunEngine.Outcome out = engine.run("RS-2", "BK-1", "admin", actions(Map.of(Step.R7, failing(Step.R7, "CHECK_FAILED"))), rollbackAction());
        assertThat(out.completed()).isFalse();
        assertThat(out.failedStep()).isEqualTo(Step.R7);
        assertThat(out.errorCode()).isEqualTo("CHECK_FAILED");
        assertThat(called).as("R8 onwards never ran").doesNotContain(Step.R8, Step.R10, Step.R11, Step.R12);
        assertThat(rolledBack).as("nothing was swapped, so nothing is rolled back").isFalse();
        assertThat(recordedSteps()).containsExactly("R5:PASSED", "R6:PASSED", "R7:FAILED");
        assertThat(statusOfLastRun()).isEqualTo("FAILED");
        assertThat(alerts).isEmpty();
    }

    @Test
    void aFailureAfterTheSwapRollsBack() {
        RestoreRunEngine.Outcome out = engine.run("RS-3", "BK-1", "admin", actions(Map.of(Step.R11, failing(Step.R11, "POST_CHECK_FAILED"))),
                rollbackAction());
        assertThat(out.completed()).isFalse();
        assertThat(out.errorCode()).isEqualTo("ROLLED_BACK");
        assertThat(called).contains(Step.R10, Step.R11).doesNotContain(Step.R12);
        assertThat(rolledBack).isTrue();
        assertThat(db.jdbc.queryForObject("select count(*) from ledger_event where event = 'RESTORE_RUN_ROLLED_BACK'", Integer.class)).isEqualTo(1);
        assertThat(alerts).isEmpty();
    }

    @Test
    void aFailedRollbackRaisesAnAlertAndSaysSo() {
        RestoreRunEngine.Outcome out = engine.run("RS-4", "BK-1", "admin",
                actions(Map.of(Step.R11, failing(Step.R11, "POST_CHECK_FAILED"))), () -> {
                    throw new IllegalStateException("the old database could not be put back");
                });
        assertThat(out.errorCode()).isEqualTo("ROLLBACK_FAILED");
        assertThat(alerts).containsExactly("RESTORE_ROLLBACK_FAILED");
    }

    @Test
    void aFailureDuringTheSwapStillRunsTheRollback() {
        // the swap can stop half way, so the rollback is run even though R10 itself failed
        RestoreRunEngine.Outcome out = engine.run("RS-5", "BK-1", "admin", actions(Map.of(Step.R10, failing(Step.R10, "SWAP_FAILED"))), rollbackAction());
        assertThat(out.errorCode()).isEqualTo("ROLLED_BACK");
        assertThat(rolledBack).isTrue();
    }

    @Test
    void aSecondRunIsRefusedWhileOneIsOpen() {
        db.jdbc.update("insert into restore_run(run_code, restore_number, backup_number, status, started_by) values ('RR-OPEN', 'RS-0', 'BK-0', 'RUNNING', 'admin')");
        assertThatThrownBy(() -> engine.run("RS-6", "BK-1", "admin", actions(Map.of()), null))
                .isInstanceOfSatisfying(ExportException.class, e -> assertThat(e.code).isEqualTo("RESTORE_RUN_BUSY"));
        assertThat(called).isEmpty();
    }

    @Test
    void everyStepMustHaveAnAction() {
        Map<Step, RestoreRunEngine.Action> missing = actions(Map.of());
        missing.remove(Step.R9);
        assertThatThrownBy(() -> engine.run("RS-7", "BK-1", "admin", missing, null)).isInstanceOf(IllegalArgumentException.class);
        assertThat(db.jdbc.queryForObject("select count(*) from restore_run", Integer.class)).as("nothing is started").isZero();
    }

    @Test
    void theOrderOfStepsIsFixed() {
        assertThat(Step.values().length).isEqualTo(8);
        assertThat(Step.values()).containsExactly(Step.R5, Step.R6, Step.R7, Step.R8, Step.R9, Step.R10, Step.R11, Step.R12);
        assertThat(List.of(Step.values()).stream().map(Enum::name).collect(Collectors.joining(","))).isEqualTo("R5,R6,R7,R8,R9,R10,R11,R12");
    }
}
