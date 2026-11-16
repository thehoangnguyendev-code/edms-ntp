package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.service.report.ReportAppearanceService;
import com.eqms.service.report.ReportPropertiesService;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * The appearances of the reports, with their own screen and permissions in Report Administration (REPORT-APPEARANCE-PERMISSION-2026-11-14, REPORT-APPEARANCE-LIST-2026-11-15):
 * a list of appearances of which one is Active, and the automatic fields a text can hold.
 */
@RestController
@RequestMapping("/reports/appearance")
public class ReportAppearanceController {
    private final ReportPropertiesService properties;
    private final ReportAppearanceService appearances;
    private final CurrentUserService users;

    public ReportAppearanceController(ReportPropertiesService properties, ReportAppearanceService appearances, CurrentUserService users) {
        this.properties = properties;
        this.appearances = appearances;
        this.users = users;
    }

    @GetMapping
    public ResponseEntity<?> list(@RequestParam(required = false) String search, @RequestParam(required = false) String status, @RequestParam(required = false) String orientation,
            @RequestParam(required = false) String font, @RequestParam(required = false) String cover, @RequestParam(required = false) String logo,
            @RequestParam(required = false) String changedFrom, @RequestParam(required = false) String changedTo, @RequestParam(required = false) String activatedFrom,
            @RequestParam(required = false) String activatedTo, @RequestParam(required = false) String sort, @RequestParam(required = false) String direction,
            @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit) {
        var filters = new ReportAppearanceService.Filters(search, status, orientation, font, cover, logo, changedFrom, changedTo, activatedFrom, activatedTo);
        return ResponseEntity.ok(appearances.list(users.requireCurrentUser(), filters, sort, direction, page, limit));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> get(@PathVariable UUID id) { return ResponseEntity.ok(appearances.get(users.requireCurrentUser(), id)); }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody ReportAppearanceService.Create request) { return ResponseEntity.status(201).body(appearances.create(users.requireCurrentUser(), request)); }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable UUID id, @RequestBody ReportAppearanceService.Update request) { return ResponseEntity.ok(appearances.update(users.requireCurrentUser(), id, request)); }

    @PostMapping("/{id}/activate")
    public ResponseEntity<?> activate(@PathVariable UUID id) { return ResponseEntity.ok(appearances.activate(users.requireCurrentUser(), id)); }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        appearances.delete(users.requireCurrentUser(), id);
        return ResponseEntity.noContent().build();
    }

    /** Every page of the appearance, as a PDF drawn with made-up values and rows. */
    @PostMapping("/{id}/preview")
    public ResponseEntity<byte[]> preview(@PathVariable UUID id) throws Exception {
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_PDF).cacheControl(CacheControl.noStore()).body(appearances.preview(users.requireCurrentUser(), id));
    }

    @GetMapping("/placeholders")
    public ResponseEntity<?> placeholders(@RequestParam(required = false) String search, @RequestParam(required = false) String sort, @RequestParam(required = false) String direction,
            @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit) {
        return ResponseEntity.ok(properties.placeholders(users.requireCurrentUser(), search, sort, direction, page, limit));
    }
}
