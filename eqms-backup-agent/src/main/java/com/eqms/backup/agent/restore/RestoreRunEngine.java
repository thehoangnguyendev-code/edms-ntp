package com.eqms.backup.agent.restore;

import com.eqms.backup.agent.export.ExportException;
import com.eqms.backup.agent.ledger.CanonicalJson;
import com.eqms.backup.agent.ledger.LedgerService;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * The restore run, steps R5 to R12 of SDS-BR-001 section 11.3. This class owns the order, the record and the stop rules; each step's
 * work is an {@link Action} supplied by the caller, so the order can be tested without a live database.
 * R5 lock check, R6 restore into a scratch database, R7 checks, R8 documents, R9 safety backup, R10 swap, R11 post-restore checks,
 * R12 unlock. A failure stops the run at once. A failure after the swap (R10) calls the rollback action; if that fails the run says so
 * and raises an alert. Every step is recorded once in restore_run_step (append-only).
 */
public class RestoreRunEngine {

    public enum Step { R5, R6, R7, R8, R9, R10, R11, R12 }

    /** The work of one step. Throw to fail it; the message is recorded. */
    @FunctionalInterface
    public interface Action {
        Map<String, Object> run() throws Exception;
    }

    /** The result of a run: completed, or failed at a step with what was done about it. */
    public record Outcome(boolean completed, String runCode, Step failedStep, String errorCode, String errorDetail, List<Step> passed) {
    }

    /** Raised by an action when the step is refused on purpose (for example, the precondition does not hold). */
    public static final class StepFailure extends Exception {
        public final String code;

        public StepFailure(String code, String message) {
            super(message);
            this.code = code;
        }
    }

    private final JdbcTemplate jdbc;
    private final LedgerService ledger;
    private final Alerter alerts;

    /** Where a rollback that did not work is reported (the backup alert table in production). */
    public interface Alerter {
        void raise(String code, String detail, String ref);
    }

    public RestoreRunEngine(JdbcTemplate jdbc, LedgerService ledger, Alerter alerts) {
        this.jdbc = jdbc;
        this.ledger = ledger;
        this.alerts = alerts;
    }

    /**
     * Runs R5 to R12 in order. {@code actions} must hold every step; {@code rollback}, when present, undoes the swap after a failure
     * from R11 on. Only one run may be open at a time: a second start is refused while one is RUNNING.
     */
    public Outcome run(String restoreNumber, String backupNumber, String by, Map<Step, Action> actions, Action rollback) {
        for (Step s : Step.values()) {
            if (!actions.containsKey(s)) throw new IllegalArgumentException("No action for step " + s);
        }
        String runCode = "RR-" + restoreNumber + "-" + UUID.randomUUID().toString().substring(0, 8);
        UUID runId;
        try {
            runId = jdbc.queryForObject("insert into restore_run(run_code, restore_number, backup_number, status, started_by) values (?,?,?,'RUNNING',?) returning id",
                    UUID.class, runCode, restoreNumber, backupNumber, by);
        } catch (DuplicateKeyException e) {
            throw ExportException.conflict("RESTORE_RUN_BUSY", "Another restore run is already running");
        }
        ledger.append(by, "RESTORE_RUN_STARTED", backupNumber, Map.of("runCode", runCode, "restoreNumber", restoreNumber));

        List<Step> passed = new ArrayList<>();
        for (Step step : Step.values()) {
            try {
                Map<String, Object> detail = actions.get(step).run();
                record(runId, step, "PASSED", detail);
                passed.add(step);
            } catch (Exception e) {
                String code = e instanceof StepFailure f ? f.code : "RESTORE_STEP_FAILED";
                String message = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
                record(runId, step, "FAILED", Map.of("code", code, "message", message));
                // from the swap on, the live database may have changed: undo it. A failure before the swap changes nothing.
                String finalCode = code;
                if (step.ordinal() >= Step.R10.ordinal()) {
                    String outcome = rollBack(runCode, backupNumber, by, step, rollback);
                    if (outcome.equals("ROLLED_BACK") || outcome.equals("ROLLBACK_FAILED")) finalCode = outcome;
                }
                jdbc.update("update restore_run set status = 'FAILED', finished_at = now(), failed_step = ?, error_code = ?, error_detail = ? where id = ?",
                        step.name(), finalCode, message, runId);
                ledger.append(by, "RESTORE_RUN_FAILED", backupNumber, Map.of("runCode", runCode, "step", step.name(), "code", finalCode));
                return new Outcome(false, runCode, step, finalCode, message, passed);
            }
        }
        jdbc.update("update restore_run set status = 'COMPLETED', finished_at = now() where id = ?", runId);
        ledger.append(by, "RESTORE_RUN_COMPLETED", backupNumber, Map.of("runCode", runCode));
        return new Outcome(true, runCode, null, null, null, passed);
    }

    /** After the swap, undo it. Returns ROLLED_BACK, or ROLLBACK_FAILED with an alert: the database then needs a person. */
    private String rollBack(String runCode, String backupNumber, String by, Step failed, Action rollback) {
        if (rollback == null) {
            alerts.raise("RESTORE_ROLLBACK_MISSING", "The restore run " + runCode + " failed at " + failed + " after the swap point and has no rollback", runCode);
            return "ROLLBACK_FAILED";
        }
        try {
            rollback.run();
            ledger.append(by, "RESTORE_RUN_ROLLED_BACK", backupNumber, Map.of("runCode", runCode, "afterStep", failed.name()));
            return "ROLLED_BACK";
        } catch (Exception e) {
            alerts.raise("RESTORE_ROLLBACK_FAILED", "The restore run " + runCode + " failed at " + failed + " after the swap and could not be rolled back: "
                    + e.getMessage(), runCode);
            ledger.append(by, "RESTORE_ROLLBACK_FAILED", backupNumber, Map.of("runCode", runCode, "afterStep", failed.name()));
            return "ROLLBACK_FAILED";
        }
    }

    private void record(UUID runId, Step step, String status, Map<String, ?> detail) {
        jdbc.update("insert into restore_run_step(run_id, step_code, status, detail_json) values (?,?,?,?::jsonb)", runId, step.name(), status, CanonicalJson.of(detail));
    }
}
