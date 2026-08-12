package com.eqms.controller;

import com.eqms.dto.settings.SecurityChangeRequest;
import com.eqms.dto.user.WorkflowRoleCatalogRequest;
import com.eqms.dto.user.WorkflowRoleCatalogResponse;
import com.eqms.dto.user.PageResponse;
import com.eqms.service.WorkflowRoleCatalogService;
import com.eqms.service.WorkflowRoleService;
import com.eqms.service.WorkflowRoleService.WorkflowRoleResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * GET (no path variable) returns the read model of role -> Access Profile /
 * policy assignments ({@link WorkflowRoleService}). The CRUD sub-endpoints
 * ({@code /catalog}...) manage the extensible Workflow Roles catalog itself
 * ({@link WorkflowRoleCatalogService}) — see
 * docs/SECURITY_AUTHORIZATION_IMPLEMENTATION_PLAN.md 0.5a. Kept in one
 * controller because both are mounted at /security/workflow-roles.
 */
@RestController
@RequestMapping("/security/workflow-roles")
public class WorkflowRoleController {

    private final WorkflowRoleService service;
    private final WorkflowRoleCatalogService catalogService;

    public WorkflowRoleController(WorkflowRoleService service, WorkflowRoleCatalogService catalogService) {
        this.service = service;
        this.catalogService = catalogService;
    }

    @GetMapping
    public ResponseEntity<List<WorkflowRoleResponse>> listAll() {
        return ResponseEntity.ok(service.listAll());
    }

    @GetMapping("/catalog")
    public ResponseEntity<PageResponse<WorkflowRoleCatalogResponse>> listCatalog(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String module,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String createdFrom,
            @RequestParam(required = false) String createdTo,
            @RequestParam(required = false) String updatedFrom,
            @RequestParam(required = false) String updatedTo,
            @RequestParam(defaultValue = "displayOrder") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDir) {
        return ResponseEntity.ok(catalogService.listPage(
                page, limit, search, module, type, status,
                createdFrom, createdTo, updatedFrom, updatedTo, sortBy, sortDir));
    }

    @GetMapping("/catalog/options")
    public ResponseEntity<List<String>> listCatalogModules() {
        return ResponseEntity.ok(catalogService.listModuleKeys());
    }

    @GetMapping("/catalog/{id}")
    public ResponseEntity<WorkflowRoleCatalogResponse> getCatalogEntry(@PathVariable UUID id) {
        return ResponseEntity.ok(catalogService.getById(id));
    }

    @PostMapping("/catalog")
    public ResponseEntity<WorkflowRoleCatalogResponse> createCatalogEntry(@Valid @RequestBody WorkflowRoleCatalogRequest request) {
        return ResponseEntity.ok(catalogService.create(request));
    }

    @PutMapping("/catalog/{id}")
    public ResponseEntity<WorkflowRoleCatalogResponse> updateCatalogEntry(
            @PathVariable UUID id,
            @Valid @RequestBody WorkflowRoleCatalogRequest request) {
        return ResponseEntity.ok(catalogService.update(id, request));
    }

    @DeleteMapping("/catalog/{id}")
    public ResponseEntity<Void> deactivateCatalogEntry(
            @PathVariable UUID id,
            @RequestBody(required = false) SecurityChangeRequest sig) {
        catalogService.deactivate(id, sig);
        return ResponseEntity.noContent().build();
    }
}
