package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.service.report.ReportTypeService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** The sources of report data, in Report Administration (REPORT-PLATFORM-2026-10-15). */
@RestController
@RequestMapping("/reports/types")
public class ReportTypeController {
    private final ReportTypeService types;
    private final CurrentUserService users;
    public ReportTypeController(ReportTypeService types, CurrentUserService users) { this.types = types; this.users = users; }

    public record EnabledRequest(int version, boolean enabled, String reason) {}

    @GetMapping
    public ResponseEntity<?> list(@RequestParam(defaultValue = "ALL") String status, @RequestParam(defaultValue = "") String category,
                                  @RequestParam(defaultValue = "") String search, @RequestParam(defaultValue = "name") String sortBy,
                                  @RequestParam(defaultValue = "asc") String sortDirection, @RequestParam(defaultValue = "1") int page,
                                  @RequestParam(defaultValue = "10") int limit) {
        return ResponseEntity.ok(types.list(users.requireCurrentUser(), status, category, search, sortBy, sortDirection, page, limit));
    }

    @GetMapping("/{code}")
    public ResponseEntity<?> detail(@PathVariable String code) { return ResponseEntity.ok(types.detail(users.requireCurrentUser(), code)); }

    @PostMapping("/{code}/enabled")
    public ResponseEntity<?> setEnabled(@PathVariable String code, @RequestBody EnabledRequest request) {
        return ResponseEntity.ok(types.setEnabled(users.requireCurrentUser(), code, request.version(), request.enabled(), request.reason()));
    }
}
