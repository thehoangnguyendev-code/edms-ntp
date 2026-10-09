package com.eqms.backup.agent.job;

import com.eqms.backup.agent.backup.BackupRepository;
import com.eqms.backup.agent.backup.DatabaseBackupService;
import com.eqms.backup.agent.config.AgentProperties;
import com.eqms.backup.agent.export.ExportService;
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

    public BackupJobWorker(JobQueue queue, DatabaseBackupService backups, VerificationService verification, LedgerService ledger,
                           BackupRepository repository, AgentProperties properties, ExportService exports) {
        this.exports = exports;
        this.queue = queue;
        this.backups = backups;
        this.verification = verification;
        this.ledger = ledger;
        this.repository = repository;
        this.properties = properties;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onStart() {
        for (Map<String, Object> stale : repository.failStaleRunning(Instant.now())) {
            String backupId = (String) stale.get("backup_id");
            ledger.append("agent", "BACKUP_FAILED", backupId, Map.of("code", "AGENT_RESTARTED"));
            repository.insertAlert("HIGH", "AGENT_RESTARTED", "The agent stopped while backup " + backupId + " was running", backupId);
        }
        ledger.append("agent", "AGENT_STARTED", null, Map.of("environment", properties.getEnvironment().toUpperCase(), "version", "0.0.1"));
        checkLedger();
    }

    @Scheduled(fixedDelayString = "${agent.poll-millis:5000}", initialDelayString = "${agent.poll-millis:5000}")
    public void poll() {
        Optional<JobQueue.Job> job = queue.claimNext(120);
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
                    result.put("backupId", o.backupId());
                    result.put("errorCode", o.errorCode());
                    result.put("verification", o.verification() == null ? null : o.verification().result());
                }
                case "VERIFY" -> {
                    VerificationService.Outcome o = verification.verifyV1(payload.path("backupId").asText(), j.requestedBy());
                    ok = o.verified();
                    result.put("backupId", o.backupId());
                    result.put("verification", o.result());
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

    /** Daily and at start-up: the chain must still be intact. A broken chain is the most serious alert the agent can raise. */
    @Scheduled(cron = "0 0 6 * * *", zone = "${agent.zone:Asia/Ho_Chi_Minh}")
    public void checkLedger() {
        LedgerService.Verification v = ledger.verify();
        if (v.ok()) return;
        repository.insertAlert("CRITICAL", "LEDGER_CHAIN_BROKEN", v.reason(), v.firstBrokenSeq() == null ? null : String.valueOf(v.firstBrokenSeq()));
        log.error("LEDGER CHAIN BROKEN: {}", v.reason());
    }
}
