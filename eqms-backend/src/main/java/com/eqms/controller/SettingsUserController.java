package com.eqms.controller;

import com.eqms.dto.user.*;
import com.eqms.auth.CurrentUserService;
import com.eqms.service.PermissionEvaluationService;
import com.eqms.service.UserManagementService;
import com.eqms.service.TimeLimitedUserGrantService;
import com.eqms.service.SystemConfigurationService;
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

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/settings")
public class SettingsUserController {

    private final UserManagementService service;
    private final TimeLimitedUserGrantService timeLimitedUserGrantService;
    private final SystemConfigurationService systemConfigurationService;
    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissionEvaluationService;
    private final FileStorageService fileStorageService;
    private final EmailService emailService;
    private final ExternalIdentityProvisioningService externalIdentityProvisioningService;

    public SettingsUserController(
            UserManagementService service,
            TimeLimitedUserGrantService timeLimitedUserGrantService,
            SystemConfigurationService systemConfigurationService,
            CurrentUserService currentUserService,
            PermissionEvaluationService permissionEvaluationService,
            FileStorageService fileStorageService,
            EmailService emailService,
            ExternalIdentityProvisioningService externalIdentityProvisioningService
    ) {
        this.service = service;
        this.timeLimitedUserGrantService = timeLimitedUserGrantService;
        this.systemConfigurationService = systemConfigurationService;
        this.currentUserService = currentUserService;
        this.permissionEvaluationService = permissionEvaluationService;
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

    @GetMapping("/users/manager-options")
    public ResponseEntity<List<LookupItemResponse>> getManagerOptions() {
        requireUserView();
        return ResponseEntity.ok(service.getManagerOptions());
    }

    @GetMapping("/users/next-employee-code")
    public ResponseEntity<String> getNextEmployeeCode() {
        requireUserView();
        return ResponseEntity.ok(service.getNextEmployeeCodeSuggestion());
    }

    @GetMapping("/users/{id}")
    public ResponseEntity<UserManagementResponse> getUser(
            @PathVariable UUID id,
            @RequestParam(defaultValue = "true") boolean includeDetails
    ) {
        requireUserView();
        return ResponseEntity.ok(service.getUser(id, includeDetails));
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
    public ResponseEntity<UnlockAccountResponse> unlockUser(@PathVariable UUID id, @RequestBody UnlockUserRequest request, HttpServletRequest httpRequest) {
        requireUserEdit();
        return ResponseEntity.ok(service.unlockUser(id, request, httpRequest));
    }

    @PostMapping("/users/{id}/force-logout")
    public ResponseEntity<Void> forceLogout(@PathVariable UUID id, @Valid @RequestBody ForceLogoutRequest request, HttpServletRequest httpRequest) {
        requireUserForceLogout();
        service.forceLogout(id, request, httpRequest);
        return ResponseEntity.noContent().build();
    }

    /** "Logged in Users" admin screen. View-only -- same requireUserView() gate as the User
     *  Management list; the Force Logout action on a row calls the existing
     *  /users/{id}/force-logout endpoint above, not a new one. Search/sort/pagination all happen
     *  server-side, mirroring GET /users above -- the FE only renders what comes back. */
    @GetMapping("/users/sessions")
    public ResponseEntity<PageResponse<LoggedInSessionResponse>> getLoggedInSessions(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int limit,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "lastActivityAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDirection,
            @RequestParam(required = false) String lastLoginFrom,
            @RequestParam(required = false) String lastLoginTo,
            @RequestParam(required = false) String sessionStartedFrom,
            @RequestParam(required = false) String sessionStartedTo,
            @RequestParam(required = false) String lastActivityFrom,
            @RequestParam(required = false) String lastActivityTo
    ) {
        requireUserView();
        return ResponseEntity.ok(service.getLoggedInSessions(
                page, limit, search, sortBy, sortDirection,
                lastLoginFrom, lastLoginTo, sessionStartedFrom, sessionStartedTo, lastActivityFrom, lastActivityTo
        ));
    }

    /** "Time-Limited User" admin screen. Search/sort/pagination/filter all happen server-side;
     *  one row per grant, never merged even when several were created together. */
    @GetMapping("/users/time-limited-grants")
    public ResponseEntity<com.eqms.dto.user.PageResponse<com.eqms.dto.user.TimeLimitedUserGrantResponse>> getTimeLimitedGrants(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int limit,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDirection,
            @RequestParam(required = false) String startDateFrom,
            @RequestParam(required = false) String startDateTo,
            @RequestParam(required = false) String endDateFrom,
            @RequestParam(required = false) String endDateTo,
            @RequestParam(required = false) String createdFrom,
            @RequestParam(required = false) String createdTo
    ) {
        requireUserView();
        return ResponseEntity.ok(timeLimitedUserGrantService.getGrants(
                page, limit, search, status, sortBy, sortDirection,
                startDateFrom, startDateTo, endDateFrom, endDateTo, createdFrom, createdTo
        ));
    }

    @GetMapping("/users/time-limited-grants/{id}")
    public ResponseEntity<com.eqms.dto.user.TimeLimitedUserGrantResponse> getTimeLimitedGrant(@PathVariable UUID id) {
        requireUserView();
        return ResponseEntity.ok(timeLimitedUserGrantService.getGrant(id));
    }

    @PostMapping("/users/time-limited-grants")
    public ResponseEntity<List<com.eqms.dto.user.TimeLimitedUserGrantResponse>> createTimeLimitedGrants(
            @Valid @RequestBody com.eqms.dto.user.CreateTimeLimitedUserGrantRequest request, HttpServletRequest httpRequest) {
        requireUserEdit();
        return ResponseEntity.ok(timeLimitedUserGrantService.createGrants(request, httpRequest));
    }

    @PutMapping("/users/time-limited-grants/{id}")
    public ResponseEntity<com.eqms.dto.user.TimeLimitedUserGrantResponse> updateTimeLimitedGrant(
            @PathVariable UUID id, @Valid @RequestBody com.eqms.dto.user.UpdateTimeLimitedUserGrantRequest request,
            HttpServletRequest httpRequest) {
        requireUserEdit();
        return ResponseEntity.ok(timeLimitedUserGrantService.updateGrant(id, request, httpRequest));
    }

    @PostMapping("/users/time-limited-grants/{id}/cancel")
    public ResponseEntity<com.eqms.dto.user.TimeLimitedUserGrantResponse> cancelTimeLimitedGrant(
            @PathVariable UUID id, @Valid @RequestBody com.eqms.dto.user.CancelTimeLimitedUserGrantRequest request, HttpServletRequest httpRequest) {
        requireUserEdit();
        return ResponseEntity.ok(timeLimitedUserGrantService.cancelGrant(id, request, httpRequest));
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

    @GetMapping("/permissions/catalog")
    public ResponseEntity<List<PermissionGroupResponse>> getPermissionCatalog(
            @RequestParam(required = false) String module,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String audit
    ) {
        requireAccessProfileView();
        return ResponseEntity.ok(service.getPermissionCatalog(module, search, audit));
    }

    @GetMapping("/document-administration")
    public ResponseEntity<DocumentAdministrationResponse> getDocumentAdministration() {
        requireDocumentAdminView();
        return ResponseEntity.ok(service.getDocumentAdministration());
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

    // Deliberately no permission gate: the Documents section (retention days, watermark,
    // versioning rules, max upload size, ...) is operational policy every document-module user
    // needs client-side -- e.g. to enforce the upload size limit while creating a document. It
    // holds no credentials or security thresholds (those stay behind /system above). Splitting
    // this out avoids reusing settings.configuration.view (an admin-only Settings permission) to
    // gate a read that ordinary document creation legitimately depends on.
    @GetMapping("/system/documents")
    public ResponseEntity<com.fasterxml.jackson.databind.JsonNode> getDocumentsOperationalConfig() {
        return ResponseEntity.ok(systemConfigurationService.requireConfiguration().getDocumentsConfig());
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

    // Dedicated Document Properties read/write, scoped to only the `documents` config section --
    // deliberately NOT reusing the /system endpoints above. Those return/accept the FULL
    // configuration object (general/security/documents/notifications/integrations/features),
    // including integrations credentials (masked, but still structurally present); gating that
    // shared endpoint with the narrower documents.admin.properties.* permission would let a
    // Document Properties-only user read/influence unrelated sensitive sections. Fixes a
    // pre-existing mismatch where the Document Properties screen's FE gated itself on
    // documents.admin.manage while the /system endpoint it actually called enforced
    // settings.configuration.manage.
    @GetMapping("/system/document-properties")
    public ResponseEntity<com.fasterxml.jackson.databind.JsonNode> getDocumentPropertiesConfig() {
        requireDocumentPropertiesView();
        return ResponseEntity.ok(systemConfigurationService.requireConfiguration().getDocumentsConfig());
    }

    @PutMapping("/system/document-properties")
    public ResponseEntity<com.fasterxml.jackson.databind.JsonNode> updateDocumentPropertiesConfig(
            @RequestBody com.fasterxml.jackson.databind.JsonNode documents
    ) {
        requireDocumentPropertiesManage();
        com.fasterxml.jackson.databind.JsonNode basis = documents == null ? null : documents.get("effectiveDateBasis");
        if (basis != null && !basis.isNull() && !java.util.Set.of("AFTER_APPROVAL", "AFTER_TRAINING", "AFTER_PUBLISH").contains(basis.asText())) {
            throw new IllegalArgumentException("Effective Date basis must be AFTER_APPROVAL, AFTER_TRAINING or AFTER_PUBLISH");
        }
        com.fasterxml.jackson.databind.JsonNode offset = documents == null ? null : documents.get("effectiveDateOffsetDays");
        if (offset != null && !offset.isNull() && (!offset.canConvertToInt() || offset.asInt() < 0 || offset.asInt() > 365)) {
            throw new IllegalArgumentException("Effective Date offset must be between 0 and 365 days");
        }
        SystemConfigurationResponse updated = systemConfigurationService.updateConfiguration(
                new SystemConfigurationRequest(null, null, documents, null, null, null));
        return ResponseEntity.ok(updated.documents());
    }

    @org.springframework.beans.factory.annotation.Autowired
    private com.eqms.service.OnlyOfficeConfigurationService onlyOfficeConfigurationService;

    @GetMapping("/system/onlyoffice")
    public ResponseEntity<com.eqms.service.OnlyOfficeConfigurationService.OnlyOfficeConfiguration> getOnlyOfficeConfiguration() {
        requireConfigurationView();
        return ResponseEntity.ok(onlyOfficeConfigurationService.getConfigurationForResponse());
    }

    /**
     * Pings the document server's own {@code /healthcheck} endpoint using the currently saved
     * configuration (there is no separate "unsaved draft" test here, unlike Graph's test-connection,
     * since OnlyOffice's config has no external tenant/credential round-trip to validate beyond
     * reachability -- save the config first, then test).
     */
    @PostMapping("/system/onlyoffice/test-connection")
    public ResponseEntity<java.util.Map<String, Object>> testOnlyOfficeConnection() {
        requireConfigurationEdit();
        var config = onlyOfficeConfigurationService.getEffectiveConfiguration();
        if (!config.enabled() || !org.springframework.util.StringUtils.hasText(config.documentServerUrl())) {
            return ResponseEntity.ok(java.util.Map.of("success", false, "message", "OnlyOffice is not enabled or the Document Server URL is not configured."));
        }
        try {
            // OnlyOffice's bundled nginx does not handle a plaintext HTTP/2 upgrade attempt
            // cleanly (returns 502) -- java.net.http.HttpClient defaults to trying HTTP/2 first,
            // unlike curl, which is why a manual curl to the same URL succeeds while this call
            // failed. Force HTTP/1.1 to match how every other call in this codebase (and OnlyOffice
            // Document Server's own expectations) actually talks to it.
            var client = java.net.http.HttpClient.newBuilder()
                    .version(java.net.http.HttpClient.Version.HTTP_1_1)
                    .connectTimeout(java.time.Duration.ofSeconds(10))
                    .build();
            var request = java.net.http.HttpRequest.newBuilder(java.net.URI.create(config.documentServerUrl() + "/healthcheck"))
                    .timeout(java.time.Duration.ofSeconds(10))
                    .GET()
                    .build();
            var response = client.send(request, java.net.http.HttpResponse.BodyHandlers.ofString());
            boolean healthy = response.statusCode() == 200 && response.body() != null && response.body().toLowerCase().contains("true");
            return ResponseEntity.ok(java.util.Map.of(
                    "success", healthy,
                    "message", healthy
                            ? "OnlyOffice Document Server is reachable and healthy."
                            : "OnlyOffice Document Server responded but did not report healthy (HTTP " + response.statusCode() + ")."
            ));
        } catch (Exception ex) {
            return ResponseEntity.ok(java.util.Map.of(
                    "success", false,
                    "message", "Unable to reach the OnlyOffice Document Server: " + ex.getMessage()
            ));
        }
    }

    @PostMapping("/system/storage/test-connection")
    public ResponseEntity<StorageConnectionTestResponse> testStorageConnection(
            @RequestBody com.fasterxml.jackson.databind.JsonNode request
    ) {
        requireConfigurationEdit();
        try {
            fileStorageService.testConnection(request);
            return ResponseEntity.ok(new StorageConnectionTestResponse(true, "Storage connection test successful."));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new StorageConnectionTestResponse(false, e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(new StorageConnectionTestResponse(false, "Storage connection test failed: " + e.getMessage()));
        }
    }

    @PostMapping("/system/smtp/test-connection")
    public ResponseEntity<SmtpConnectionTestResponse> testSmtpConnection(
            @Valid @RequestBody SmtpConnectionTestRequest request
    ) {
        requireConfigurationEdit();
        try {
            emailService.testConnection(request);
            return ResponseEntity.ok(new SmtpConnectionTestResponse(true, "SMTP connection test successful."));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new SmtpConnectionTestResponse(false, e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(new SmtpConnectionTestResponse(false, "SMTP connection test failed: " + e.getMessage()));
        }
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

    private void requireDocumentPropertiesView() {
        var user = currentUserService.requireCurrentUser();
        boolean allowed = permissionEvaluationService.hasAnyPermission(user,
                "documents.admin.properties.view", "documents.admin.properties.manage",
                "settings.configuration.view", "settings.configuration.manage");
        if (!allowed) {
            throw new org.springframework.security.access.AccessDeniedException("Current user is not allowed to view document properties");
        }
    }

    private void requireDocumentPropertiesManage() {
        var user = currentUserService.requireCurrentUser();
        boolean allowed = permissionEvaluationService.hasAnyPermission(user,
                "documents.admin.properties.manage", "settings.configuration.manage");
        if (!allowed) {
            throw new org.springframework.security.access.AccessDeniedException("Current user is not allowed to manage document properties");
        }
    }

    private void requireConfigurationView() {
        var user = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.hasPermission(user, "settings.configuration.view")) {
            throw new org.springframework.security.access.AccessDeniedException("Current user is not allowed to view system configuration");
        }
    }

    private void requireConfigurationEdit() {
        var user = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.hasPermission(user, "settings.configuration.manage")) {
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
