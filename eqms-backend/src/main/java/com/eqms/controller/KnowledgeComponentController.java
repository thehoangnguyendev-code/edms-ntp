package com.eqms.controller;

import com.eqms.dto.knowledge.KnowledgeComponentDtos.ComponentRequest;
import com.eqms.dto.knowledge.KnowledgeComponentDtos.ComponentResponse;
import com.eqms.dto.knowledge.KnowledgeComponentDtos.SourceOption;
import com.eqms.dto.user.PageResponse;
import com.eqms.service.KnowledgeComponentService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/settings/knowledge-components")
public class KnowledgeComponentController {

    private final KnowledgeComponentService service;

    public KnowledgeComponentController(KnowledgeComponentService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<PageResponse<ComponentResponse>> list(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String updatedFrom,
            @RequestParam(required = false) String updatedTo,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(defaultValue = "name") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDir) {
        return ResponseEntity.ok(service.list(search, status, updatedFrom, updatedTo, page, limit, sortBy, sortDir));
    }

    @GetMapping("/sources")
    public ResponseEntity<List<SourceOption>> sources() {
        return ResponseEntity.ok(service.availableSources());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ComponentResponse> get(@PathVariable UUID id) {
        return ResponseEntity.ok(service.get(id));
    }

    @PostMapping
    public ResponseEntity<ComponentResponse> create(@RequestBody ComponentRequest request) {
        return ResponseEntity.ok(service.create(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ComponentResponse> update(@PathVariable UUID id, @RequestBody ComponentRequest request) {
        return ResponseEntity.ok(service.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
