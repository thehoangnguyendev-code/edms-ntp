package com.eqms.backup.agent.api;

import com.eqms.backup.agent.export.ExportException;
import com.eqms.backup.agent.restore.RestoreRehearsalService;
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

import java.util.LinkedHashMap;
import java.util.Map;

/** Test restores of a backup into a scratch database. This process only queues them; the restore worker does the work. */
@RestController
@RequestMapping("/internal")
public class InternalRehearsalController {

    public record RehearsalRequest(String reason, String by) {
    }

    private final RestoreRehearsalService rehearsals;

    public InternalRehearsalController(RestoreRehearsalService rehearsals) {
        this.rehearsals = rehearsals;
    }

    @GetMapping("/rehearsals")
    public Map<String, Object> list(@RequestParam(required = false) String search, @RequestParam(required = false) String status, @RequestParam(required = false) String backupNumber,
                                    @RequestParam(defaultValue = "requestedAt") String sortBy, @RequestParam(defaultValue = "desc") String sortDirection,
                                    @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit) {
        RestoreRehearsalService.Page result = rehearsals.page(search, status, backupNumber, sortBy, "asc".equalsIgnoreCase(sortDirection), page, limit);
        Map<String, Object> pagination = new LinkedHashMap<>();
        pagination.put("page", result.page());
        pagination.put("limit", result.limit());
        pagination.put("total", result.total());
        pagination.put("totalPages", Math.max(1, (int) Math.ceil(result.total() / (double) result.limit())));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("data", result.data());
        out.put("pagination", pagination);
        return out;
    }

    @GetMapping("/rehearsals/{rehearsalId}")
    public Map<String, Object> get(@PathVariable String rehearsalId) {
        return rehearsals.get(rehearsalId);
    }

    @PostMapping("/backups/{backupNumber}/rehearsals")
    public ResponseEntity<Map<String, Object>> request(@PathVariable String backupNumber, @RequestBody RehearsalRequest r) {
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(rehearsals.request(backupNumber, r.by(), r.reason()));
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
