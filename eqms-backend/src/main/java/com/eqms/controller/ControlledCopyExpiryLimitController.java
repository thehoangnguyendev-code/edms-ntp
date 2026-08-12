package com.eqms.controller;

import com.eqms.dto.controlledcopypolicy.ControlledCopyExpiryLimitRequest;
import com.eqms.dto.controlledcopypolicy.ControlledCopyExpiryLimitResponse;
import com.eqms.service.ControlledCopyExpiryLimitService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/settings/controlled-copy-expiry-limits")
public class ControlledCopyExpiryLimitController {

    private final ControlledCopyExpiryLimitService service;

    public ControlledCopyExpiryLimitController(ControlledCopyExpiryLimitService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<ControlledCopyExpiryLimitResponse>> list() {
        return ResponseEntity.ok(service.list());
    }

    @PostMapping
    public ResponseEntity<ControlledCopyExpiryLimitResponse> create(@RequestBody ControlledCopyExpiryLimitRequest request) {
        return ResponseEntity.ok(service.create(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ControlledCopyExpiryLimitResponse> update(@PathVariable UUID id, @RequestBody ControlledCopyExpiryLimitRequest request) {
        return ResponseEntity.ok(service.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id, @RequestBody ControlledCopyExpiryLimitRequest request) {
        service.delete(id, request);
        return ResponseEntity.noContent().build();
    }
}
