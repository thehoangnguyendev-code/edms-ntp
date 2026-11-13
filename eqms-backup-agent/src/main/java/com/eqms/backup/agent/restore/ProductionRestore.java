package com.eqms.backup.agent.restore;

import com.eqms.backup.agent.export.ExportException;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.EnumMap;
import java.util.UUID;

import com.eqms.backup.agent.restore.RestoreRunEngine.Step;

/**
 * Puts the pieces of SDS-BR-003 together: R5 gate, R6/R7 restore into a kept database and check it, R8 add missing files,
 * R9 confirm the old database can be kept, R10 swap, R11 check the live database, R12 record the restore as waiting for finalization.
 * The work of each stage that needs keys or storage is supplied through {@link Stages}; the order, the stop rules and the rollback
 * are the same however they are supplied. The signature reference is verified by the caller before this is called.
 */
public class ProductionRestore {

    /** Stage work that depends on the environment. Each method throws to refuse. */
    public interface Stages {
        /** R5: the system is locked for this restore and nothing else holds it. */
        void assertGate(String restoreNumber) throws Exception;

        /** R6 and R7: restores the backup into a new database, checks it, and returns its name. */
        String restoreToKeptDatabase(String backupNumber, String by) throws Exception;

        /** R8: adds every file of the backup that the file store lacks, with its alias in {@code restoredDatabase} (the live database when null). */
        Map<String, Object> addMissingFiles(String backupNumber, String restoredDatabase) throws Exception;

        /** R11: checks the live database after the swap; throws if a required check fails. */
        Map<String, Object> checkLive(String backupNumber) throws Exception;

        /** Drops the restored database of a run that failed before the swap, so no unused copy stays on the server. */
        void discardKept(String database) throws Exception;
    }

    private final RestoreRunEngine engine;
    private final DatabaseSwap swap;
    private final RestoreLifecycleService lifecycle;
    private final Stages stages;
    private final String liveDb;
    private final RestoreRunEngine.Alerter alerter;

    public ProductionRestore(RestoreRunEngine engine, DatabaseSwap swap, RestoreLifecycleService lifecycle, Stages stages, String liveDb,
                             RestoreRunEngine.Alerter alerter) {
        this.engine = engine;
        this.swap = swap;
        this.lifecycle = lifecycle;
        this.stages = stages;
        this.liveDb = liveDb;
        this.alerter = alerter;
    }

    public static final java.util.Set<String> PARTS = java.util.Set.of("DATABASE", "OBJECT_STORE");

    /** What a restore without a choice covers: the database and the files. */
    public RestoreRunEngine.Outcome run(String backupNumber, String by, String signatureRef) {
        return run(backupNumber, by, signatureRef, java.util.Set.of("DATABASE", "OBJECT_STORE"));
    }

    /**
     * Restores the chosen parts. DATABASE replaces the live database (the system settings are part of it). OBJECT_STORE adds the files the
     * store lacks, after the database swap or, alone, to the live system. A separate settings part no longer exists and is refused.
     */
    public RestoreRunEngine.Outcome run(String backupNumber, String by, String signatureRef, java.util.Set<String> parts) {
        if (parts == null || parts.isEmpty()) throw ExportException.invalid("RESTORE_PARTS_REQUIRED", "Choose what to restore");
        if (parts.contains("CONFIGURATION")) {
            throw ExportException.invalid("RESTORE_SETTINGS_PART_REMOVED", "The system settings are part of the database; restore the database to restore them");
        }
        if (!PARTS.containsAll(parts)) throw ExportException.invalid("RESTORE_PART_UNKNOWN", "Unknown part of a restore");
        boolean database = parts.contains("DATABASE");
        boolean files = parts.contains("OBJECT_STORE");
        String partsText = String.join(",", parts.stream().sorted().toList());
        if (by == null || by.isBlank()) throw ExportException.invalid("PERSON_REQUIRED", "Who is restoring must be known");
        if (signatureRef == null || signatureRef.isBlank()) throw ExportException.invalid("SIGNATURE_REQUIRED", "An electronic signature is required to restore");
        String restoreNumber = "RS-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        String tag = restoreNumber.substring(3).toLowerCase();
        String[] kept = new String[1];

        Map<Step, RestoreRunEngine.Action> actions = new EnumMap<>(Step.class);
        actions.put(Step.R5, () -> {
            lifecycle.assertNoPending();
            stages.assertGate(restoreNumber);
            return Map.of("gate", "open");
        });
        actions.put(Step.R6, () -> {
            if (!database) return Map.of("skipped", "the database is not restored");
            kept[0] = stages.restoreToKeptDatabase(backupNumber, by);
            return Map.of("keptDatabase", kept[0]);
        });
        actions.put(Step.R7, () -> Map.of("checked", database ? "required checks passed while restoring" : "nothing to check: the database is not restored"));
        actions.put(Step.R8, () -> files ? stages.addMissingFiles(backupNumber, kept[0]) : Map.of("skipped", "the files are not restored"));
        actions.put(Step.R9, () -> {
            if (!database) return Map.of("skipped", "no database is swapped");
            if (swap.isSwapped(liveDb, tag)) throw new RestoreRunEngine.StepFailure("RESTORE_KEEP_NAME_TAKEN", "The name for the kept database is already used");
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("oldDatabaseWillBeKeptAs", DatabaseSwap.preName(liveDb, tag));
            return out;
        });
        actions.put(Step.R10, () -> database ? RestoreSwapActions.swap(swap, liveDb, kept[0], tag).run() : Map.of("skipped", "no database is swapped"));
        actions.put(Step.R11, () -> database ? stages.checkLive(backupNumber) : Map.of("skipped", "the live database was not changed"));
        actions.put(Step.R12, () -> {
            if (!database) {
                lifecycle.recordFilesOnly(restoreNumber, backupNumber, liveDb, by, signatureRef);
                return Map.of("status", "FINALIZED");
            }
            lifecycle.recordSwapped(restoreNumber, backupNumber, liveDb, tag, by, signatureRef, partsText);
            return Map.of("status", "PENDING_FINALIZATION");
        });
        RestoreRunEngine.Action rollback = database ? RestoreSwapActions.rollback(swap, liveDb, tag) : () -> Map.of("note", "nothing was swapped");
        RestoreRunEngine.Outcome outcome = engine.run(restoreNumber, backupNumber, by, actions, rollback);
        if (!outcome.completed() && kept[0] != null) {
            try {
                // a database that was swapped in and rolled back is kept as evidence; one that never reached the swap is not needed
                if (!swap.isSwapped(liveDb, tag)) stages.discardKept(kept[0]);
            } catch (Exception e) {
                alerter.raise("RESTORE_KEPT_NOT_DROPPED", "The restored database " + kept[0] + " of a failed restore is still on the server and must be dropped", restoreNumber);
            }
        }
        return outcome;
    }
}
