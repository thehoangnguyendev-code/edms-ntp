package com.eqms.backup.agent.api;

import com.eqms.backup.agent.backup.BackupRepository;
import com.eqms.backup.agent.config.AgentProperties;
import com.eqms.backup.agent.job.JobQueue;
import com.eqms.backup.agent.ledger.CanonicalJson;
import com.eqms.backup.agent.ledger.LedgerService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * What the eQMS backend may ask of the agent. The backend has already checked who the person is and what they may do; the
 * agent trusts that only because the call carries the shared secret, and still validates every value it is given.
 */
@RestController
@RequestMapping("/internal")
public class InternalBackupController {

    public record CreateBackupRequest(String requestedBy, String reason, String changeControlRef, String type) {
    }

    public record VerifyRequest(String requestedBy) {
    }

    private final BackupQueryService queries;
    private final BackupRepository repository;
    private final JobQueue queue;
    private final LedgerService ledger;
    private final AgentProperties properties;
    private final com.eqms.backup.agent.job.BackupScheduler scheduler;
    private final org.springframework.jdbc.core.JdbcTemplate jdbc;
    private final ScheduleQueryService scheduleQueries;

    public InternalBackupController(BackupQueryService queries, BackupRepository repository, JobQueue queue, LedgerService ledger, AgentProperties properties,
                                    com.eqms.backup.agent.job.BackupScheduler scheduler, org.springframework.jdbc.core.JdbcTemplate jdbc,
                                    ScheduleQueryService scheduleQueries) {
        this.scheduleQueries = scheduleQueries;
        this.scheduler = scheduler;
        this.jdbc = jdbc;
        this.queries = queries;
        this.repository = repository;
        this.queue = queue;
        this.ledger = ledger;
        this.properties = properties;
    }

    @GetMapping("/overview")
    public Map<String, Object> overview() {
        Map<String, Object> out = queries.overview(properties.getEnvironment().toUpperCase());
        LedgerService.Verification v = ledger.verify();
        Map<String, Object> l = new LinkedHashMap<>();
        l.put("ok", v.ok());
        l.put("checked", v.checked());
        l.put("reason", v.reason());
        l.put("fileCopyCompared", v.fileCompared());
        out.put("ledger", l);
        return out;
    }

    @GetMapping("/backups")
    public Map<String, Object> list(@RequestParam(required = false) String search, @RequestParam(required = false) String status,
                                    @RequestParam(required = false) String type, @RequestParam(required = false) String verification,
                                    @RequestParam(required = false) String startedFrom, @RequestParam(required = false) String startedTo,
                                    @RequestParam(required = false) String checkedFrom, @RequestParam(required = false) String checkedTo,
                                    @RequestParam(defaultValue = "startedAt") String sortBy, @RequestParam(defaultValue = "desc") String sortDirection,
                                    @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit) {
        BackupQueryService.Page result = queries.list(new BackupQueryService.Query(search, status, type, verification, instant(startedFrom), instant(startedTo), instant(checkedFrom), instant(checkedTo), sortBy, "asc".equalsIgnoreCase(sortDirection), page, limit));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("data", result.data());
        Map<String, Object> pagination = new LinkedHashMap<>();
        pagination.put("page", result.page());
        pagination.put("limit", result.limit());
        pagination.put("total", result.total());
        pagination.put("totalPages", Math.max(1, (int) Math.ceil(result.total() / (double) result.limit())));
        out.put("pagination", pagination);
        return out;
    }

    @GetMapping("/backups/{backupId}")
    public ResponseEntity<Map<String, Object>> get(@PathVariable String backupId) {
        return queries.get(backupId).map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).build());
    }

    @PostMapping("/backups")
    public ResponseEntity<Map<String, Object>> create(@RequestBody CreateBackupRequest request) {
        if (blank(request.requestedBy()) || blank(request.reason())) {
            return ResponseEntity.badRequest().body(Map.of("code", "REASON_REQUIRED"));
        }
        String type = blank(request.type()) ? "FULL" : request.type();
        if (!java.util.Set.of("FULL", "PRE_CHANGE").contains(type)) {
            return ResponseEntity.badRequest().body(Map.of("code", "BACKUP_TYPE_NOT_ALLOWED"));
        }
        String trigger = "PRE_CHANGE".equals(type) ? "PRE_CHANGE" : "MANUAL";
        UUID job = queue.enqueue("BACKUP_DB", CanonicalJson.of(Map.of("type", type, "trigger", trigger, "reason", request.reason().trim(),
                "changeControlRef", request.changeControlRef() == null ? "" : request.changeControlRef().trim())), request.requestedBy());
        return ResponseEntity.accepted().body(Map.of("jobId", job.toString()));
    }

    @PostMapping("/backups/{backupId}/verify")
    public ResponseEntity<Map<String, Object>> verify(@PathVariable String backupId, @RequestBody VerifyRequest request) {
        if (blank(request.requestedBy())) return ResponseEntity.badRequest().body(Map.of("code", "REQUESTER_REQUIRED"));
        if (repository.runByBackupId(backupId).isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        UUID job = queue.enqueue("VERIFY", CanonicalJson.of(Map.of("backupId", backupId)), request.requestedBy());
        return ResponseEntity.accepted().body(Map.of("jobId", job.toString()));
    }

    @GetMapping("/jobs/{jobId}")
    public ResponseEntity<Map<String, Object>> job(@PathVariable UUID jobId) {
        return queue.find(jobId).map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).build());
    }

    @GetMapping("/schedules")
    public Map<String, Object> schedules() {
        Map<String, Object> policy = queries.activePolicy();
        if (policy == null) return Map.of();
        Map<String, Object> out = new LinkedHashMap<>(policy);
        java.time.Instant now = java.time.Instant.now();
        // the next moment is one day after the most recent due moment (the schedule is daily)
        out.put("nextDue", scheduler.lastDue(now).map(due -> due.plus(java.time.Duration.ofDays(1)).toString()).orElse(null));
        out.put("zone", properties.getZone());
        out.put("lastScheduledRun", jdbc.query("select backup_id, status, started_at from backup_run where trigger_kind = 'SCHEDULED' order by started_at desc limit 1",
                (rs, i) -> Map.of("backupId", rs.getString(1), "status", rs.getString(2), "startedAt", rs.getTimestamp(3).toInstant().toString())).stream().findFirst().orElse(null));
        return out;
    }

    @GetMapping("/schedules/rows")
    public Map<String, Object> scheduleRows(@RequestParam(required = false) String search, @RequestParam(required = false) String status,
                                            @RequestParam(required = false) String type, @RequestParam(required = false) String frequency,
                                            @RequestParam(defaultValue = "component") String sortBy, @RequestParam(defaultValue = "asc") String sortDirection,
                                            @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit) {
        return scheduleQueries.rows(search, status, type, frequency, sortBy, "asc".equalsIgnoreCase(sortDirection), page, limit);
    }

    @GetMapping("/ledger/verify")
    public Map<String, Object> verifyLedger() {
        LedgerService.Verification v = ledger.verify();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ok", v.ok());
        out.put("checked", v.checked());
        out.put("firstBrokenSeq", v.firstBrokenSeq());
        out.put("reason", v.reason());
        out.put("fileCopyCompared", v.fileCompared());
        return out;
    }

    /** A date filter that is not an ISO instant is a client error, not "no filter": silently ignoring it would show the wrong rows. */
    private static java.time.Instant instant(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return java.time.Instant.parse(value.trim());
        } catch (java.time.format.DateTimeParseException e) {
            throw new org.springframework.web.server.ResponseStatusException(HttpStatus.BAD_REQUEST, "INVALID_DATE");
        }
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }
}
