package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.service.report.ReportOverviewService;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** The Reports Overview, the pinned reports and Quality Analytics (REPORT-OVERVIEW-2026-11-12). Read-only except for a person's own pins. */
@RestController
@RequestMapping("/reports")
public class ReportOverviewController {
    private final ReportOverviewService overview;
    private final CurrentUserService users;

    public ReportOverviewController(ReportOverviewService overview, CurrentUserService users) {
        this.overview = overview;
        this.users = users;
    }

    @GetMapping("/overview")
    public ResponseEntity<Map<String, Object>> overview() { return ResponseEntity.ok(overview.overview(users.requireCurrentUser())); }

    @GetMapping("/pins")
    public ResponseEntity<List<Map<String, Object>>> pins() { return ResponseEntity.ok(overview.pins(users.requireCurrentUser())); }

    @PutMapping("/pins/{code}")
    public ResponseEntity<Void> pin(@PathVariable String code) {
        overview.pin(users.requireCurrentUser(), code);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/pins/{code}")
    public ResponseEntity<Void> unpin(@PathVariable String code) {
        overview.unpin(users.requireCurrentUser(), code);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/analytics/documents")
    public ResponseEntity<Map<String, Object>> documents() { return ResponseEntity.ok(overview.documentControl(users.requireCurrentUser())); }

    @GetMapping("/analytics/training")
    public ResponseEntity<Map<String, Object>> training() { return ResponseEntity.ok(overview.training(users.requireCurrentUser())); }

    @GetMapping("/analytics/usage")
    public ResponseEntity<Map<String, Object>> usage() { return ResponseEntity.ok(overview.usage(users.requireCurrentUser())); }
}
