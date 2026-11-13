package com.eqms.backup.agent.job;

import com.eqms.backup.agent.backup.BackupRepository;
import com.eqms.backup.agent.backup.DatabaseBackupService;
import com.eqms.backup.agent.config.AgentProperties;
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
    private final RestoreRehearsalService rehearsals;
    private final com.eqms.backup.agent.restore.RestoreKeepService keeps;
    private final com.eqms.backup.agent.restore.ProductionRestoreService production;
    private final com.eqms.backup.agent.objects.StoreScrubService scrub;

    public BackupJobWorker(JobQueue queue, DatabaseBackupService backups, VerificationService verification, LedgerService ledger,
                           BackupRepository repository, AgentProperties properties, RestoreRehearsalService rehearsals,
                           com.eqms.backup.agent.restore.RestoreKeepService keeps,
                           com.eqms.backup.agent.restore.ProductionRestoreService production,
                           com.eqms.backup.agent.objects.StoreScrubService scrub) {
        this.scrub = scrub;
        this.keeps = keeps;
        this.production = production;
        this.rehearsals = rehearsals;
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
        Optional<JobQueue.Job> job = properties.isRestoreWorker() ? queue.claimNext(120, java.util.List.of("REHEARSAL", "RESTORE_KEEP", "RESTORE_PRODUCTION", "RESTORE_FINALIZE", "RESTORE_ROLLBACK")) : queue.claimNext(120);
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
                            payload.path("reason").asText(null), payload.path("changeControlRef").asText(null), components(payload)));
                    ok = o.ok();
                    result.put("backupNumber", o.backupNumber());
                    result.put("errorCode", o.errorCode());
                    result.put("verification", o.verification() == null ? null : o.verification().result());
                }
                case "VERIFY" -> {
                    int[] reported = {0};
                    java.util.List<Map<String, Object>> done = new java.util.ArrayList<>();
                    VerificationService.Outcome o = verification.verifyV1(payload.path("backupNumber").asText(), j.requestedBy(), percent -> {
                        if (percent > reported[0]) {
                            reported[0] = percent;
                            queue.reportProgress(j.id(), percent);
                        }
                    }, check -> {
                        done.add(Map.of("code", check.code(), "ok", check.ok(), "detail", check.detail() == null ? "" : check.detail()));
                        try {
                            queue.reportSteps(j.id(), new ObjectMapper().writeValueAsString(done));
                        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
                            // the list on the screen is a convenience; the check and its result do not depend on it
                        }
                    });
                    ok = o.verified();
                    result.put("backupNumber", o.backupNumber());
                    result.put("verification", o.result());
                    result.put("checks", o.checks().stream().map(c -> Map.of("code", c.code(), "ok", c.ok(), "detail", c.detail() == null ? "" : c.detail())).toList());
                }
                case "SCRUB" -> {
                    int[] reported = {0};
                    Map<String, Object> r = scrub.run(payload.path("trigger").asText("MANUAL"), j.requestedBy(), percent -> {
                        if (percent > reported[0]) {
                            reported[0] = percent;
                            queue.reportProgress(j.id(), percent);
                        }
                    });
                    ok = "COMPLETED".equals(r.get("status"));
                    result.put("scrubId", r.get("id"));
                    result.put("checkedFiles", r.get("checkedFiles"));
                    result.put("differentFiles", r.get("differentFiles"));
                    result.put("missingFiles", r.get("missingFiles"));
                    result.put("referenceDifferences", r.get("referenceDifferences"));
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
                case "RESTORE_PRODUCTION" -> {
                    var o = production.run(payload.path("backupNumber").asText(), payload.path("by").asText(), payload.path("signatureRef").asText(), components(payload));
                    ok = o.completed();
                    result.put("runCode", o.runCode());
                    result.put("failedStep", o.failedStep() == null ? null : o.failedStep().name());
                    result.put("errorCode", o.errorCode());
                    result.put("errorDetail", o.errorDetail());
                }
                case "RESTORE_FINALIZE" -> {
                    production.lifecycle().finalizeRestore(payload.path("runCode").asText(), payload.path("by").asText(), payload.path("signatureRef").asText());
                    ok = true;
                    result.put("runCode", payload.path("runCode").asText());
                    result.put("status", "FINALIZED");
                }
                case "RESTORE_ROLLBACK" -> {
                    production.lifecycle().rollBack(payload.path("runCode").asText(), payload.path("by").asText(), payload.path("signatureRef").asText());
                    ok = true;
                    result.put("runCode", payload.path("runCode").asText());
                    result.put("status", "ROLLED_BACK");
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
    /** The parts the person chose, or null when the payload names none (a scheduled backup). */
    private static java.util.Set<String> components(JsonNode payload) {
        if (!payload.has("components")) return null;
        java.util.Set<String> out = new java.util.LinkedHashSet<>();
        payload.path("components").forEach(n -> out.add(n.asText()));
        return out;
    }

    @Scheduled(cron = "0 0 6 * * *", zone = "${agent.zone:Asia/Ho_Chi_Minh}")
    public void checkLedger() {
        if (properties.isRestoreWorker()) return;
        LedgerService.Verification v = ledger.verify();
        if (v.ok()) return;
        repository.insertAlert("CRITICAL", "LEDGER_CHAIN_BROKEN", v.reason(), v.firstBrokenSeq() == null ? null : String.valueOf(v.firstBrokenSeq()));
        log.error("LEDGER CHAIN BROKEN: {}", v.reason());
    }
}
