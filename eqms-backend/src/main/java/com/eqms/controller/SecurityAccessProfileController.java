package com.eqms.controller;

import com.eqms.dto.settings.AccessProfileCapabilitiesResponse;
import com.eqms.dto.settings.AccessProfileDetailResponse;
import com.eqms.dto.settings.AccessProfileAssignmentRequest;
import com.eqms.dto.settings.AccessProfileRequest;
import com.eqms.dto.settings.AccessProfileResponse;
import com.eqms.dto.settings.SecurityChangeRequest;
import com.eqms.dto.security.EffectiveAccessResponse;
import com.eqms.service.AccessEffectiveService;
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
    private final AccessEffectiveService accessEffectiveService;

    public SecurityAccessProfileController(AccessProfileService service, AccessEffectiveService accessEffectiveService) {
        this.service = service;
        this.accessEffectiveService = accessEffectiveService;
    }

    @GetMapping("/{id}/effective-access")
    public EffectiveAccessResponse getEffectiveAccess(
            @PathVariable UUID id,
            @RequestParam(required = false) UUID documentTypeId
    ) {
        return accessEffectiveService.getEffectiveAccess(id, documentTypeId);
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
            @RequestParam(required = false) String updatedTo) {
        return service.listProfiles(page, size, search, type, status, createdFrom, createdTo, updatedFrom, updatedTo);
    }

    @GetMapping("/all")
    public List<AccessProfileResponse> listAll() {
        return service.listAllProfiles();
    }

    @GetMapping("/migration-report")
    public com.eqms.dto.settings.AccessProfileMigrationReportResponse migrationReport() {
        return service.getMigrationReport();
    }

    @PostMapping
    public AccessProfileDetailResponse create(@RequestBody AccessProfileRequest req) {
        return service.createProfile(req);
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

    /** Replace the role's individually-picked permissions (its auto-managed ROLE_<code> set). */
    @PostMapping("/{id}/managed-permissions")
    public ResponseEntity<Void> setManagedPermissions(@PathVariable UUID id,
            @RequestBody com.eqms.dto.settings.ManagedPermissionsRequest body) {
        service.setManagedPermissions(id, body.codes(),
                new SecurityChangeRequest(body.signatureToken(), body.reason()));
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{id}")
    public AccessProfileDetailResponse get(@PathVariable UUID id) {
        return service.getProfile(id);
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

    @PutMapping("/{id}/permission-sets")
    public ResponseEntity<Void> setPermissionSets(@PathVariable UUID id,
            @RequestBody AccessProfileAssignmentRequest.PermissionSets body) {
        service.setPermissionSets(id, body.permissionSetIds(),
                new SecurityChangeRequest(body.signatureToken(), body.reason()));
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/permission-sets/{psId}")
    public ResponseEntity<Void> addPermissionSet(@PathVariable UUID id, @PathVariable UUID psId,
            @RequestBody(required = false) SecurityChangeRequest sig) {
        service.addPermissionSet(id, psId, sig);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{id}/permission-sets/{psId}")
    public ResponseEntity<Void> removePermissionSet(@PathVariable UUID id, @PathVariable UUID psId,
            @RequestBody(required = false) SecurityChangeRequest sig) {
        service.removePermissionSet(id, psId, sig);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/workflow-roles")
    public List<String> getWorkflowRoles(@PathVariable UUID id) {
        return service.getWorkflowRoles(id);
    }

    @PutMapping("/{id}/workflow-roles")
    public ResponseEntity<Void> setWorkflowRoles(@PathVariable UUID id,
            @RequestBody AccessProfileAssignmentRequest.WorkflowRoles body) {
        service.setWorkflowRoles(id, body.roles(),
                new SecurityChangeRequest(body.signatureToken(), body.reason()));
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/workflow-roles/{role}")
    public ResponseEntity<Void> addWorkflowRole(@PathVariable UUID id, @PathVariable String role,
            @RequestBody(required = false) SecurityChangeRequest sig) {
        service.addWorkflowRole(id, role, sig);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{id}/workflow-roles/{role}")
    public ResponseEntity<Void> removeWorkflowRole(@PathVariable UUID id, @PathVariable String role,
            @RequestBody(required = false) SecurityChangeRequest sig) {
        service.removeWorkflowRole(id, role, sig);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/users")
    public List<AccessProfileDetailResponse.AssignedUserSummary> getUsers(@PathVariable UUID id) {
        return service.getAssignedUsers(id);
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
