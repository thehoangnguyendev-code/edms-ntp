package com.eqms.backup.agent.api;

import com.eqms.backup.agent.config.AgentProperties;
import com.eqms.backup.agent.copy.ManualCopyService;
import com.eqms.backup.agent.export.ExportException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Map;

/** The copy a person makes by hand: what the policy asks for, and the records of the copies made. The backend has checked the person and the permission. */
@RestController
@RequestMapping("/internal/manual-copies")
public class InternalManualCopyController {

    public record RecordRequest(String copiedOn, String backupNumber, String place, String madeBy, String note, String by) {
    }

    private final ManualCopyService copies;
    private final AgentProperties properties;

    public InternalManualCopyController(ManualCopyService copies, AgentProperties properties) {
        this.copies = copies;
        this.properties = properties;
    }

    @GetMapping("/status")
    public Map<String, Object> status() {
        return copies.status(LocalDate.now(ZoneId.of(properties.getZone())));
    }

    @GetMapping
    public Map<String, Object> list(@RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit) {
        return copies.page(page, limit);
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> record(@RequestBody RecordRequest r) {
        LocalDate day;
        try {
            day = r.copiedOn() == null || r.copiedOn().isBlank() ? null : LocalDate.parse(r.copiedOn().trim());
        } catch (java.time.format.DateTimeParseException e) {
            throw ExportException.invalid("MANUAL_COPY_DATE_INVALID", "The day must be written as yyyy-mm-dd");
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(copies.record(day, r.backupNumber(), r.place(), r.madeBy(), r.note(), r.by(), ZoneId.of(properties.getZone())));
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
