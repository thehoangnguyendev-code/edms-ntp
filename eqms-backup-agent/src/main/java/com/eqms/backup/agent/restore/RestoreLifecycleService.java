package com.eqms.backup.agent.restore;

import com.eqms.backup.agent.export.ExportException;
import com.eqms.backup.agent.ledger.LedgerService;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;

import java.sql.SQLException;
import java.util.List;
import java.util.Map;

/**
 * What happens to a restore after the swap (SDS-BR-003 steps 7-8). A restore waits in PENDING_FINALIZATION; while it waits it can be
 * rolled back. A person with the finalize permission closes it, and from then on it cannot be rolled back. Every change needs a named
 * person and the reference of their electronic signature, which the caller (the eQMS backend) has already verified. Only one restore
 * may wait at a time.
 */
public class RestoreLifecycleService {

    private final JdbcTemplate jdbc;
    private final TransactionTemplate tx;
    private final LedgerService ledger;
    private final DatabaseSwap swap;

    public RestoreLifecycleService(JdbcTemplate jdbc, TransactionTemplate tx, LedgerService ledger, DatabaseSwap swap) {
        this.jdbc = jdbc;
        this.tx = tx;
        this.ledger = ledger;
        this.swap = swap;
    }

    /** A new restore may start only when none waits for finalization. */
    public void assertNoPending() {
        Integer n = jdbc.queryForObject("select count(*) from restore_outcome where status = 'PENDING_FINALIZATION'", Integer.class);
        if (n != null && n > 0) {
            throw ExportException.conflict("RESTORE_PENDING_FINALIZATION", "The previous restore has not been finalized or rolled back yet");
        }
    }

    /** Records a restore that has been swapped in and is now waiting. */
    public void recordSwapped(String runCode, String backupNumber, String live, String tag, String by, String signatureRef) {
        recordSwapped(runCode, backupNumber, live, tag, by, signatureRef, "DATABASE");
    }

    /** Records a restore that has been swapped in and is now waiting, with the parts it covered. */
    public void recordSwapped(String runCode, String backupNumber, String live, String tag, String by, String signatureRef, String components) {
        String who = person(by);
        String sig = signature(signatureRef);
        try {
            jdbc.update("insert into restore_outcome(run_code, backup_number, live_db, tag, kept_old_db, status, restored_by, restore_signature, components) "
                    + "values (?,?,?,?,?, 'PENDING_FINALIZATION', ?, ?, ?)", runCode, backupNumber, live, tag, DatabaseSwap.preName(live, tag), who, sig, components);
        } catch (DuplicateKeyException e) {
            throw ExportException.conflict("RESTORE_PENDING_FINALIZATION", "Another restore is waiting for finalization");
        }
        ledger.append(who, "RESTORE_AWAITING_FINALIZATION", backupNumber, Map.of("runCode", runCode, "signature", sig));
    }

    /**
     * Records a restore of the files alone. No database was swapped, so there is nothing to roll back and nothing to finalize: the restore
     * is recorded as FINALIZED at once, by the person who did it, with their signature. Files are only added, so it needs no waiting period.
     */
    public void recordFilesOnly(String runCode, String backupNumber, String live, String by, String signatureRef) {
        String who = person(by);
        String sig = signature(signatureRef);
        jdbc.update("insert into restore_outcome(run_code, backup_number, live_db, tag, kept_old_db, status, restored_by, restore_signature, closed_by, close_signature, closed_at, components) "
                + "values (?,?,?,?,?, 'FINALIZED', ?, ?, ?, ?, now(), 'OBJECT_STORE')", runCode, backupNumber, live, "files", "-", who, sig, who, sig);
        ledger.append(who, "RESTORE_FILES_ADDED", backupNumber, Map.of("runCode", runCode, "signature", sig));
    }

    /** Closes the restore: the kept old database stays on the server, but the restore can no longer be rolled back. */
    public void finalizeRestore(String runCode, String by, String signatureRef) {
        String who = person(by);
        String sig = signature(signatureRef);
        String backup = tx.execute(s -> {
            Map<String, Object> row = lockPending(runCode);
            jdbc.update("update restore_outcome set status = 'FINALIZED', closed_by = ?, close_signature = ?, closed_at = now() where run_code = ?", who, sig, runCode);
            return (String) row.get("backup_number");
        });
        ledger.append(who, "RESTORE_FINALIZED", backup, Map.of("runCode", runCode, "signature", sig));
    }

    /** Rolls the restore back: the kept old database becomes live again, the restored one is kept as the post-restore copy. */
    public void rollBack(String runCode, String by, String signatureRef) {
        String who = person(by);
        String sig = signature(signatureRef);
        String backup = tx.execute(s -> {
            Map<String, Object> row = lockPending(runCode);
            try {
                swap.rollBack((String) row.get("live_db"), (String) row.get("tag"));
            } catch (SQLException e) {
                throw ExportException.conflict("RESTORE_ROLLBACK_FAILED", "The rollback could not be done: " + e.getMessage());
            }
            jdbc.update("update restore_outcome set status = 'ROLLED_BACK', closed_by = ?, close_signature = ?, closed_at = now(), post_db = ? where run_code = ?",
                    who, sig, DatabaseSwap.postName((String) row.get("live_db"), (String) row.get("tag")), runCode);
            return (String) row.get("backup_number");
        });
        ledger.append(who, "RESTORE_ROLLED_BACK_BY_PERSON", backup, Map.of("runCode", runCode, "signature", sig));
    }

    /** The row, locked for this transaction, so a rollback and a finalize cannot both succeed. */
    private Map<String, Object> lockPending(String runCode) {
        List<Map<String, Object>> rows = jdbc.queryForList("select run_code, backup_number, live_db, tag, status from restore_outcome where run_code = ? for update", runCode);
        if (rows.isEmpty()) throw ExportException.notFound("RESTORE_OUTCOME_NOT_FOUND", "There is no restore " + runCode);
        Map<String, Object> row = rows.get(0);
        if (!"PENDING_FINALIZATION".equals(row.get("status"))) {
            throw ExportException.conflict("RESTORE_ALREADY_CLOSED", "The restore " + runCode + " is already " + row.get("status"));
        }
        return row;
    }

    private static String person(String by) {
        if (by == null || by.isBlank()) throw ExportException.invalid("PERSON_REQUIRED", "Who is acting must be known");
        return by.trim();
    }

    private static String signature(String ref) {
        if (ref == null || ref.isBlank()) throw ExportException.invalid("SIGNATURE_REQUIRED", "An electronic signature is required");
        return ref.trim();
    }
}
