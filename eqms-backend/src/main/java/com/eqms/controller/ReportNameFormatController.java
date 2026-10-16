package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.service.report.ReportNameFormatService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/** Name rules for report templates, maintained in Report Administration (REPORT-NAME-FORMAT-2026-10-14). */
@RestController
@RequestMapping("/reports/name-formats")
public class ReportNameFormatController {
    private final ReportNameFormatService formats;
    private final CurrentUserService users;
    public ReportNameFormatController(ReportNameFormatService formats, CurrentUserService users) { this.formats = formats; this.users = users; }

    public record ActiveRequest(int version, boolean active, String reason) {}

    @GetMapping
    public ResponseEntity<?> list(@RequestParam(defaultValue = "ALL") String status, @RequestParam(defaultValue = "") String search,
                                  @RequestParam(defaultValue = "name") String sortBy, @RequestParam(defaultValue = "asc") String sortDirection,
                                  @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit,
                                  @RequestParam(defaultValue = "") String modifiedFrom, @RequestParam(defaultValue = "") String modifiedTo) {
        return ResponseEntity.ok(formats.list(users.requireCurrentUser(), status, search, sortBy, sortDirection, page, limit, modifiedFrom, modifiedTo));
    }
    @GetMapping("/{id}")
    public ResponseEntity<?> detail(@PathVariable UUID id) {
        return ResponseEntity.ok(formats.detail(users.requireCurrentUser(), id));
    }
    @PostMapping
    public ResponseEntity<?> create(@RequestBody ReportNameFormatService.FormatWrite request) {
        return ResponseEntity.status(201).body(formats.create(users.requireCurrentUser(), request));
    }
    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable UUID id, @RequestBody ReportNameFormatService.FormatWrite request) {
        return ResponseEntity.ok(formats.update(users.requireCurrentUser(), id, request));
    }
    @PostMapping("/{id}/active")
    public ResponseEntity<?> setActive(@PathVariable UUID id, @RequestBody ActiveRequest request) {
        return ResponseEntity.ok(formats.setActive(users.requireCurrentUser(), id, request.version(), request.active(), request.reason()));
    }
}
