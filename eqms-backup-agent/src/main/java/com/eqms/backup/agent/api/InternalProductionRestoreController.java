package com.eqms.backup.agent.api;

import com.eqms.backup.agent.export.ExportException;
import com.eqms.backup.agent.job.JobQueue;
import com.eqms.backup.agent.ledger.CanonicalJson;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * The restore into production (SDS-BR-003). Every action is queued for the restore worker, which holds the key ring and the swap role.
 * The eQMS backend has already checked the person's permission and verified their electronic signature; the agent records the
 * signature reference and refuses a request without one.
 */
@RestController
@RequestMapping("/internal/restores/production")
public class InternalProductionRestoreController {

    public record RestoreRequest(String backupNumber, String by, String signatureRef, java.util.List<String> components) {
    }

    public record ActionRequest(String by, String signatureRef) {
    }

    private final JobQueue queue;
    private final JdbcTemplate jdbc;

    public InternalProductionRestoreController(JobQueue queue, JdbcTemplate jdbc) {
        this.queue = queue;
        this.jdbc = jdbc;
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> restore(@RequestBody RestoreRequest r) {
        if (r.backupNumber() == null || r.backupNumber().isBlank()) throw ExportException.invalid("BACKUP_REQUIRED", "The backup is required");
        require(r.by(), r.signatureRef());
        Integer pending = jdbc.queryForObject("select count(*) from restore_outcome where status = 'PENDING_FINALIZATION'", Integer.class);
        if (pending != null && pending > 0) {
            throw ExportException.conflict("RESTORE_PENDING_FINALIZATION", "The previous restore has not been finalized or rolled back yet");
        }
        Map<String, Object> payload = new java.util.LinkedHashMap<>();
        payload.put("backupNumber", r.backupNumber().trim());
        payload.put("by", r.by().trim());
        payload.put("signatureRef", r.signatureRef().trim());
        if (r.components() != null) {
            if (r.components().isEmpty()) throw ExportException.invalid("RESTORE_PARTS_REQUIRED", "Choose what to restore");
            if (!com.eqms.backup.agent.restore.ProductionRestore.PARTS.containsAll(r.components())) throw ExportException.invalid("RESTORE_PART_UNKNOWN", "Unknown part of a restore");
            payload.put("components", r.components().stream().distinct().sorted().toList());
        }
        return queued("RESTORE_PRODUCTION", payload, r.by());
    }

    @PostMapping("/{runCode}/finalize")
    public ResponseEntity<Map<String, Object>> finalizeRestore(@PathVariable String runCode, @RequestBody ActionRequest r) {
        require(r.by(), r.signatureRef());
        return queued("RESTORE_FINALIZE", Map.of("runCode", runCode, "by", r.by().trim(), "signatureRef", r.signatureRef().trim()), r.by());
    }

    @PostMapping("/{runCode}/rollback")
    public ResponseEntity<Map<String, Object>> rollBack(@PathVariable String runCode, @RequestBody ActionRequest r) {
        require(r.by(), r.signatureRef());
        return queued("RESTORE_ROLLBACK", Map.of("runCode", runCode, "by", r.by().trim(), "signatureRef", r.signatureRef().trim()), r.by());
    }

    /** The restores that reached the swap, newest first, with who restored and who closed them. */
    private static final Map<String, String> SORTS = Map.of("restoredAt", "restored_at", "backupNumber", "backup_number", "status", "status",
            "restoredBy", "restored_by", "closedAt", "closed_at", "closedBy", "closed_by", "components", "components");

    private static java.sql.Timestamp instant(String value, String name) {
        if (value == null || value.isBlank()) return null;
        try {
            return java.sql.Timestamp.from(java.time.Instant.parse(value.trim()));
        } catch (java.time.format.DateTimeParseException e) {
            throw com.eqms.backup.agent.export.ExportException.invalid("RESTORE_DATE", "The " + name + " date is not a valid instant");
        }
    }

    /** One page of the restores that reached the swap, with search, status filter and sort done here. */
    @GetMapping
    public Map<String, Object> outcomes(@RequestParam(required = false) String search, @RequestParam(required = false) String status,
                                        @RequestParam(required = false) String part, @RequestParam(required = false) String restoredFrom,
                                        @RequestParam(required = false) String restoredTo, @RequestParam(required = false) String closedFrom,
                                        @RequestParam(required = false) String closedTo,
                                        @RequestParam(defaultValue = "restoredAt") String sortBy, @RequestParam(defaultValue = "desc") String sortDirection,
                                        @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit,
                                        @RequestParam(required = false) String people) {
        int size = Math.min(Math.max(limit, 1), 100);
        StringBuilder where = new StringBuilder(" where true");
        List<Object> args = new java.util.ArrayList<>();
        if (search != null && !search.isBlank()) {
            new SearchClause(search)
                    .text("lower(run_code)").text("lower(backup_number)").text("lower(restored_by)").text("lower(coalesce(closed_by, ''))")
                    .label("status = 'PENDING_FINALIZATION'", "waiting to finalize").label("status = 'FINALIZED'", "finalized").label("status = 'ROLLED_BACK'", "rolled back")
                    .label("coalesce(components, 'DATABASE') like '%DATABASE%'", "database").label("coalesce(components, 'DATABASE') like '%OBJECT_STORE%'", "files")
                    .date("restored_at").date("closed_at")
                    .people(SearchClause.split(people), "restored_by", "closed_by")
                    .appendTo(where, args);
        }
        if (status != null && !status.isBlank()) {
            where.append(" and status = ?");
            args.add(status.trim());
        }
        if (part != null && !part.isBlank()) {
            String p = part.trim().toUpperCase();
            if (!p.equals("DATABASE") && !p.equals("OBJECT_STORE")) throw com.eqms.backup.agent.export.ExportException.invalid("RESTORE_PART_UNKNOWN", "The part must be DATABASE or OBJECT_STORE");
            // a restore recorded before the parts were kept restored the database
            where.append(" and coalesce(components, 'DATABASE') like ?");
            args.add("%" + p + "%");
        }
        for (Object[] range : new Object[][] {{"restored_at", instant(restoredFrom, "restored from"), ">="}, {"restored_at", instant(restoredTo, "restored to"), "<="},
                {"closed_at", instant(closedFrom, "closed from"), ">="}, {"closed_at", instant(closedTo, "closed to"), "<="}}) {
            if (range[1] != null) {
                where.append(" and ").append(range[0]).append(" ").append(range[2]).append(" ?");
                args.add(range[1]);
            }
        }
        Long total = jdbc.queryForObject("select count(*) from restore_outcome" + where, Long.class, args.toArray());
        long count = total == null ? 0 : total;
        int pages = Math.max(1, (int) Math.ceil(count / (double) size));
        int current = Math.min(Math.max(page, 1), pages);
        String column = SORTS.getOrDefault(sortBy, "restored_at");
        String direction = "asc".equalsIgnoreCase(sortDirection) ? "asc" : "desc";
        List<Object> pageArgs = new java.util.ArrayList<>(args);
        pageArgs.add(size);
        pageArgs.add((current - 1) * size);
        List<Map<String, Object>> data = new java.util.ArrayList<>();
        for (Map<String, Object> row : jdbc.queryForList("select run_code, backup_number, status, restored_by, restore_signature, restored_at, closed_by, close_signature, closed_at, kept_old_db, post_db, components "
                + "from restore_outcome" + where + " order by " + column + " " + direction + " nulls last, id limit ? offset ?", pageArgs.toArray())) {
            Map<String, Object> m = new LinkedHashMap<>();
            row.forEach((k, v) -> m.put(k, v == null ? null : String.valueOf(v)));
            data.add(m);
        }
        Map<String, Object> pagination = new LinkedHashMap<>();
        pagination.put("page", current);
        pagination.put("limit", size);
        pagination.put("total", count);
        pagination.put("totalPages", pages);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("data", data);
        out.put("pagination", pagination);
        return out;
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

    private ResponseEntity<Map<String, Object>> queued(String type, Map<String, Object> payload, String by) {
        UUID job = queue.enqueue(type, CanonicalJson.of(payload), by.trim());
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(Map.of("jobId", job.toString(), "status", "QUEUED"));
    }

    private static void require(String by, String signatureRef) {
        if (by == null || by.isBlank()) throw ExportException.invalid("PERSON_REQUIRED", "Who is acting must be known");
        if (signatureRef == null || signatureRef.isBlank()) throw ExportException.invalid("SIGNATURE_REQUIRED", "An electronic signature is required");
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
