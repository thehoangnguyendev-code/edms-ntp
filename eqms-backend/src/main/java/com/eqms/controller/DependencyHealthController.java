package com.eqms.controller;

import com.eqms.dto.system.DependencyStatus;
import com.eqms.service.DependencyHealthService;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Whether the services behind the screens answer, so any signed-in person is told before an upload or a preview fails. It carries names and effects only, nothing about the
 * installation (no address, no version), which is why every signed-in person may read it and the settings permission is not asked.
 */
@RestController
@RequestMapping("/system/dependencies")
public class DependencyHealthController {
    private final DependencyHealthService service;

    public DependencyHealthController(DependencyHealthService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<DependencyStatus>> get() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.check());
    }
}
