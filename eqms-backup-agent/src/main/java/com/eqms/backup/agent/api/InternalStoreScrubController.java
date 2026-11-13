package com.eqms.backup.agent.api;

import com.eqms.backup.agent.export.ExportException;
import com.eqms.backup.agent.job.JobQueue;
import com.eqms.backup.agent.objects.StoreScrubService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

/** The periodic check of the live file store: the list of its runs, the newest one, and starting one now. The backend has checked the person and the permission. */
@RestController
@RequestMapping("/internal/store-scrubs")
public class InternalStoreScrubController {

    public record StartRequest(String by) {
    }

    private final StoreScrubService scrub;
    private final JobQueue queue;
    private final org.springframework.jdbc.core.JdbcTemplate jdbc;

    public InternalStoreScrubController(StoreScrubService scrub, JobQueue queue, org.springframework.jdbc.core.JdbcTemplate jdbc) {
        this.scrub = scrub;
        this.queue = queue;
        this.jdbc = jdbc;
    }

    @GetMapping
    public Map<String, Object> list(@RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit) {
        return scrub.list(page, limit);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> detail(@PathVariable String id) {
        UUID uuid;
        try {
            uuid = UUID.fromString(id);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
        return scrub.detail(uuid).map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> start(@RequestBody StartRequest r) {
        if (r.by() == null || r.by().isBlank()) throw ExportException.invalid("PERSON_REQUIRED", "Who is starting the check must be known");
        if (!scrub.enabled()) throw ExportException.conflict("SCRUB_OBJECTS_NOT_CONFIGURED", "The document store is not configured on this agent");
        Integer open = jdbc.queryForObject("select count(*) from backup_job where job_type = 'SCRUB' and status in ('QUEUED','RUNNING')", Integer.class);
        if (open != null && open > 0) throw ExportException.conflict("SCRUB_ALREADY_RUNNING", "A check of the file store is already queued or running");
        UUID job = queue.enqueue("SCRUB", "{\"trigger\":\"MANUAL\"}", r.by().trim());
        return ResponseEntity.accepted().body(Map.of("jobId", job.toString()));
    }

    @ExceptionHandler(ExportException.class)
    public ResponseEntity<Map<String, Object>> refused(ExportException e) {
        HttpStatus status = switch (e.kind) {
            case NOT_FOUND -> HttpStatus.NOT_FOUND;
            case CONFLICT, SEPARATION -> HttpStatus.CONFLICT;
            case INVALID -> HttpStatus.BAD_REQUEST;
        };
        return ResponseEntity.status(status).body(Map.of("code", e.code, "message", e.getMessage()));
    }
}
