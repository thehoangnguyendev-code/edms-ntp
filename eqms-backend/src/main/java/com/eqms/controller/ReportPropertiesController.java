package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.service.report.ReportPropertiesService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** The settings of the Reports module, in Report Administration (REPORT-PROPERTIES-2026-10-15). */
@RestController
@RequestMapping("/reports/properties")
public class ReportPropertiesController {
    private final ReportPropertiesService properties;
    private final CurrentUserService users;
    public ReportPropertiesController(ReportPropertiesService properties, CurrentUserService users) { this.properties = properties; this.users = users; }

    @GetMapping
    public ResponseEntity<?> get() { return ResponseEntity.ok(properties.get(users.requireCurrentUser())); }

    @PutMapping
    public ResponseEntity<?> update(@RequestBody ReportPropertiesService.PropertiesWrite request) {
        return ResponseEntity.ok(properties.update(users.requireCurrentUser(), request));
    }
}
