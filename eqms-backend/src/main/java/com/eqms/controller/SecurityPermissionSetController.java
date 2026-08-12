package com.eqms.controller;

import com.eqms.dto.user.PermissionSetCapabilitiesResponse;
import com.eqms.dto.user.PermissionSetRequest;
import com.eqms.dto.user.PermissionSetResponse;
import com.eqms.service.PermissionSetService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/security/permission-sets")
public class SecurityPermissionSetController {

    private final PermissionSetService service;

    public SecurityPermissionSetController(PermissionSetService service) {
        this.service = service;
    }

    @GetMapping("/paged")
    public ResponseEntity<com.eqms.dto.user.PageResponse<PermissionSetResponse>> listPaged(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String module,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String createdFrom,
            @RequestParam(required = false) String createdTo,
            @RequestParam(required = false) String updatedFrom,
            @RequestParam(required = false) String updatedTo,
            @RequestParam(defaultValue = "name") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDir,
            @RequestParam(defaultValue = "false") boolean includeManaged) {
        return ResponseEntity.ok(service.listPaged(
                page, limit, search, status, type, module, category,
                createdFrom, createdTo, updatedFrom, updatedTo,
                sortBy, sortDir, includeManaged));
    }

    @GetMapping("/list-options")
    public ResponseEntity<java.util.Map<String, List<String>>> getListOptions() {
        return ResponseEntity.ok(service.getListOptions());
    }

    @GetMapping
    public ResponseEntity<List<PermissionSetResponse>> listAll(
            @RequestParam(defaultValue = "false") boolean includeManaged) {
        return ResponseEntity.ok(service.listAll(includeManaged));
    }

    @GetMapping("/{id}")
    public ResponseEntity<PermissionSetResponse> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(service.getById(id));
    }

    @GetMapping("/{id}/capabilities")
    public ResponseEntity<PermissionSetCapabilitiesResponse> getCapabilities(@PathVariable UUID id) {
        return ResponseEntity.ok(service.getCapabilities(id));
    }

    @GetMapping("/{id}/access-profiles")
    public ResponseEntity<List<com.eqms.dto.user.PermissionSetAssignedAccessProfileResponse>> getAssignedAccessProfiles(@PathVariable UUID id) {
        return ResponseEntity.ok(service.getAssignedAccessProfiles(id));
    }

    @PostMapping
    public ResponseEntity<PermissionSetResponse> create(@RequestBody PermissionSetRequest request) {
        return ResponseEntity.ok(service.create(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<PermissionSetResponse> update(
            @PathVariable UUID id,
            @RequestBody PermissionSetRequest request) {
        return ResponseEntity.ok(service.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id,
            @RequestBody(required = false) com.eqms.dto.settings.SecurityChangeRequest sig) {
        service.delete(id, sig);
        return ResponseEntity.noContent().build();
    }
}
