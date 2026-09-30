package com.eqms.controller;

import com.eqms.dto.user.SodConstraintRequest;
import com.eqms.dto.user.SodConstraintResponse;
import com.eqms.dto.user.SodViolationResponse;
import com.eqms.service.SodConstraintService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping({"/security/sod-constraints", "/settings/sod-constraints"})
public class SodConstraintController {

    private final SodConstraintService service;

    public SodConstraintController(SodConstraintService service) {
        this.service = service;
    }

    @GetMapping("/paged")
    public ResponseEntity<com.eqms.dto.user.PageResponse<SodConstraintResponse>> listPaged(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String severity,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String createdFrom,
            @RequestParam(required = false) String createdTo,
            @RequestParam(required = false) String updatedFrom,
            @RequestParam(required = false) String updatedTo,
            @RequestParam(defaultValue = "name") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDir) {
        return ResponseEntity.ok(service.listPaged(page, limit, search, severity, type, status,
                createdFrom, createdTo, updatedFrom, updatedTo, sortBy, sortDir));
    }

    @GetMapping("/list-options")
    public ResponseEntity<java.util.Map<String, java.util.List<String>>> getListOptions() {
        return ResponseEntity.ok(service.getListOptions());
    }

    @GetMapping
    public ResponseEntity<List<SodConstraintResponse>> listAll() {
        return ResponseEntity.ok(service.listAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<SodConstraintResponse> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(service.getById(id));
    }

    /** Scan all active roles for SoD violations. */
    @GetMapping("/violations")
    public ResponseEntity<List<SodViolationResponse>> scanViolations() {
        return ResponseEntity.ok(service.scanViolations());
    }

    /** "Scan Now" on the SoD Violation Review screen -- runs the scan and records it in history. */
    @PostMapping("/violations/scan")
    public ResponseEntity<List<SodViolationResponse>> recordScan() {
        return ResponseEntity.ok(service.recordScan());
    }

    @GetMapping("/violations/history")
    public ResponseEntity<com.eqms.dto.user.PageResponse<com.eqms.dto.user.SodViolationScanSummaryResponse>> listScanHistory(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit) {
        return ResponseEntity.ok(service.listScanHistory(page, limit));
    }

    @GetMapping("/violations/history/{id}")
    public ResponseEntity<com.eqms.dto.user.SodViolationScanDetailResponse> getScanDetail(@PathVariable UUID id) {
        return ResponseEntity.ok(service.getScanDetail(id));
    }

    /** Check a proposed permission set before saving a role. */
    @PostMapping("/check")
    public ResponseEntity<List<SodConstraintResponse>> checkPermissions(
            @RequestBody List<String> permissionCodes) {
        return ResponseEntity.ok(service.checkPermissions(permissionCodes));
    }

    /** Check a proposed set of Access Profiles (e.g. before assigning them to a user) for SoD violations. */
    @PostMapping("/check-access-profiles")
    public ResponseEntity<List<com.eqms.dto.user.SodProfileCombinationViolationResponse>> checkAccessProfileCombination(
            @RequestBody List<UUID> accessProfileIds) {
        return ResponseEntity.ok(service.checkAccessProfileCombination(accessProfileIds));
    }

    /** Preview real-world impact for a permission pair not yet saved -- used by the New/Edit
     *  SoD Constraint form to show which Access Profiles/users hold both sides before saving. */
    @GetMapping("/preview-impact")
    public ResponseEntity<com.eqms.dto.user.SodViolationResponse> previewImpact(
            @RequestParam String codeA, @RequestParam String codeB) {
        return ResponseEntity.ok(service.previewImpact(codeA, codeB));
    }

    @PostMapping
    public ResponseEntity<SodConstraintResponse> create(@RequestBody SodConstraintRequest request) {
        return ResponseEntity.ok(service.create(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<SodConstraintResponse> update(
            @PathVariable UUID id,
            @RequestBody SodConstraintRequest request) {
        return ResponseEntity.ok(service.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id,
            @RequestBody(required = false) com.eqms.dto.settings.SecurityChangeRequest sig) {
        service.delete(id, sig);
        return ResponseEntity.noContent().build();
    }
}
