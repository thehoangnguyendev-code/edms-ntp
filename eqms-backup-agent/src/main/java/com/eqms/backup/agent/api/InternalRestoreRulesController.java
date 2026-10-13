package com.eqms.backup.agent.api;

import com.eqms.backup.agent.export.ExportException;
import com.eqms.backup.agent.restore.RestoreRules;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/** The owner-changeable restore rules (SDS 14.1). The backend requires the electronic signature before a change reaches this. */
@RestController
@RequestMapping("/internal")
public class InternalRestoreRulesController {

    public record ChangeRequest(int value, String by, String reason, String signatureRef) {
    }

    private final RestoreRules rules;

    public InternalRestoreRulesController(RestoreRules rules) {
        this.rules = rules;
    }

    @GetMapping("/restore-rules")
    public List<Map<String, Object>> list() {
        return rules.all();
    }

    @PostMapping("/restore-rules/{code}")
    public Map<String, Object> change(@PathVariable String code, @RequestBody ChangeRequest r) {
        return rules.change(code, r.value(), r.by(), r.reason(), r.signatureRef());
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
