package com.eqms.backup.agent.api;

import com.eqms.backup.agent.ledger.LedgerService;
import com.eqms.backup.agent.target.BackupTarget;
import com.eqms.backup.agent.target.TargetCatalog;
import com.eqms.backup.agent.target.TargetTester;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** The places backups are copied to, and the self-test that proves each one works (SDS sections 8 and 23.4). */
@RestController
@RequestMapping("/internal/targets")
public class InternalTargetController {

    public record TestRequest(String requestedBy) {
    }

    private final TargetCatalog catalog;
    private final TargetTester tester;
    private final LedgerService ledger;

    public InternalTargetController(TargetCatalog catalog, TargetTester tester, LedgerService ledger) {
        this.catalog = catalog;
        this.tester = tester;
        this.ledger = ledger;
    }

    @GetMapping
    public List<Map<String, Object>> list() {
        List<Map<String, Object>> out = new ArrayList<>();
        for (BackupTarget target : catalog.all()) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("code", target.code());
            row.put("kind", target.kind());
            row.put("immutable", target.immutable());
            row.put("location", target.describe(""));
            out.add(row);
        }
        return out;
    }

    @PostMapping("/{code}/test")
    public ResponseEntity<Object> test(@PathVariable String code, @RequestBody(required = false) TestRequest request) {
        String wanted = code.toUpperCase(Locale.ROOT);
        BackupTarget target = catalog.find(wanted).orElse(null);
        if (target == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Unknown target " + code));
        TargetTester.Result result = tester.test(target);
        String by = request == null || request.requestedBy() == null || request.requestedBy().isBlank() ? "unknown" : request.requestedBy();
        ledger.append(by, "TARGET_TESTED", target.code(), Map.of("ok", result.ok(), "steps", result.steps().stream().map(s -> s.name() + ":" + (s.ok() ? "ok" : "fail")).toList()));
        return ResponseEntity.ok(result);
    }
}
