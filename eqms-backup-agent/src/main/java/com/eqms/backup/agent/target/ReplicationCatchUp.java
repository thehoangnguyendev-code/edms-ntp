package com.eqms.backup.agent.target;

import com.eqms.backup.agent.backup.BackupRepository;
import com.eqms.backup.agent.config.AgentProperties;
import com.eqms.backup.agent.policy.ActivePolicyProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/**
 * Keeps the copies on the extra targets (T2, the NAS) complete. A share can be off the network when a backup finishes; that copy is
 * then missing, and the three-copy rule is not met until it is made. Every few minutes the agent tests each target named by the
 * active policy and, once it answers, copies the verified backups it missed, newest first. An unreachable target raises one alert
 * when it goes away and none while it stays away: it is not silent, and it does not flood the alert list.
 *
 * <p>A network share that stops answering can block a read or write for a very long time. The test therefore runs on its own thread
 * with a time limit, so a hung mount cannot stop the agent's scheduler.
 */
@Component
public class ReplicationCatchUp {

    private static final Logger log = LoggerFactory.getLogger(ReplicationCatchUp.class);
    /** Backups older than this are not chased: a copy still missing after a month is a matter for the operator, not for a retry. */
    private static final Duration LOOK_BACK = Duration.ofDays(30);
    private static final int PER_TARGET_PER_PASS = 3;

    private final TargetCatalog catalog;
    private final TargetTester tester;
    private final ReplicationService replication;
    private final BackupRepository repository;
    private final ActivePolicyProvider policies;
    private final AgentProperties properties;
    private final ExecutorService probe = Executors.newCachedThreadPool(r -> {
        Thread thread = new Thread(r, "target-probe");
        thread.setDaemon(true);
        return thread;
    });
    /** The last known state of each target, so an alert is raised when a target goes away, not at every attempt. */
    private final Map<String, Boolean> reachable = new ConcurrentHashMap<>();
    private final long probeTimeoutSeconds;

    @Autowired
    public ReplicationCatchUp(TargetCatalog catalog, TargetTester tester, ReplicationService replication, BackupRepository repository,
                              ActivePolicyProvider policies, AgentProperties properties) {
        this(catalog, tester, replication, repository, policies, properties, 60);
    }

    public ReplicationCatchUp(TargetCatalog catalog, TargetTester tester, ReplicationService replication, BackupRepository repository,
                              ActivePolicyProvider policies, AgentProperties properties, long probeTimeoutSeconds) {
        this.catalog = catalog;
        this.tester = tester;
        this.replication = replication;
        this.repository = repository;
        this.policies = policies;
        this.properties = properties;
        this.probeTimeoutSeconds = probeTimeoutSeconds;
    }

    @Scheduled(fixedDelayString = "${agent.catch-up-millis:600000}", initialDelayString = "${agent.catch-up-initial-millis:120000}")
    public void tick() {
        if (properties.isRestoreWorker()) return;
        try {
            run(Instant.now());
        } catch (RuntimeException e) {
            log.warn("Copy catch-up failed", e);
        }
    }

    /** @return the number of copies made in this pass */
    public int run(Instant now) {
        var policy = policies.active().orElse(null);
        if (policy == null) return 0;
        int made = 0;
        for (String code : policy.targetCodes()) {
            if ("T1".equals(code)) continue;
            BackupTarget target = catalog.find(code).orElse(null);
            if (target == null) continue; // the backup run already alerted: in the policy but not configured on the agent
            if (!isReachable(target)) continue;
            made += copyMissing(target, now);
        }
        return made;
    }

    private boolean isReachable(BackupTarget target) {
        TargetTester.Result result = null;
        String detail;
        Future<TargetTester.Result> future = probe.submit(() -> tester.test(target));
        try {
            result = future.get(probeTimeoutSeconds, TimeUnit.SECONDS);
            detail = result.steps().stream().filter(s -> !s.ok()).map(s -> s.name() + ": " + s.detail()).findFirst().orElse("");
        } catch (TimeoutException e) {
            future.cancel(true);
            detail = "no answer within " + probeTimeoutSeconds + " seconds (the share may be off the network or hung)";
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        } catch (ExecutionException e) {
            detail = String.valueOf(e.getCause() == null ? e.getMessage() : e.getCause().getMessage());
        }
        boolean ok = result != null && result.ok();
        Boolean before = reachable.put(target.code(), ok);
        if (!ok && !Boolean.FALSE.equals(before)) {
            repository.insertAlert("HIGH", "TARGET_UNREACHABLE", "Backup target " + target.code() + " does not work: " + detail
                    + ". New backups stay on T1 only until it answers again; the missing copies are made automatically then.", target.code());
        }
        if (ok && Boolean.FALSE.equals(before)) log.info("Backup target {} answers again", target.code());
        return ok;
    }

    private int copyMissing(BackupTarget target, Instant now) {
        List<Map<String, Object>> missing = repository.runsMissingCopy(target.code(), now.minus(LOOK_BACK), PER_TARGET_PER_PASS);
        int made = 0;
        for (Map<String, Object> run : missing) {
            Path setDir = Path.of((String) run.get("t1_path"));
            // T1/<ENV>/<yyyy>/<MM>/<backup number>: on every target the key is the same path below T1
            Path envRoot = setDir.getParent().getParent().getParent();
            String keyPrefix = envRoot.getFileName() + "/" + envRoot.relativize(setDir.getParent()).toString().replace('\\', '/');
            ReplicationService.Outcome outcome = replication.catchUp((UUID) run.get("id"), (String) run.get("backup_number"), setDir, keyPrefix, envRoot, target);
            if (outcome.ok()) {
                made++;
            } else {
                log.warn("Late copy of {} to {} failed: {}", run.get("backup_number"), target.code(), outcome.detail());
                reachable.put(target.code(), false);
                break; // the target went away during the pass; the next pass tries again
            }
        }
        return made;
    }
}
