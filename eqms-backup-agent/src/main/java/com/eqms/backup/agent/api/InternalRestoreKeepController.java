package com.eqms.backup.agent.api;

import com.eqms.backup.agent.export.ExportException;
import com.eqms.backup.agent.job.JobQueue;
import com.eqms.backup.agent.ledger.CanonicalJson;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

/** A restore that keeps its database (SDS 11.3). The request is queued for the restore worker; the result is read back from the job. */
@RestController
@RequestMapping("/internal/restores/keep")
public class InternalRestoreKeepController {

    public record KeepRequest(String backupNumber, String by) {
    }

    private final JobQueue queue;

    public InternalRestoreKeepController(JobQueue queue) {
        this.queue = queue;
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> ask(@RequestBody KeepRequest r) {
        if (r.backupNumber() == null || r.backupNumber().isBlank()) throw ExportException.invalid("BACKUP_REQUIRED", "The backup is required");
        if (r.by() == null || r.by().isBlank()) throw ExportException.invalid("PERSON_REQUIRED", "Who is asking must be known");
        UUID job = queue.enqueue("RESTORE_KEEP", CanonicalJson.of(Map.of("backupNumber", r.backupNumber().trim(), "by", r.by().trim())), r.by().trim());
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(Map.of("jobId", job.toString(), "status", "QUEUED"));
    }

    @GetMapping("/jobs/{jobId}")
    public Map<String, Object> job(@PathVariable String jobId) {
        UUID id;
        try {
            id = UUID.fromString(jobId);
        } catch (IllegalArgumentException e) {
            throw ExportException.notFound("JOB_NOT_FOUND", "There is no job " + jobId);
        }
        return queue.find(id).orElseThrow(() -> ExportException.notFound("JOB_NOT_FOUND", "There is no job " + jobId));
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
