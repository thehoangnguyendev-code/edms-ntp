package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.service.WorkflowDiagramService;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Workflow diagrams of a module. Who may see or change them is decided by {@link WorkflowDiagramService}. */
@RestController
@RequestMapping("/workflow-diagrams")
public class WorkflowDiagramController {

    public record CreateRequest(String module, String name, String description) {
    }

    public record SaveRequest(Integer version, String xml, String svg, String reason) {
    }

    public record DetailsRequest(String name, String description, String reason) {
    }

    public record DeleteRequest(String reason) {
    }

    private final WorkflowDiagramService diagrams;
    private final CurrentUserService currentUser;

    public WorkflowDiagramController(WorkflowDiagramService diagrams, CurrentUserService currentUser) {
        this.diagrams = diagrams;
        this.currentUser = currentUser;
    }

    @GetMapping
    public Map<String, Object> list(@RequestParam String module, @RequestParam(required = false) String search) {
        return diagrams.list(currentUser.requireCurrentUser(), module, search);
    }

    @GetMapping("/{id}")
    public Map<String, Object> get(@PathVariable UUID id) {
        return diagrams.get(currentUser.requireCurrentUser(), id);
    }

    @PostMapping
    public Map<String, Object> create(@RequestBody CreateRequest body) {
        return diagrams.create(currentUser.requireCurrentUser(), body.module(), body.name(), body.description());
    }

    @PutMapping("/{id}/drawing")
    public Map<String, Object> save(@PathVariable UUID id, @RequestBody SaveRequest body) {
        return diagrams.save(currentUser.requireCurrentUser(), id, body.version(), body.xml(), body.svg(), body.reason());
    }

    @PutMapping("/{id}")
    public Map<String, Object> rename(@PathVariable UUID id, @RequestBody DetailsRequest body) {
        return diagrams.rename(currentUser.requireCurrentUser(), id, body.name(), body.description(), body.reason());
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable UUID id, @RequestBody DeleteRequest body) {
        diagrams.delete(currentUser.requireCurrentUser(), id, body.reason());
    }

    @GetMapping("/{id}/versions")
    public List<Map<String, Object>> versions(@PathVariable UUID id) {
        return diagrams.versions(currentUser.requireCurrentUser(), id);
    }

    @GetMapping("/{id}/versions/{version}")
    public Map<String, Object> versionImage(@PathVariable UUID id, @PathVariable int version) {
        return diagrams.versionImage(currentUser.requireCurrentUser(), id, version);
    }
}
