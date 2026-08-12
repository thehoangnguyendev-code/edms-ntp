package com.eqms.controller;

import com.eqms.dto.user.ObjectAccessRuleOptionsResponse;
import com.eqms.dto.user.ObjectAccessRuleRequest;
import com.eqms.dto.user.ObjectAccessRuleResponse;
import com.eqms.service.ObjectAccessRuleService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping({"/security/object-access-rules", "/settings/object-access-rules"})
public class ObjectAccessRuleController {

    private final ObjectAccessRuleService service;

    public ObjectAccessRuleController(ObjectAccessRuleService service) {
        this.service = service;
    }

    @GetMapping("/paged")
    public ResponseEntity<com.eqms.dto.user.PageResponse<ObjectAccessRuleResponse>> listPaged(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String resourceType,
            @RequestParam(required = false) String effect,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String createdFrom,
            @RequestParam(required = false) String createdTo,
            @RequestParam(required = false) String updatedFrom,
            @RequestParam(required = false) String updatedTo,
            @RequestParam(defaultValue = "priority") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir) {
        return ResponseEntity.ok(service.listPaged(page, limit, search, resourceType, effect, status,
                createdFrom, createdTo, updatedFrom, updatedTo, sortBy, sortDir));
    }

    @GetMapping
    public ResponseEntity<List<ObjectAccessRuleResponse>> listAll() {
        return ResponseEntity.ok(service.listAll());
    }

    @GetMapping("/options")
    public ResponseEntity<ObjectAccessRuleOptionsResponse> getOptions() {
        return ResponseEntity.ok(service.getOptions());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ObjectAccessRuleResponse> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(service.getById(id));
    }

    @PostMapping
    public ResponseEntity<ObjectAccessRuleResponse> create(@Valid @RequestBody ObjectAccessRuleRequest request) {
        return ResponseEntity.ok(service.create(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ObjectAccessRuleResponse> update(
            @PathVariable UUID id,
            @Valid @RequestBody ObjectAccessRuleRequest request) {
        return ResponseEntity.ok(service.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id,
            @RequestBody(required = false) com.eqms.dto.settings.SecurityChangeRequest sig) {
        service.delete(id, sig);
        return ResponseEntity.noContent().build();
    }
}
