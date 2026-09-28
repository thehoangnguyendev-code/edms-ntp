package com.eqms.controller;

import com.eqms.dto.knowledge.KnowledgeHierarchyDtos.FieldOption;
import com.eqms.dto.knowledge.KnowledgeHierarchyDtos.HierarchyRequest;
import com.eqms.dto.knowledge.KnowledgeHierarchyDtos.HierarchyResponse;
import com.eqms.dto.knowledge.KnowledgeHierarchyDtos.LevelRequest;
import com.eqms.dto.knowledge.KnowledgeHierarchyDtos.ReorderRequest;
import com.eqms.dto.user.PageResponse;
import com.eqms.service.KnowledgeHierarchyService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/settings/knowledge-hierarchies")
public class KnowledgeHierarchyController {

    private final KnowledgeHierarchyService service;

    public KnowledgeHierarchyController(KnowledgeHierarchyService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<PageResponse<HierarchyResponse>> list(
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

    @GetMapping("/fields")
    public ResponseEntity<List<FieldOption>> fields() {
        return ResponseEntity.ok(service.fieldOptions());
    }

    @GetMapping("/{id}")
    public ResponseEntity<HierarchyResponse> get(@PathVariable UUID id) {
        return ResponseEntity.ok(service.get(id));
    }

    @PostMapping
    public ResponseEntity<HierarchyResponse> create(@RequestBody HierarchyRequest request) {
        return ResponseEntity.ok(service.create(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<HierarchyResponse> update(@PathVariable UUID id, @RequestBody HierarchyRequest request) {
        return ResponseEntity.ok(service.update(id, request));
    }

    @PostMapping("/{id}/default")
    public ResponseEntity<HierarchyResponse> setDefault(@PathVariable UUID id) {
        return ResponseEntity.ok(service.setDefault(id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/levels")
    public ResponseEntity<HierarchyResponse> addLevel(@PathVariable UUID id, @RequestBody LevelRequest request) {
        return ResponseEntity.ok(service.addLevel(id, request));
    }

    @PutMapping("/{id}/levels/{levelId}")
    public ResponseEntity<HierarchyResponse> updateLevel(@PathVariable UUID id, @PathVariable UUID levelId,
                                                         @RequestBody LevelRequest request) {
        return ResponseEntity.ok(service.updateLevel(id, levelId, request));
    }

    @PutMapping("/{id}/levels/order")
    public ResponseEntity<HierarchyResponse> reorderLevels(@PathVariable UUID id, @RequestBody ReorderRequest request) {
        return ResponseEntity.ok(service.reorderLevels(id, request == null ? null : request.levelIds()));
    }

    @DeleteMapping("/{id}/levels/{levelId}")
    public ResponseEntity<HierarchyResponse> removeLevel(@PathVariable UUID id, @PathVariable UUID levelId) {
        return ResponseEntity.ok(service.removeLevel(id, levelId));
    }
}
