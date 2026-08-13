package com.eqms.controller;

import com.eqms.dto.user.*;
import com.eqms.auth.CurrentUserService;
import com.eqms.service.PermissionEvaluationService;
import com.eqms.service.UserManagementService;
import com.eqms.service.SystemConfigurationService;
import com.eqms.service.OfficeOnlineConfigurationService;
import com.eqms.service.MicrosoftGraphOfficeOnlineService;
import com.eqms.service.FileStorageService;
import com.eqms.service.EmailService;
import com.eqms.service.ExternalIdentityProvisioningService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;
import org.springframework.context.i18n.LocaleContextHolder;

import java.util.List;
import java.util.Locale;
import java.util.MissingResourceException;
import java.util.ResourceBundle;
import java.util.UUID;

@RestController
@RequestMapping("/settings")
public class SettingsUserController {

    private final UserManagementService service;
    private final SystemConfigurationService systemConfigurationService;
    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissionEvaluationService;
    private final OfficeOnlineConfigurationService officeOnlineConfigurationService;
    private final MicrosoftGraphOfficeOnlineService microsoftGraphOfficeOnlineService;
    private final FileStorageService fileStorageService;
    private final EmailService emailService;
    private final ExternalIdentityProvisioningService externalIdentityProvisioningService;

    public SettingsUserController(
            UserManagementService service,
            SystemConfigurationService systemConfigurationService,
            CurrentUserService currentUserService,
            PermissionEvaluationService permissionEvaluationService,
            OfficeOnlineConfigurationService officeOnlineConfigurationService,
            MicrosoftGraphOfficeOnlineService microsoftGraphOfficeOnlineService,
            FileStorageService fileStorageService,
            EmailService emailService,
            ExternalIdentityProvisioningService externalIdentityProvisioningService
    ) {
        this.service = service;
        this.systemConfigurationService = systemConfigurationService;
        this.currentUserService = currentUserService;
        this.permissionEvaluationService = permissionEvaluationService;
        this.officeOnlineConfigurationService = officeOnlineConfigurationService;
        this.microsoftGraphOfficeOnlineService = microsoftGraphOfficeOnlineService;
        this.fileStorageService = fileStorageService;
        this.emailService = emailService;
        this.externalIdentityProvisioningService = externalIdentityProvisioningService;
    }

    @GetMapping("/users")
    public ResponseEntity<PageResponse<UserManagementResponse>> getUsers(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int limit,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String online,
            @RequestParam(required = false) String businessUnit,
            @RequestParam(required = false) String department,
            @RequestParam(required = false) String position,
            @RequestParam(required = false) String dateFrom,
            @RequestParam(required = false) String dateTo,
            @RequestParam(required = false) String suspendFrom,
            @RequestParam(required = false) String suspendTo,
            @RequestParam(required = false) String terminateFrom,
            @RequestParam(required = false) String terminateTo,
            @RequestParam(defaultValue = "employeeCode") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDirection,
            @RequestParam(defaultValue = "false") boolean includeTerminated
    ) {
        requireUserView();
        return ResponseEntity.ok(service.getUsers(page, limit, search, role, status, online, businessUnit, department, position, dateFrom, dateTo, suspendFrom, suspendTo, terminateFrom, terminateTo, sortBy, sortDirection, includeTerminated));
    }

    @GetMapping("/users/{id}")
    public ResponseEntity<UserManagementResponse> getUser(@PathVariable UUID id) {
        requireUserView();
        return ResponseEntity.ok(service.getUser(id));
    }

    @PostMapping("/users")
    public ResponseEntity<UserCreationResponse> createUser(@Valid @RequestBody CreateUserRequest request, HttpServletRequest httpRequest) {
        requireUserCreate();
        return ResponseEntity.ok(service.createUser(request, httpRequest));
    }

    @PutMapping("/users/{id}")
    public ResponseEntity<UserManagementResponse> updateUser(@PathVariable UUID id, @Valid @RequestBody UpdateUserRequest request, HttpServletRequest httpRequest) {
        requireUserEdit();
        return ResponseEntity.ok(service.updateUser(id, request, httpRequest));
    }

    // DELETE/SUSPEND/TERMINATE deliberately have no requireUserDelete()/requireUserEdit() gate
    // here (SECURITY_AUTHORIZATION_HYBRID_REFACTOR_PLAN.md Phase 4 cutover rule 5, 2026-08-11):
    // UserManagementService#requireUserActionAllowed is now the sole decision point for these 3
    // actions, via AuthorizationEngineService -- a flat permission check here would be a
    // duplicate, dead-if-agreeing / silently-overridden-if-not gate.

    @DeleteMapping("/users/{id}")
    public ResponseEntity<Void> deleteUser(@PathVariable UUID id, @RequestParam String signatureToken, HttpServletRequest httpRequest) {
        service.deleteUser(id, signatureToken, httpRequest);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/users/{id}/suspend")
    public ResponseEntity<UserManagementResponse> suspendUser(@PathVariable UUID id, @Valid @RequestBody StatusActionRequest request, HttpServletRequest httpRequest) {
        return ResponseEntity.ok(service.suspendUser(id, request, httpRequest));
    }

    @PostMapping("/users/{id}/terminate")
    public ResponseEntity<UserManagementResponse> terminateUser(@PathVariable UUID id, @Valid @RequestBody StatusActionRequest request, HttpServletRequest httpRequest) {
        return ResponseEntity.ok(service.terminateUser(id, request, httpRequest));
    }

    @PostMapping("/users/{id}/reinstate")
    public ResponseEntity<UserManagementResponse> reinstateUser(@PathVariable UUID id, @RequestBody(required = false) ReinstateRequest request, HttpServletRequest httpRequest) {
        requireUserEdit();
        return ResponseEntity.ok(service.reinstateUser(id, request, httpRequest));
    }

    @PostMapping("/users/{id}/reset-password")
    public ResponseEntity<ResetPasswordResponse> resetPassword(@PathVariable UUID id, @RequestBody(required = false) UserResetPasswordRequest request, HttpServletRequest httpRequest) {
        requireUserResetPassword();
        return ResponseEntity.ok(service.resetPassword(id, request, httpRequest));
    }

    @PostMapping("/users/{id}/unlock")
    public ResponseEntity<UserManagementResponse> unlockUser(@PathVariable UUID id, HttpServletRequest httpRequest) {
        requireUserEdit();
        return ResponseEntity.ok(service.unlockUser(id, httpRequest));
    }

    @PostMapping("/users/{id}/force-logout")
    public ResponseEntity<Void> forceLogout(@PathVariable UUID id, @Valid @RequestBody ForceLogoutRequest request, HttpServletRequest httpRequest) {
        requireUserForceLogout();
        service.forceLogout(id, request, httpRequest);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/users/{id}/permissions")
    public ResponseEntity<UserPermissionsResponse> getPermissions(@PathVariable UUID id) {
        requireUserView();
        return ResponseEntity.ok(service.getPermissions(id));
    }

    @GetMapping("/users/{id}/capabilities")
    public ResponseEntity<UserActionCapabilitiesResponse> getUserCapabilities(@PathVariable UUID id) {
        requireUserView();
        return ResponseEntity.ok(service.getUserCapabilities(id));
    }

    @PutMapping("/users/{id}/role")
    public ResponseEntity<UserManagementResponse> updateRole(@PathVariable UUID id, @Valid @RequestBody UpdateRoleRequest request, HttpServletRequest httpRequest) {
        requireAccessProfileAssign();
        return ResponseEntity.ok(service.updateRole(id, request, httpRequest));
    }

    @GetMapping("/users/filters")
    public ResponseEntity<FilterOptionsResponse> getFilters() {
        requireUserView();
        return ResponseEntity.ok(service.getFilterOptions());
    }

    @GetMapping("/users/export")
    public ResponseEntity<StreamingResponseBody> exportUsers(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String online,
            @RequestParam(required = false) String businessUnit,
            @RequestParam(required = false) String department,
            @RequestParam(required = false) String position,
            @RequestParam(required = false) String dateFrom,
            @RequestParam(required = false) String dateTo,
            @RequestParam(required = false) String suspendFrom,
            @RequestParam(required = false) String suspendTo,
            @RequestParam(required = false) String terminateFrom,
            @RequestParam(required = false) String terminateTo,
            @RequestParam(defaultValue = "false") boolean includeTerminated
    ) {
        requireUserView();
        StreamingResponseBody body = outputStream -> service.writeUsersExport(
                search, role, status, online, businessUnit, department, position,
                dateFrom, dateTo, suspendFrom, suspendTo, terminateFrom, terminateTo,
                includeTerminated, outputStream
        );
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=users_export.csv")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(body);
    }

    @GetMapping("/roles")
    public ResponseEntity<PageResponse<RoleSummaryResponse>> getRoles(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int limit,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "name") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDirection
    ) {
        requireAccessProfileView();
        return ResponseEntity.ok(service.getRoles(page, limit, search, type, status, sortBy, sortDirection));
    }

    @GetMapping("/roles/{id}")
    public ResponseEntity<RoleSummaryResponse> getRole(@PathVariable UUID id) {
        requireAccessProfileView();
        return ResponseEntity.ok(service.getRole(id));
    }

    @GetMapping("/permissions/catalog")
    public ResponseEntity<List<PermissionGroupResponse>> getPermissionCatalog(
            @RequestParam(required = false) String module,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String audit
    ) {
        requireAccessProfileView();
        return ResponseEntity.ok(service.getPermissionCatalog(module, search, audit));
    }

    @PostMapping("/roles")
    public ResponseEntity<RoleSummaryResponse> createRole(@Valid @RequestBody RoleUpsertRequest request, HttpServletRequest httpRequest) {
        requireAccessProfileUpdate();
        return ResponseEntity.ok(service.createRole(request, httpRequest));
    }

    @PutMapping("/roles/{id}")
    public ResponseEntity<RoleSummaryResponse> updateRole(@PathVariable UUID id, @Valid @RequestBody RoleUpsertRequest request, HttpServletRequest httpRequest) {
        requireAccessProfileUpdate();
        return ResponseEntity.ok(service.updateRole(id, request, httpRequest));
    }

    @DeleteMapping("/roles/{id}")
    public ResponseEntity<Void> deleteRole(@PathVariable UUID id, HttpServletRequest httpRequest) {
        requireAccessProfileUpdate();
        service.deleteRole(id, httpRequest);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/roles/{id}/permissions")
    public ResponseEntity<RoleSummaryResponse> updateRolePermissions(@PathVariable UUID id, @Valid @RequestBody RolePermissionsUpdateRequest request, HttpServletRequest httpRequest) {
        requireAccessProfileUpdate();
        return ResponseEntity.ok(service.updateRolePermissions(id, request, httpRequest));
    }

    @GetMapping("/document-administration")
    public ResponseEntity<DocumentAdministrationResponse> getDocumentAdministration() {
        requireDocumentAdminView();
        return ResponseEntity.ok(service.getDocumentAdministration());
    }

    @GetMapping("/document-administration/users")
    public ResponseEntity<PageResponse<UserManagementResponse>> getDocumentAdministrationUsers(
            @RequestParam String pool,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int limit,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "fullName") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDirection
    ) {
        requireDocumentAdminView();
        return ResponseEntity.ok(service.getDocumentAdministrationUsers(pool, page, limit, search, sortBy, sortDirection));
    }

    @PutMapping("/document-administration")
    public ResponseEntity<DocumentAdministrationResponse> updateDocumentAdministration(@Valid @RequestBody DocumentAdministrationRequest request, HttpServletRequest httpRequest) {
        requireDocumentAdminManage();
        return ResponseEntity.ok(service.updateDocumentAdministration(request, httpRequest));
    }

    @GetMapping("/departments")
    public ResponseEntity<List<LookupItemResponse>> getDepartments() {
        return ResponseEntity.ok(service.getDepartments());
    }

    @GetMapping("/business-units")
    public ResponseEntity<List<LookupItemResponse>> getBusinessUnits() {
        return ResponseEntity.ok(service.getBusinessUnits());
    }

    @GetMapping("/positions")
    public ResponseEntity<List<LookupItemResponse>> getPositions() {
        return ResponseEntity.ok(service.getPositions());
    }

    @GetMapping("/system")
    public ResponseEntity<SystemConfigurationResponse> getSystemConfiguration() {
        requireConfigurationView();
        return ResponseEntity.ok(systemConfigurationService.getConfiguration());
    }

    @PostMapping("/users/{id}/external-invitation")
    public ResponseEntity<ExternalIdentityProvisioningResponse> inviteExternalUser(@PathVariable UUID id, @Valid @RequestBody ExternalIdentityActionRequest request) {
        return ResponseEntity.accepted().body(externalIdentityProvisioningService.invite(id, request.reason(), false));
    }

    @PostMapping("/users/{id}/external-invitation/resend")
    public ResponseEntity<ExternalIdentityProvisioningResponse> resendExternalInvitation(@PathVariable UUID id, @Valid @RequestBody ExternalIdentityActionRequest request) {
        return ResponseEntity.accepted().body(externalIdentityProvisioningService.invite(id, request.reason(), true));
    }

    @PostMapping("/users/{id}/external-invitation/retry")
    public ResponseEntity<ExternalIdentityProvisioningResponse> retryExternalInvitation(@PathVariable UUID id, @Valid @RequestBody ExternalIdentityActionRequest request) {
        return ResponseEntity.accepted().body(externalIdentityProvisioningService.retry(id, request.reason()));
    }

    @GetMapping("/users/{id}/external-provisioning")
    public ResponseEntity<ExternalIdentityProvisioningResponse> externalProvisioning(@PathVariable UUID id) {
        return ResponseEntity.ok(externalIdentityProvisioningService.get(id));
    }

    @PostMapping("/users/{id}/microsoft-access/disable")
    public ResponseEntity<ExternalIdentityProvisioningResponse> disableMicrosoftAccess(@PathVariable UUID id, @Valid @RequestBody ExternalIdentityActionRequest request) {
        return ResponseEntity.accepted().body(externalIdentityProvisioningService.disable(id, request));
    }

    @PostMapping("/users/{id}/external-identity/remove")
    public ResponseEntity<ExternalIdentityProvisioningResponse> removeExternalIdentity(@PathVariable UUID id, @Valid @RequestBody ExternalIdentityActionRequest request) {
        return ResponseEntity.accepted().body(externalIdentityProvisioningService.remove(id, request));
    }

    @GetMapping("/system/storage-path-preview")
    public ResponseEntity<StoragePathPreviewResponse> getStoragePathPreview() {
        requireConfigurationView();
        return ResponseEntity.ok(systemConfigurationService.getStoragePathPreview());
    }

    @PutMapping("/system")
    public ResponseEntity<SystemConfigurationResponse> updateSystemConfiguration(@RequestBody SystemConfigurationRequest request, HttpServletRequest httpRequest) {
        requireConfigurationEdit();
        return ResponseEntity.ok(systemConfigurationService.updateConfiguration(request));
    }

    @PostMapping("/system/office-online/test-connection")
    public ResponseEntity<OfficeOnlineConnectionTestResponse> testOfficeOnlineConnection(
            @RequestBody OfficeOnlineConfigurationTestRequest request
    ) throws java.io.IOException {
        requireConfigurationEdit();
        var resolved = officeOnlineConfigurationService.mergeRequestWithExisting(request);
        microsoftGraphOfficeOnlineService.testConnection(resolved);
        microsoftGraphOfficeOnlineService.testTemporarySharingCapabilities(resolved);
        String sharingMessage = "users".equalsIgnoreCase(resolved.shareLinkScope())
                ? "Named-user Office Online access is configured. Upload and direct item access were verified; recipient permission delivery is verified when an assigned workflow user opens a revision."
                : "Organization-scoped Office Online upload and sharing were verified.";
        return ResponseEntity.ok(new OfficeOnlineConnectionTestResponse(
                true,
                "Office Online workspace connection and upload test successful. " + sharingMessage + " Review-link delivery still requires a real assigned user test.",
                resolved.siteId(),
                resolved.driveId(),
                resolved.libraryFolder()
        ));
    }

    @GetMapping("/system/office-online")
    public ResponseEntity<OfficeOnlineConfigurationService.OfficeOnlineConfiguration> getOfficeOnlineConfiguration() {
        requireConfigurationView();
        return ResponseEntity.ok(systemConfigurationService.getOfficeOnlineConfiguration());
    }

    @PutMapping("/system/office-online")
    public ResponseEntity<OfficeOnlineConfigurationService.OfficeOnlineConfiguration> updateOfficeOnlineConfiguration(
            @RequestBody OfficeOnlineConfigurationTestRequest request) {
        requireConfigurationEdit();
        return ResponseEntity.ok(systemConfigurationService.updateOfficeOnlineConfiguration(request));
    }

    @GetMapping("/system/office-online/health")
    public ResponseEntity<OfficeOnlineHealthResponse> officeOnlineHealth() {
        requireConfigurationView();
        String checkedAt = java.time.Instant.now().toString();
        var config = officeOnlineConfigurationService.getEffectiveConfiguration();
        try {
            microsoftGraphOfficeOnlineService.testConnection(config);
            microsoftGraphOfficeOnlineService.testTemporarySharingCapabilities();
            return ResponseEntity.ok(new OfficeOnlineHealthResponse("HEALTHY", "Graph, SharePoint drive, upload, and item sharing are reachable. Review-link recipient delivery still requires a real user test.", true, true, true, checkedAt));
        } catch (Exception ex) {
            return ResponseEntity.ok(new OfficeOnlineHealthResponse("UNHEALTHY", ex.getMessage(), false, false, false, checkedAt));
        }
    }

    @PostMapping("/system/storage/test-connection")
    public ResponseEntity<StorageConnectionTestResponse> testStorageConnection(
            @RequestBody com.fasterxml.jackson.databind.JsonNode request
    ) {
        requireConfigurationEdit();
        try {
            fileStorageService.testConnection(request);
            return ResponseEntity.ok(new StorageConnectionTestResponse(true, localizedMessage("settings.storage_connection_success")));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new StorageConnectionTestResponse(false, localizedMessage("settings.storage_connection_invalid")));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(new StorageConnectionTestResponse(false, localizedMessage("settings.storage_connection_failed")));
        }
    }

    @PostMapping("/system/smtp/test-connection")
    public ResponseEntity<SmtpConnectionTestResponse> testSmtpConnection(
            @Valid @RequestBody SmtpConnectionTestRequest request
    ) {
        requireConfigurationEdit();
        try {
            emailService.testConnection(request);
            return ResponseEntity.ok(new SmtpConnectionTestResponse(true, localizedMessage("settings.smtp_connection_success")));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new SmtpConnectionTestResponse(false, localizedMessage("settings.smtp_connection_invalid")));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(new SmtpConnectionTestResponse(false, localizedMessage("settings.smtp_connection_failed")));
        }
    }

    @GetMapping("/system/office-online/browse-folders")
    public ResponseEntity<java.util.List<com.eqms.dto.user.FolderBrowseResponse>> browseSharePointFolders(
            @RequestParam(required = false, defaultValue = "") String path
    ) throws java.io.IOException {
        requireConfigurationEdit();
        java.util.List<MicrosoftGraphOfficeOnlineService.FolderItem> folders =
                microsoftGraphOfficeOnlineService.browseFolders(path);
        java.util.List<com.eqms.dto.user.FolderBrowseResponse> response = folders.stream()
                .map(f -> new com.eqms.dto.user.FolderBrowseResponse(f.id(), f.name(), f.path(), f.webUrl()))
                .toList();
        return ResponseEntity.ok(response);
    }

    @GetMapping("/users/{id}/education")
    public ResponseEntity<List<EducationResponse>> getEducation(@PathVariable UUID id) {
        requireUserView();
        return ResponseEntity.ok(service.getEducations(id));
    }

    @PostMapping("/users/{id}/education")
    public ResponseEntity<EducationResponse> addEducation(@PathVariable UUID id, @Valid @RequestBody EducationRequest request) {
        requireUserEdit();
        return ResponseEntity.ok(service.addEducation(id, request));
    }

    @PutMapping("/users/{id}/education/{educationId}")
    public ResponseEntity<EducationResponse> updateEducation(@PathVariable UUID id, @PathVariable UUID educationId, @Valid @RequestBody EducationRequest request) {
        requireUserEdit();
        return ResponseEntity.ok(service.updateEducation(id, educationId, request));
    }

    @DeleteMapping("/users/{id}/education/{educationId}")
    public ResponseEntity<Void> deleteEducation(@PathVariable UUID id, @PathVariable UUID educationId) {
        requireUserEdit();
        service.deleteEducation(id, educationId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/users/{id}/certifications")
    public ResponseEntity<List<CertificationResponse>> getCertifications(@PathVariable UUID id) {
        requireUserView();
        return ResponseEntity.ok(service.getCertifications(id));
    }

    @PostMapping("/users/{id}/certifications")
    public ResponseEntity<CertificationResponse> addCertification(@PathVariable UUID id, @Valid @RequestBody CertificationRequest request) {
        requireUserEdit();
        return ResponseEntity.ok(service.addCertification(id, request));
    }

    private void requireUserView() {
        var user = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.hasPermission(user, "settings.user.view")) {
            throw new org.springframework.security.access.AccessDeniedException("Current user is not allowed to view user accounts");
        }
    }

    private void requireUserCreate() {
        var user = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.hasPermission(user, "settings.user.create")) {
            throw new org.springframework.security.access.AccessDeniedException("Current user is not allowed to create user accounts");
        }
    }

    private void requireUserEdit() {
        var user = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.hasPermission(user, "settings.user.edit")) {
            throw new org.springframework.security.access.AccessDeniedException("Current user is not allowed to edit user accounts");
        }
    }

    private void requireUserResetPassword() {
        var user = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.hasPermission(user, "settings.user.reset_password")) {
            throw new org.springframework.security.access.AccessDeniedException("Current user is not allowed to reset another user's password");
        }
    }

    private void requireUserForceLogout() {
        var user = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.hasPermission(user, "settings.user.force_logout")) {
            throw new org.springframework.security.access.AccessDeniedException("Current user is not allowed to force logout another user");
        }
    }

    private void requireAccessProfileView() {
        var user = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.hasPermission(user, "security.access_profiles.view")) {
            throw new org.springframework.security.access.AccessDeniedException("Current user is not allowed to view access profiles");
        }
    }

    private void requireAccessProfileUpdate() {
        var user = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.hasPermission(user, "security.access_profiles.update")) {
            throw new org.springframework.security.access.AccessDeniedException("Current user is not allowed to manage access profiles");
        }
    }

    private void requireAccessProfileAssign() {
        var user = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.hasPermission(user, "security.access_profiles.assign")) {
            throw new org.springframework.security.access.AccessDeniedException("Current user is not allowed to assign access profiles");
        }
    }

    private void requireDocumentAdminView() {
        var user = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.hasPermission(user, "documents.admin.view")) {
            throw new org.springframework.security.access.AccessDeniedException("Current user is not allowed to view document administration");
        }
    }

    private void requireDocumentAdminManage() {
        var user = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.hasPermission(user, "documents.admin.manage_workflow_roles")) {
            throw new org.springframework.security.access.AccessDeniedException("Current user is not allowed to manage document administration");
        }
    }

    private void requireConfigurationView() {
        var user = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.hasPermission(user, "settings.configuration.view")) {
            throw new org.springframework.security.access.AccessDeniedException("Current user is not allowed to view system configuration");
        }
    }

    private String localizedMessage(String key) {
        Locale requested = LocaleContextHolder.getLocale();
        Locale supported = "vi".equalsIgnoreCase(requested.getLanguage())
                ? Locale.forLanguageTag("vi")
                : Locale.ENGLISH;
        try {
            return ResourceBundle.getBundle("messages", supported).getString(key);
        } catch (MissingResourceException ignored) {
            return key;
        }
    }

    private void requireConfigurationEdit() {
        var user = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.hasPermission(user, "settings.configuration.edit")) {
            throw new org.springframework.security.access.AccessDeniedException("Current user is not allowed to edit system configuration");
        }
    }

    @PutMapping("/users/{id}/certifications/{certificationId}")
    public ResponseEntity<CertificationResponse> updateCertification(@PathVariable UUID id, @PathVariable UUID certificationId, @Valid @RequestBody CertificationRequest request) {
        requireUserEdit();
        return ResponseEntity.ok(service.updateCertification(id, certificationId, request));
    }

    @DeleteMapping("/users/{id}/certifications/{certificationId}")
    public ResponseEntity<Void> deleteCertification(@PathVariable UUID id, @PathVariable UUID certificationId) {
        requireUserEdit();
        service.deleteCertification(id, certificationId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/users/{id}/certifications/{certificationId}/file")
    public ResponseEntity<CertificationResponse> uploadCertificationFile(
            @PathVariable UUID id, @PathVariable UUID certificationId,
            @RequestParam("file") org.springframework.web.multipart.MultipartFile file) {
        requireUserEdit();
        return ResponseEntity.ok(service.uploadCertificationFile(id, certificationId, file));
    }

    @GetMapping("/users/{id}/certifications/{certificationId}/file")
    public ResponseEntity<byte[]> downloadCertificationFile(@PathVariable UUID id, @PathVariable UUID certificationId) {
        requireUserView();
        var download = service.downloadCertificationFile(id, certificationId);
        org.springframework.http.MediaType mediaType;
        try {
            mediaType = org.springframework.util.StringUtils.hasText(download.contentType())
                    ? org.springframework.http.MediaType.parseMediaType(download.contentType())
                    : org.springframework.http.MediaType.APPLICATION_OCTET_STREAM;
        } catch (Exception ex) {
            mediaType = org.springframework.http.MediaType.APPLICATION_OCTET_STREAM;
        }
        return ResponseEntity.ok()
                .contentType(mediaType)
                .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION,
                        "inline; filename=\"" + (download.fileName() == null ? "certificate" : download.fileName()) + "\"")
                .body(download.content());
    }
}
