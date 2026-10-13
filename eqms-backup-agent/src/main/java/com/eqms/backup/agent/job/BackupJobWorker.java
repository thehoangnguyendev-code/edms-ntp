package com.eqms.backup.agent.job;

import com.eqms.backup.agent.backup.BackupRepository;
import com.eqms.backup.agent.backup.DatabaseBackupService;
import com.eqms.backup.agent.config.AgentProperties;
import com.eqms.backup.agent.export.ExportService;
import com.eqms.backup.agent.restore.InspectionService;
import com.eqms.backup.agent.restore.RestoreRehearsalService;
import com.eqms.backup.agent.ledger.CanonicalJson;
import com.eqms.backup.agent.ledger.LedgerService;
import com.eqms.backup.agent.verify.VerificationService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

/** Runs the queued jobs one at a time, and keeps the agent's own house in order (stale runs, ledger check). */
@Component
public class BackupJobWorker {

    private static final Logger log = LoggerFactory.getLogger(BackupJobWorker.class);
    private static final ObjectMapper JSON = new ObjectMapper();

    private final JobQueue queue;
    private final DatabaseBackupService backups;
    private final VerificationService verification;
    private final LedgerService ledger;
    private final BackupRepository repository;
    private final AgentProperties properties;
    private final ExportService exports;
    private final RestoreRehearsalService rehearsals;
    private final InspectionService inspections;
    private final com.eqms.backup.agent.restore.RestoreKeepService keeps;

    public BackupJobWorker(JobQueue queue, DatabaseBackupService backups, VerificationService verification, LedgerService ledger,
                           BackupRepository repository, AgentProperties properties, ExportService exports, RestoreRehearsalService rehearsals,
                           InspectionService inspections, com.eqms.backup.agent.restore.RestoreKeepService keeps) {
        this.keeps = keeps;
        this.exports = exports;
        this.rehearsals = rehearsals;
        this.inspections = inspections;
        this.queue = queue;
        this.backups = backups;
        this.verification = verification;
        this.ledger = ledger;
        this.repository = repository;
        this.properties = properties;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onStart() {
        if (properties.isRestoreWorker()) {
            log.info("Restore worker started: it takes rehearsal and inspection jobs only");
            return;
        }
        for (Map<String, Object> stale : repository.failStaleRunning(Instant.now())) {
            String backupNumber = (String) stale.get("backup_number");
            ledger.append("agent", "BACKUP_FAILED", backupNumber, Map.of("code", "AGENT_RESTARTED"));
            repository.insertAlert("HIGH", "AGENT_RESTARTED", "The agent stopped while backup " + backupNumber + " was running", backupNumber);
        }
        ledger.append("agent", "AGENT_STARTED", null, Map.of("environment", properties.getEnvironment().toUpperCase(), "version", "0.0.1"));
        checkLedger();
    }

    @Scheduled(fixedDelayString = "${agent.poll-millis:5000}", initialDelayString = "${agent.poll-millis:5000}")
    public void poll() {
        Optional<JobQueue.Job> job = properties.isRestoreWorker() ? queue.claimNext(120, java.util.List.of("REHEARSAL", "INSPECTION", "RESTORE_KEEP")) : queue.claimNext(120);
        if (job.isEmpty()) return;
        JobQueue.Job j = job.get();
        try {
            JsonNode payload = JSON.readTree(j.payloadJson());
            Map<String, Object> result = new LinkedHashMap<>();
            boolean ok;
            switch (j.type()) {
                case "BACKUP_DB" -> {
                    DatabaseBackupService.Outcome o = backups.run(new DatabaseBackupService.Request(
                            payload.path("type").asText("FULL"), payload.path("trigger").asText("MANUAL"), j.requestedBy(),
                            payload.path("reason").asText(null), payload.path("changeControlRef").asText(null)));
                    ok = o.ok();
                    result.put("backupNumber", o.backupNumber());
                    result.put("errorCode", o.errorCode());
                    result.put("verification", o.verification() == null ? null : o.verification().result());
                }
                case "VERIFY" -> {
                    VerificationService.Outcome o = verification.verifyV1(payload.path("backupNumber").asText(), j.requestedBy());
                    ok = o.verified();
                    result.put("backupNumber", o.backupNumber());
                    result.put("verification", o.result());
                }
                case "REHEARSAL" -> {
                    Map<String, Object> r = rehearsals.run(payload.path("rehearsalId").asText());
                    ok = "PASSED".equals(r.get("status"));
                    result.put("rehearsalId", r.get("rehearsalId"));
                    result.put("status", r.get("status"));
                    result.put("errorCode", r.get("errorCode"));
                }
                case "RESTORE_KEEP" -> {
                    Map<String, Object> k = keeps.keep(payload.path("backupNumber").asText(), payload.path("by").asText());
                    ok = true;
                    result.put("keepCode", k.get("keepCode"));
                    result.put("database", k.get("database"));
                    result.put("checks", k.get("checks"));
                }
                case "INSPECTION" -> {
                    Map<String, Object> i = inspections.open(payload.path("inspectionNumber").asText());
                    ok = "OPEN".equals(i.get("status"));
                    result.put("inspectionNumber", i.get("inspectionNumber"));
                    result.put("status", i.get("status"));
                    result.put("errorCode", i.get("errorCode"));
                }
                case "EXPORT" -> {
                    Map<String, Object> export = exports.run(payload.path("exportId").asText(), j.requestedBy());
                    ok = "COMPLETED".equals(export.get("status"));
                    result.put("exportId", export.get("exportId"));
                    result.put("status", export.get("status"));
                    result.put("errorCode", export.get("errorCode"));
                }
                default -> {
                    ok = false;
                    result.put("errorCode", "UNKNOWN_JOB_TYPE");
                }
            }
            queue.finish(j.id(), ok, CanonicalJson.of(result));
        } catch (Exception e) {
            log.error("Job {} failed", j.id(), e);
            queue.finish(j.id(), false, CanonicalJson.of(Map.of("errorCode", "JOB_ERROR", "detail", String.valueOf(e.getMessage()))));
        }
    }

    /** Every few seconds on the restore worker: an inspection copy whose five minutes are over is dropped (SDS 7.2). */
    @Scheduled(fixedDelay = 15_000, initialDelay = 15_000)
    public void expireInspections() {
        // the agent that is not the restore worker cannot drop copies: it only warns when a copy is overdue
        if (!properties.isRestoreWorker()) {
            inspections.alertOverdue();
            return;
        }
        inspections.expireDue();
        inspections.retryUndropped();
    }

    /** Daily and at start-up: the chain must still be intact. A broken chain is the most serious alert the agent can raise. */
    @Scheduled(cron = "0 0 6 * * *", zone = "${agent.zone:Asia/Ho_Chi_Minh}")
    public void checkLedger() {
        if (properties.isRestoreWorker()) return;
        LedgerService.Verification v = ledger.verify();
        if (v.ok()) return;
        repository.insertAlert("CRITICAL", "LEDGER_CHAIN_BROKEN", v.reason(), v.firstBrokenSeq() == null ? null : String.valueOf(v.firstBrokenSeq()));
        log.error("LEDGER CHAIN BROKEN: {}", v.reason());
    }
}
