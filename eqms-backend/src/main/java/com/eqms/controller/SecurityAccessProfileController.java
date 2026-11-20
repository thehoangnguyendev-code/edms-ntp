package com.eqms.controller;

import com.eqms.dto.settings.AccessProfileCapabilitiesResponse;
import com.eqms.dto.settings.AccessProfileDetailResponse;
import com.eqms.dto.settings.AccessProfileAssignmentRequest;
import com.eqms.dto.settings.AccessProfileRequest;
import com.eqms.dto.settings.AccessProfileResponse;
import com.eqms.dto.settings.SecurityChangeRequest;
import com.eqms.service.AccessProfileService;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/security/access-profiles")
public class SecurityAccessProfileController {

    private final AccessProfileService service;

    public SecurityAccessProfileController(AccessProfileService service) {
        this.service = service;
    }

    @GetMapping
    public Page<AccessProfileResponse> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String createdFrom,
            @RequestParam(required = false) String createdTo,
            @RequestParam(required = false) String updatedFrom,
            @RequestParam(required = false) String updatedTo,
            @RequestParam(defaultValue = "name") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDir) {
        return service.listProfiles(page, size, search, type, status, createdFrom, createdTo, updatedFrom, updatedTo, sortBy, sortDir);
    }

    @GetMapping("/all")
    public List<AccessProfileResponse> listAll() {
        return service.listAllProfiles();
    }

    @GetMapping("/migration-report")
    public com.eqms.dto.settings.AccessProfileMigrationReportResponse migrationReport() {
        return service.getMigrationReport();
    }

    /** Atomic "create role in one shot" used by the New Role wizard — one transaction, one e-signature. */
    @PostMapping("/full")
    public AccessProfileDetailResponse createFull(@RequestBody com.eqms.dto.settings.AccessProfileFullRequest req) {
        return service.createProfileFull(req);
    }

    /**
     * Aggregate "save role configuration": one request = one transaction, one e-signature,
     * one composite audit event. 409 when expectedUpdatedAt is stale (another admin saved).
     */
    @PutMapping("/{id}/configuration")
    public AccessProfileDetailResponse updateConfiguration(@PathVariable UUID id,
            @RequestBody com.eqms.dto.settings.AccessProfileConfigurationRequest req) {
        return service.updateProfileConfiguration(id, req);
    }

    @GetMapping("/{id}")
    public AccessProfileDetailResponse get(@PathVariable UUID id) {
        return service.getProfile(id);
    }

    @GetMapping("/{id}/editor-summary")
    public Map<String, Object> getEditorSummary(@PathVariable UUID id) {
        return service.getProfileForEditor(id);
    }

    @GetMapping("/{id}/capabilities")
    public AccessProfileCapabilitiesResponse getCapabilities(@PathVariable UUID id) {
        return service.getCapabilities(id);
    }

    @PutMapping("/{id}")
    public AccessProfileDetailResponse update(@PathVariable UUID id, @RequestBody AccessProfileRequest req) {
        return service.updateProfile(id, req);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id, @RequestBody(required = false) SecurityChangeRequest sig) {
        service.deleteProfile(id, sig);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/duplicate")
    public AccessProfileDetailResponse duplicate(@PathVariable UUID id, @RequestBody Map<String, String> body) {
        return service.duplicateProfile(id, body.get("name"),
                new SecurityChangeRequest(body.get("signatureToken"), body.get("reason")));
    }

    @PutMapping("/{id}/toggle-status")
    public AccessProfileDetailResponse toggleStatus(@PathVariable UUID id, @RequestBody(required = false) SecurityChangeRequest sig) {
        return service.toggleStatus(id, sig);
    }

    @GetMapping("/{id}/permission-sets")
    public List<AccessProfileDetailResponse.PermissionSetSummary> getPermissionSets(@PathVariable UUID id) {
        return service.getPermissionSets(id);
    }

    @GetMapping("/{id}/workflow-roles")
    public List<String> getWorkflowRoles(@PathVariable UUID id) {
        return service.getWorkflowRoles(id);
    }

    @GetMapping("/{id}/users/paged")
    public Map<String, Object> getUsersPage(@PathVariable UUID id,
            @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit,
            @RequestParam(required = false) String search, @RequestParam(required = false) String sortBy,
            @RequestParam(required = false) String sortDir) {
        return service.queryAssignedUsers(id, page, limit, search, sortBy, sortDir);
    }

    @PostMapping("/{id}/users/{userId}")
    public ResponseEntity<Void> assignUser(@PathVariable UUID id, @PathVariable UUID userId,
            @RequestBody(required = false) SecurityChangeRequest sig) {
        service.assignUser(id, userId, sig);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{id}/users/{userId}")
    public ResponseEntity<Void> removeUser(@PathVariable UUID id, @PathVariable UUID userId,
            @RequestBody(required = false) SecurityChangeRequest sig) {
        service.removeUser(id, userId, sig);
        return ResponseEntity.noContent().build();
    }
}
