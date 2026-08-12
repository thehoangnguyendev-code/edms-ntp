package com.eqms.controller;

import com.eqms.dto.security.LifecycleStatePolicyDtos.LifecycleStatePolicyOptionsResponse;
import com.eqms.dto.security.LifecycleStatePolicyDtos.LifecycleStatePolicyRequest;
import com.eqms.dto.security.LifecycleStatePolicyDtos.LifecycleStatePolicyResponse;
import com.eqms.service.LifecycleStatePolicyService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/security/state-policies")
public class LifecycleStatePolicyController {

    private final LifecycleStatePolicyService service;

    public LifecycleStatePolicyController(LifecycleStatePolicyService service) {
        this.service = service;
    }

    @GetMapping("/paged")
    public ResponseEntity<com.eqms.dto.user.PageResponse<LifecycleStatePolicyResponse>> listPaged(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String capability,
            @RequestParam(required = false) String statusCode,
            @RequestParam(required = false) String actorScope,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String active,
            @RequestParam(required = false) String createdFrom,
            @RequestParam(required = false) String createdTo,
            @RequestParam(required = false) String updatedFrom,
            @RequestParam(required = false) String updatedTo,
            @RequestParam(defaultValue = "capability") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDir) {
        return ResponseEntity.ok(service.listPaged(page, limit, search, capability, statusCode, actorScope, type, active,
                createdFrom, createdTo, updatedFrom, updatedTo, sortBy, sortDir));
    }

    @GetMapping
    public ResponseEntity<List<LifecycleStatePolicyResponse>> listAll() {
        return ResponseEntity.ok(service.listAll());
    }

    @GetMapping("/options")
    public ResponseEntity<LifecycleStatePolicyOptionsResponse> getOptions() {
        return ResponseEntity.ok(service.getOptions());
    }

    @GetMapping("/{id}")
    public ResponseEntity<LifecycleStatePolicyResponse> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(service.getById(id));
    }

    @PostMapping
    public ResponseEntity<LifecycleStatePolicyResponse> create(@RequestBody LifecycleStatePolicyRequest request) {
        return ResponseEntity.ok(service.create(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<LifecycleStatePolicyResponse> update(
            @PathVariable UUID id,
            @RequestBody LifecycleStatePolicyRequest request) {
        return ResponseEntity.ok(service.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id,
            @RequestBody(required = false) com.eqms.dto.settings.SecurityChangeRequest sig) {
        service.delete(id, sig);
        return ResponseEntity.noContent().build();
    }
}
