package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.auth.TokenService;
import com.eqms.auth.UnauthorizedException;
import com.eqms.config.WorkflowPoolTypes;
import com.eqms.dto.user.*;
import com.eqms.entity.*;
import com.eqms.repository.*;
import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.util.DateTimeFormatUtils;
import com.eqms.util.PagedList;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.transaction.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.Comparator;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class UserManagementService {

    private static final Logger log = LoggerFactory.getLogger(UserManagementService.class);

    /** SUSPEND/TERMINATE/DELETE cannot target the caller's own account, and cannot be applied to
     * the last remaining Active holder of {@code settings.user.edit} -- see
     * {@link #isSelfTargetingBlocked} / {@link #checkLastActiveAdminGuard}. */
    private static final Set<String> SELF_TARGET_GUARDED_ACTIONS = Set.of("SUSPEND", "TERMINATE", "DELETE");

    private static final String ACTION_USER_CREATED = "USER_CREATED";
    private static final String ACTION_USER_UPDATED = "USER_UPDATED";
    private static final String ACTION_USER_DELETED = "USER_DELETED";
    private static final String ACTION_USER_SUSPENDED = "USER_SUSPENDED";
    private static final String ACTION_USER_TERMINATED = "USER_TERMINATED";
    private static final String ACTION_USER_REINSTATED = "USER_REINSTATED";
    private static final String ACTION_USER_PASSWORD_RESET = "USER_PASSWORD_RESET";
    private static final String ACTION_USER_UNLOCKED = "USER_UNLOCKED";
    private static final String ACTION_USER_FORCE_LOGOUT = "USER_FORCE_LOGOUT";
    private static final String ACTION_USER_ROLE_UPDATED = "USER_ROLE_UPDATED";
    private static final String ACTION_USER_EDUCATION_ADDED = "USER_EDUCATION_ADDED";
    private static final String ACTION_USER_EDUCATION_UPDATED = "USER_EDUCATION_UPDATED";
    private static final String ACTION_USER_EDUCATION_DELETED = "USER_EDUCATION_DELETED";
    private static final String ACTION_USER_CERTIFICATION_ADDED = "USER_CERTIFICATION_ADDED";
    private static final String ACTION_USER_CERTIFICATION_UPDATED = "USER_CERTIFICATION_UPDATED";
    private static final String ACTION_USER_CERTIFICATION_DELETED = "USER_CERTIFICATION_DELETED";
    private static final String ACTION_ROLE_CREATED = "ROLE_CREATED";
    private static final String ACTION_ROLE_UPDATED = "ROLE_UPDATED";
    private static final String ACTION_ROLE_DELETED = "ROLE_DELETED";
    private static final String ACTION_ROLE_PERMISSIONS_UPDATED = "ROLE_PERMISSIONS_UPDATED";
    private static final String ACTION_DOCUMENT_ADMINISTRATION_UPDATED = "DOCUMENT_ADMINISTRATION_UPDATED";

    private final UserAccountRepository userRepository;
    private final UserEducationRepository educationRepository;
    private final UserCertificationRepository certificationRepository;
    private final BusinessUnitRepository businessUnitRepository;
    private final DepartmentRepository departmentRepository;
    private final PositionRepository positionRepository;
    private final UserLanguageRepository userLanguageRepository;
    private final RoleDefinitionRepository roleRepository;
    private final PermissionRepository permissionRepository;
    private final RolePermissionRepository rolePermissionRepository;
    private final PermissionEvaluationService permissionEvaluationService;
    private final DocumentWorkflowSettingRepository documentWorkflowSettingRepository;
    private final DocumentWorkflowPoolMemberRepository documentWorkflowPoolMemberRepository;
    private final AuthSessionRepository sessionRepository;
    private final AuthAuditService auditService;
    private final CurrentUserService currentUserService;
    private final TokenService tokenService;
    private final org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;
    private final AuditTrailService auditTrailService;
    private final SystemConfigurationService systemConfigurationService;
    private final ExternalIdentityProvisioningService externalIdentityProvisioningService;
    private final com.eqms.service.authorization.AuthorizationEngineService authorizationEngineService;
    private final FileStorageService fileStorageService;
    private final NotificationDispatcher notificationDispatcher;

    public UserManagementService(
            UserAccountRepository userRepository,
            UserEducationRepository educationRepository,
            UserCertificationRepository certificationRepository,
            BusinessUnitRepository businessUnitRepository,
            DepartmentRepository departmentRepository,
            PositionRepository positionRepository,
            UserLanguageRepository userLanguageRepository,
            RoleDefinitionRepository roleRepository,
            PermissionRepository permissionRepository,
            RolePermissionRepository rolePermissionRepository,
            PermissionEvaluationService permissionEvaluationService,
            DocumentWorkflowSettingRepository documentWorkflowSettingRepository,
            DocumentWorkflowPoolMemberRepository documentWorkflowPoolMemberRepository,
            AuthSessionRepository sessionRepository,
            AuthAuditService auditService,
            CurrentUserService currentUserService,
            TokenService tokenService,
            org.springframework.security.crypto.password.PasswordEncoder passwordEncoder,
            AuditTrailService auditTrailService,
            SystemConfigurationService systemConfigurationService,
            ExternalIdentityProvisioningService externalIdentityProvisioningService,
            FileStorageService fileStorageService,
            @org.springframework.context.annotation.Lazy com.eqms.service.authorization.AuthorizationEngineService authorizationEngineService,
            NotificationDispatcher notificationDispatcher
    ) {
        this.userRepository = userRepository;
        this.educationRepository = educationRepository;
        this.certificationRepository = certificationRepository;
        this.businessUnitRepository = businessUnitRepository;
        this.departmentRepository = departmentRepository;
        this.positionRepository = positionRepository;
        this.userLanguageRepository = userLanguageRepository;
        this.roleRepository = roleRepository;
        this.permissionRepository = permissionRepository;
        this.rolePermissionRepository = rolePermissionRepository;
        this.permissionEvaluationService = permissionEvaluationService;
        this.documentWorkflowSettingRepository = documentWorkflowSettingRepository;
        this.documentWorkflowPoolMemberRepository = documentWorkflowPoolMemberRepository;
        this.sessionRepository = sessionRepository;
        this.auditService = auditService;
        this.currentUserService = currentUserService;
        this.tokenService = tokenService;
        this.passwordEncoder = passwordEncoder;
        this.auditTrailService = auditTrailService;
        this.systemConfigurationService = systemConfigurationService;
        this.externalIdentityProvisioningService = externalIdentityProvisioningService;
        this.fileStorageService = fileStorageService;
        this.authorizationEngineService = authorizationEngineService;
        this.notificationDispatcher = notificationDispatcher;
    }

    public PageResponse<UserManagementResponse> getUsers(
            int page,
            int limit,
            String search,
            String role,
            String status,
            String online,
            String businessUnit,
            String department,
            String position,
            String dateFrom,
            String dateTo,
            String suspendFrom,
            String suspendTo,
            String terminateFrom,
            String terminateTo,
            String sortBy,
            String sortDirection,
            boolean includeTerminated
    ) {
        int safePage = Math.max(page, 1);
        int safeLimit = Math.max(limit, 1);
        String sortProperty = resolveSortProperty(sortBy);
        Sort.Direction direction = "desc".equalsIgnoreCase(sortDirection) ? Sort.Direction.DESC : Sort.Direction.ASC;
        PageRequest pageable = PageRequest.of(safePage - 1, safeLimit, Sort.by(direction, sortProperty));
        Page<UserAccount> result = userRepository.findAll(buildSpecification(
                search, role, status, online, businessUnit, department, position, dateFrom, dateTo, suspendFrom, suspendTo, terminateFrom, terminateTo, includeTerminated
        ), pageable);

        List<UUID> pageUserIds = result.getContent().stream()
                .map(UserAccount::getId)
                .toList();
        Set<UUID> activeSessionUserIds = activeSessionUserIds(pageUserIds);
        Set<UUID> onlineUserIds = onlineSessionUserIds(pageUserIds);
        boolean canViewExternalProvisioning = permissionEvaluationService.hasPermission(
                currentUserService.requireCurrentUser(), "users.view_external_provisioning");
        Map<UUID, ExternalIdentityProvisioningResponse> externalStatuses = canViewExternalProvisioning
                ? externalIdentityProvisioningService.statuses(pageUserIds) : Map.of();

        List<UserManagementResponse> users = result.getContent()
                .stream()
                .map(user -> {
                    ExternalIdentityProvisioningResponse external = externalStatuses.get(user.getId());
                    return toResponse(user, false, activeSessionUserIds.contains(user.getId()), onlineUserIds.contains(user.getId()), external);
                })
                .toList();

        return new PageResponse<>(
                users,
                new PaginationResponse(
                        safePage,
                        safeLimit,
                        result.getTotalElements(),
                        result.getTotalPages()
                )
        );
    }

    public UserManagementResponse getUser(UUID id) {
        UserAccount user = requireUser(id);
        boolean canViewExternalProvisioning = permissionEvaluationService.hasPermission(
                currentUserService.requireCurrentUser(), "users.view_external_provisioning");
        ExternalIdentityProvisioningResponse external = canViewExternalProvisioning
                ? externalIdentityProvisioningService.statuses(List.of(id)).get(id) : null;
        return toResponse(user, true, hasActiveSession(user.getId()), hasOnlineSession(user.getId()), external);
    }

    @Transactional
    public UserCreationResponse createUser(CreateUserRequest request, HttpServletRequest httpRequest) {
        validateCreateRequest(request);
        if (Boolean.TRUE.equals(request.inviteExternal())
                && !permissionEvaluationService.hasPermission(currentUserService.requireCurrentUser(), "users.invite_external")) {
            throw new org.springframework.security.access.AccessDeniedException("Permission required: users.invite_external");
        }
        validateUniqueOnCreate(
                normalizeRequired(request.employeeCode(), "Employee ID"),
                normalizeRequired(request.username(), "Username"),
                normalizeRequired(request.email(), "Email")
        );

        String rawPassword = generatePassword();
        UserAccount user = new UserAccount();
        applyCreateOrUpdate(user, request);
        String encoded = passwordEncoder.encode(rawPassword);
        user.setPasswordHash(encoded);

        // Prepopulate password history
        com.fasterxml.jackson.databind.JsonNode security = systemConfigurationService.requireConfiguration().getSecurityConfig();
        if (security != null) {
            int historyCount = security.path("passwordHistoryCount").asInt(5);
            user.setPasswordHistory(systemConfigurationService.updatePasswordHistory(null, encoded, historyCount));
        }

        // Respect the administrator's Security configuration.  A newly
        // generated password is only treated as temporary when the policy is
        // enabled; previously this was hard-coded and the checkbox had no
        // effect.
        boolean forcePasswordChange = security == null
                || security.path("forcePasswordChangeOnFirstLogin").asBoolean(true);
        user.setMustChangePassword(forcePasswordChange);
        user.setPasswordChangedAt(forcePasswordChange ? null : Instant.now());
        user.setMfaEnabled(false);
        user.setFailedLoginCount(0);
        user.setLockedUntil(null);
        user.setLastLoginAt(null);
        user.setCreatedAt(Instant.now());
        user.setUpdatedAt(Instant.now());
        userRepository.save(user);
        syncPrimaryEducation(user, request.degree(), request.fieldOfStudy(), request.institution(), request.graduationYear(), request.gpa());

        auditService.log("user_created", user, auditDetails(
                "employeeCode", user.getEmployeeCode(),
                "username", user.getUsername(),
                "email", user.getEmail()
        ), clientIp(httpRequest), userAgent(httpRequest));

        auditTrailService.log(
                "USER",
                user.getFullName(),
                user.getId(),
                ACTION_USER_CREATED,
                null,
                user.getStatus() != null ? user.getStatus().name() : "Active",
                "Created user account: " + user.getUsername() + " (" + user.getEmployeeCode() + ")"
        );

        if (Boolean.TRUE.equals(request.inviteExternal())) {
            try {
                externalIdentityProvisioningService.invite(user.getId(), "External user onboarding", false);
            } catch (RuntimeException ignored) {
                // The provisioning record and failure audit are retained so an administrator can retry.
            }
        }

        return new UserCreationResponse(toResponse(user, true), rawPassword);
    }

    @Transactional
    public UserManagementResponse updateUser(UUID id, UpdateUserRequest request, HttpServletRequest httpRequest) {
        UserAccount user = requireUser(id);
        validateUpdateRequest(user, request);
        validateUniqueOnUpdate(
                user,
                request.employeeCode() == null ? null : normalizeRequired(request.employeeCode(), "Employee ID"),
                request.username() == null ? null : normalizeRequired(request.username(), "Username"),
                request.email() == null ? null : normalizeRequired(request.email(), "Email")
        );
        
        List<AuditTrailChangeResponse> changes = detectUserChanges(user, request);
        String previousEmail = user.getEmail();

        applyUpdate(user, request);
        syncPrimaryEducation(user, request.degree(), request.fieldOfStudy(), request.institution(), request.graduationYear(), request.gpa());

        if (request.email() != null && !user.getEmail().equalsIgnoreCase(previousEmail)) {
            externalIdentityProvisioningService.invalidateOnEmailChange(user.getId(), user.getEmail());
        }

        auditService.log("user_updated", user, auditDetails(
                "employeeCode", user.getEmployeeCode(),
                "username", user.getUsername()
        ), clientIp(httpRequest), userAgent(httpRequest));

        auditTrailService.log(
                "USER",
                user.getFullName(),
                user.getId(),
                ACTION_USER_UPDATED,
                null,
                null,
                "Updated user profile for " + user.getFullName(),
                changes
        );

        return toResponse(user, true);
    }

    /**
     * Central chokepoint for every status transition (Q7). Any move away from Active revokes
     * all sessions and evicts the cached permission set immediately, so a suspended/terminated/
     * deactivated user cannot keep acting on a session or permission snapshot issued while they
     * were still Active. {@link com.eqms.auth.AuthTokenFilter} is the runtime enforcement point;
     * this method is what makes that enforcement actually bite the moment status changes.
     */
    private void changeUserStatus(UserAccount user, UserStatus newStatus) {
        UserStatus oldStatus = user.getStatus();
        user.setStatus(newStatus);
        if (oldStatus == UserStatus.Active && newStatus != UserStatus.Active) {
            revokeAllSessions(user.getId());
            try {
                externalIdentityProvisioningService.disableForStatusChange(user.getId());
            } catch (Exception e) {
                log.warn("Failed to disable Microsoft access for user {} on status change: {}", user.getId(), e.getMessage());
            }
        }
        permissionEvaluationService.evictUserPermissionCache(user.getId());
    }

    /**
     * GMP gap fix (SECURITY_AUTHORIZATION_HYBRID_REFACTOR_PLAN.md Phase 4): a user holding
     * {@code settings.user.edit} could previously suspend/terminate/delete their own account
     * (self-escalation risk -- no identity check existed anywhere in the legacy path). Package-
     * visible so {@link UserResourceAdapter} can reuse the exact same rule for shadow-eval, per
     * the "reuse, don't duplicate" pattern established for Document/Revision adapters.
     */
    boolean isSelfTargetingBlocked(UUID actorId, UUID targetId, String actionCode) {
        return SELF_TARGET_GUARDED_ACTIONS.contains(actionCode) && actorId != null && actorId.equals(targetId);
    }

    /**
     * GMP gap fix: suspending/terminating/deleting the last remaining Active holder of
     * {@code settings.user.edit} would leave nobody able to reverse the action (self-lockout).
     * "Admin" is defined by the permission itself, not a display role name, per this project's
     * "never hard-code role names" rule. Package-visible for {@link UserResourceAdapter} reuse.
     */
    Optional<String> checkLastActiveAdminGuard(UUID targetId, String actionCode) {
        if (!SELF_TARGET_GUARDED_ACTIONS.contains(actionCode) || targetId == null) {
            return Optional.empty();
        }
        UserAccount target = userRepository.findById(targetId).orElse(null);
        if (target == null || target.getStatus() != UserStatus.Active
                || !permissionEvaluationService.hasPermission(target, "settings.user.edit")) {
            return Optional.empty();
        }
        long otherActiveAdmins = userRepository.findAll().stream()
                .filter(u -> u.getStatus() == UserStatus.Active && !u.getId().equals(targetId))
                .filter(u -> permissionEvaluationService.hasPermission(u, "settings.user.edit"))
                .count();
        return otherActiveAdmins == 0 ? Optional.of("LAST_ACTIVE_ADMIN_PROTECTED") : Optional.empty();
    }

    /** GMP gap fix: SUSPEND/TERMINATE previously wrote an audit trail entry but never required an
     * electronic signature, unlike FORCE_LOGOUT and Access Profile changes. Same verification
     * pattern as {@link #forceLogout}. */
    private void requireValidActionSignature(UserAccount actor, String signatureToken) {
        if (signatureToken == null || signatureToken.isBlank()) {
            throw new IllegalArgumentException("Signature token is required");
        }
        var signatureClaims = tokenService.parseSignatureToken(signatureToken)
                .orElseThrow(() -> new UnauthorizedException("Invalid signature token"));
        if (!signatureClaims.principal().userId().equals(actor.getId())) {
            throw new UnauthorizedException("Signature token does not belong to current user");
        }
    }

    /**
     * SECURITY_AUTHORIZATION_HYBRID_REFACTOR_PLAN.md Phase 4 cutover rule 5 for USER (2026-08-11):
     * {@link com.eqms.service.authorization.AuthorizationEngineService} is now the sole decision
     * authority for SUSPEND/TERMINATE/DELETE -- it folds together what used to be three separate
     * checks (flat {@code settings.user.edit}/{@code settings.user.delete} permission at the
     * controller, {@link #isSelfTargetingBlocked}, {@link #checkLastActiveAdminGuard}) into one
     * {@code authorize()} call, because {@link UserResourceAdapter} wires those same two guard
     * methods into {@code isWithinObjectScope}/{@code checkPrecondition} and the engine checks the
     * required permission itself (see {@code AuthorizationEngineService#authorize} steps). Real
     * traffic already confirmed 0 decision mismatches for USER before this cutover (see plan §9).
     * Fail-closed on any engine error, same policy as Document/Revision/Controlled Copy. Every
     * other user action (CREATE/VIEW/RESET_PASSWORD/FORCE_LOGOUT/UPDATE) intentionally stays on
     * the flat permission check at the controller -- Option 2 decision, not engine-ized this round.
     */
    private void requireUserActionAllowed(UUID targetId, String actionCode) {
        UserAccount actor = currentUserService.requireCurrentUser();
        com.eqms.service.authorization.AuthorizationDecision decision;
        try {
            decision = authorizationEngineService.authorize(
                    com.eqms.service.authorization.AuthorizationRequest.of(actor, "USER", targetId, actionCode));
        } catch (Exception e) {
            log.error("Authorization engine failed for user {} action {}: {}", targetId, actionCode, e.getMessage(), e);
            throw new org.springframework.security.access.AccessDeniedException(
                    "Unable to verify authorization for this action right now. Please try again.");
        }
        if (decision.allowed()) {
            return;
        }
        switch (decision.reasonCode()) {
            case "OUT_OF_SCOPE" -> throw new IllegalArgumentException(
                    "You cannot " + actionCode.toLowerCase(Locale.ROOT) + " your own account.");
            case "LAST_ACTIVE_ADMIN_PROTECTED" -> throw new IllegalArgumentException(
                    "Cannot " + actionCode.toLowerCase(Locale.ROOT) + " the last active administrator account.");
            case "MISSING_PERMISSION" -> throw new org.springframework.security.access.AccessDeniedException(
                    "Current user is not allowed to " + (actionCode.equals("DELETE") ? "delete" : "edit") + " user accounts");
            default -> throw new org.springframework.security.access.AccessDeniedException(
                    "You are not authorized to perform this action.");
        }
    }

    @Transactional
    public void deleteUser(UUID id, String signatureToken, HttpServletRequest httpRequest) {
        UserAccount actor = currentUserService.requireCurrentUser();
        UserAccount user = requireUser(id);
        requireValidActionSignature(actor, signatureToken);
        requireUserActionAllowed(id, "DELETE");
        auditService.log("user_deleted", user, auditDetails(
                "employeeCode", user.getEmployeeCode(),
                "username", user.getUsername()
        ), clientIp(httpRequest), userAgent(httpRequest));

        auditTrailService.log(
                "USER",
                user.getFullName(),
                user.getId(),
                ACTION_USER_DELETED,
                user.getStatus() != null ? user.getStatus().name() : null,
                null,
                "Deleted user account: " + user.getUsername() + " (" + user.getEmployeeCode() + ")"
        );

        revokeAllSessions(user.getId());
        permissionEvaluationService.evictUserPermissionCache(user.getId());
        userRepository.delete(user);
    }

    @Transactional
    public UserManagementResponse suspendUser(UUID id, StatusActionRequest request, HttpServletRequest httpRequest) {
        UserAccount actor = currentUserService.requireCurrentUser();
        UserAccount user = requireUser(id);
        requireValidActionSignature(actor, request.signatureToken());
        requireUserActionAllowed(id, "SUSPEND");
        String oldStatus = user.getStatus() != null ? user.getStatus().name() : null;
        String reason = normalizeRequired(request.reason(), "Reason");
        changeUserStatus(user, UserStatus.Suspended);
        user.setSuspendReason(reason);
        user.setSuspendedUntil(parseDateStrictOptional(request.date(), "Suspended Until", false));
        auditService.log("user_suspended", user, auditDetails(
                "reason", reason,
                "suspendedUntil", request.date()
        ), clientIp(httpRequest), userAgent(httpRequest));

        String comment = "Suspended user: " + reason;
        if (request.date() != null) {
            comment += " until " + request.date();
        }
        auditTrailService.log(
                "USER",
                user.getFullName(),
                user.getId(),
                ACTION_USER_SUSPENDED,
                oldStatus,
                UserStatus.Suspended.name(),
                comment
        );
        notificationDispatcher.dispatch("user.account_suspended", List.of(user), Map.of());

        return toResponse(user, true);
    }

    @Transactional
    public UserManagementResponse terminateUser(UUID id, StatusActionRequest request, HttpServletRequest httpRequest) {
        UserAccount actor = currentUserService.requireCurrentUser();
        UserAccount user = requireUser(id);
        requireValidActionSignature(actor, request.signatureToken());
        requireUserActionAllowed(id, "TERMINATE");
        String oldStatus = user.getStatus() != null ? user.getStatus().name() : null;
        String reason = normalizeRequired(request.reason(), "Reason");
        String terminationDate = normalizeRequired(request.date(), "Termination Date");
        changeUserStatus(user, UserStatus.Terminated);
        user.setTerminationReason(reason);
        user.setTerminationDate(parseDateStrictOptional(terminationDate, "Termination Date", false));
        auditService.log("user_terminated", user, auditDetails(
                "reason", reason,
                "terminationDate", terminationDate
        ), clientIp(httpRequest), userAgent(httpRequest));

        String comment = "Terminated user: " + reason + " on " + terminationDate;
        auditTrailService.log(
                "USER",
                user.getFullName(),
                user.getId(),
                ACTION_USER_TERMINATED,
                oldStatus,
                UserStatus.Terminated.name(),
                comment
        );
        notificationDispatcher.dispatch("user.account_terminated", List.of(user), Map.of());

        return toResponse(user, true);
    }

    @Transactional
    public UserManagementResponse reinstateUser(UUID id, ReinstateRequest request, HttpServletRequest httpRequest) {
        UserAccount user = requireUser(id);
        String oldStatus = user.getStatus() != null ? user.getStatus().name() : null;
        user.setStatus(UserStatus.Active);
        user.setSuspendReason(null);
        user.setSuspendedUntil(null);
        user.setTerminationReason(null);
        user.setTerminationDate(null);
        auditService.log("user_reinstated", user, auditDetails(
                "reason", request == null ? null : request.reason()
        ), clientIp(httpRequest), userAgent(httpRequest));

        String comment = "Reinstated user: " + (request != null && request.reason() != null ? request.reason() : "No reason provided");
        auditTrailService.log(
                "USER",
                user.getFullName(),
                user.getId(),
                ACTION_USER_REINSTATED,
                oldStatus,
                UserStatus.Active.name(),
                comment
        );

        return toResponse(user, true);
    }

    @Transactional
    public ResetPasswordResponse resetPassword(UUID id, UserResetPasswordRequest request, HttpServletRequest httpRequest) {
        UserAccount actor = currentUserService.requireCurrentUser();
        UserAccount user = requireUser(id);
        // GMP gap fix: the FE modal has always collected and sent a signature token for this
        // action (ResetPasswordModal.tsx) but the backend previously had no field to bind it to
        // and silently discarded it -- verify it for real now, same pattern as forceLogout.
        String signatureToken = request == null ? null : request.signatureToken();
        if (signatureToken == null || signatureToken.isBlank()) {
            throw new IllegalArgumentException("Signature token is required");
        }
        var signatureClaims = tokenService.parseSignatureToken(signatureToken)
                .orElseThrow(() -> new UnauthorizedException("Invalid signature token"));
        if (!signatureClaims.principal().userId().equals(actor.getId())) {
            throw new UnauthorizedException("Signature token does not belong to current user");
        }
        String oldStatus = user.getStatus() != null ? user.getStatus().name() : null;

        String rawPassword;
        boolean customPassword = request != null && request.newPassword() != null && !request.newPassword().isBlank();
        if (customPassword) {
            rawPassword = request.newPassword();
            // Validate password policy
            systemConfigurationService.validatePasswordPolicy(rawPassword);

            // Validate password history
            com.fasterxml.jackson.databind.JsonNode security = systemConfigurationService.requireConfiguration().getSecurityConfig();
            if (security != null && security.path("preventPasswordReuse").asBoolean(true)) {
                int historyCount = security.path("passwordHistoryCount").asInt(5);
                systemConfigurationService.validatePasswordHistory(rawPassword, user.getPasswordHistory(), historyCount, passwordEncoder);
            }
        } else {
            rawPassword = generatePassword();
        }

        String newHash = passwordEncoder.encode(rawPassword);
        user.setPasswordHash(newHash);

        // Update password history
        com.fasterxml.jackson.databind.JsonNode security = systemConfigurationService.requireConfiguration().getSecurityConfig();
        if (security != null) {
            int historyCount = security.path("passwordHistoryCount").asInt(5);
            user.setPasswordHistory(systemConfigurationService.updatePasswordHistory(user.getPasswordHistory(), newHash, historyCount));
        }

        user.setMustChangePassword(true);
        user.setPasswordChangedAt(Instant.now());
        user.setFailedLoginCount(0);
        user.setLockedUntil(null);
        revokeAllSessions(user.getId());
        auditService.log("user_password_reset", user, auditDetails(
                "sendEmail", request != null && Boolean.TRUE.equals(request.sendEmail())
        ), clientIp(httpRequest), userAgent(httpRequest));

        auditTrailService.log(
                "USER",
                user.getFullName(),
                user.getId(),
                ACTION_USER_PASSWORD_RESET,
                oldStatus,
                user.getStatus() != null ? user.getStatus().name() : null,
                "Password reset for user " + user.getUsername()
        );
        notificationDispatcher.dispatch("security.password_changed", List.of(user), Map.of());

        return new ResetPasswordResponse(rawPassword);
    }

    @Transactional
    public UserManagementResponse unlockUser(UUID id, HttpServletRequest httpRequest) {
        UserAccount user = requireUser(id);
        String oldStatus = user.getStatus() != null ? user.getStatus().name() : null;
        user.setFailedLoginCount(0);
        user.setLockedUntil(null);
        auditService.log("user_unlocked", user, Map.of(), clientIp(httpRequest), userAgent(httpRequest));

        auditTrailService.log(
                "USER",
                user.getFullName(),
                user.getId(),
                ACTION_USER_UNLOCKED,
                oldStatus,
                user.getStatus() != null ? user.getStatus().name() : null,
                "Unlocked user account: " + user.getUsername()
        );

        return toResponse(user, true);
    }

    @Transactional
    public void forceLogout(UUID id, ForceLogoutRequest request, HttpServletRequest httpRequest) {
        UserAccount actor = currentUserService.requireCurrentUser();
        UserAccount user = requireUser(id);
        if (request == null || request.signatureToken() == null || request.signatureToken().isBlank()) {
            throw new IllegalArgumentException("Signature token is required");
        }
        if (request.reason() == null || request.reason().isBlank()) {
            throw new IllegalArgumentException("Reason is required");
        }

        var signatureClaims = tokenService.parseSignatureToken(request.signatureToken())
                .orElseThrow(() -> new UnauthorizedException("Invalid signature token"));
        if (!signatureClaims.principal().userId().equals(actor.getId())) {
            throw new UnauthorizedException("Signature token does not belong to current user");
        }

        String oldStatus = user.getStatus() != null ? user.getStatus().name() : null;
        revokeAllSessions(user.getId());

        auditService.log("user_force_logout", user, auditDetails(
                "reason", request.reason(),
                "signatureId", signatureClaims.principal().sessionId().toString()
        ), clientIp(httpRequest), userAgent(httpRequest));

        auditTrailService.logAs(
                actor,
                "USER",
                user.getFullName(),
                user.getId(),
                ACTION_USER_FORCE_LOGOUT,
                oldStatus,
                "REVOKED",
                "Logged out immediately: " + request.reason(),
                null,
                signatureClaims.principal().sessionId()
        );
    }

    public UserPermissionsResponse getPermissions(UUID id) {
        UserAccount user = requireUser(id);
        return new UserPermissionsResponse(
                user.getId().toString(),
                user.getRoleName(),
                permissionCodesForUser(user)
        );
    }

    /** Tells the UI which row-level actions the CURRENT user may perform on the target
     *  account, purely from real Access Profile permissions — no role-name shortcuts. */
    public com.eqms.dto.user.UserActionCapabilitiesResponse getUserCapabilities(UUID id) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        requireUser(id);

        Map<String, com.eqms.dto.user.UserActionCapabilitiesResponse.ActionCapability> actions = new LinkedHashMap<>();
        actions.put("view", userCapability(currentUser, "settings.user.view"));
        // Profile editing is a first-class row action.  The UI consumes this
        // capability to enable section edits, avatar changes and profile saves.
        // Keep it backed by the same permission used by the mutation endpoints
        // instead of inferring editability from a role name.
        actions.put("edit", userCapability(currentUser, "settings.user.edit"));
        actions.put("resetPassword", userCapability(currentUser, "settings.user.reset_password"));
        actions.put("suspend", userCapability(currentUser, "settings.user.edit"));
        actions.put("terminate", userCapability(currentUser, "settings.user.edit"));
        actions.put("reinstate", userCapability(currentUser, "settings.user.edit"));
        actions.put("forceLogout", userCapability(currentUser, "settings.user.force_logout"));

        // Whether each Microsoft-identity action makes sense right now depends on the user's
        // current provisioning status (e.g. you can't "invite" someone who already joined, or
        // "disable" a link that doesn't exist). This eligibility is computed here — server-side —
        // rather than in the UI, so the menu can never drift out of sync with what the backend
        // will actually accept (the FE only renders whatever `allowed` says).
        var externalRecord = externalIdentityProvisioningService.statuses(List.of(id)).get(id);
        String externalStatus = externalRecord == null ? "NOT_LINKED" : externalRecord.status();
        boolean pendingExternalOperation = externalIdentityProvisioningService.hasPendingOperation(id);
        boolean managedGuest = externalIdentityProvisioningService.isEqmsManagedGuest(id);
        boolean activeUser = requireUser(id).getStatus() == UserStatus.Active;
        boolean canInvite = activeUser && ("NOT_LINKED".equals(externalStatus) || "NOT_INVITED".equals(externalStatus) || "REMOVED".equals(externalStatus));
        boolean canResend = "INVITED".equals(externalStatus);
        boolean canRetry = activeUser && "FAILED".equals(externalStatus);
        boolean canDisable = managedGuest && ("INVITED".equals(externalStatus) || "REDEEMED".equals(externalStatus));
        boolean canRemove = managedGuest && ("DISABLED".equals(externalStatus) || "FAILED".equals(externalStatus));
        if (pendingExternalOperation) { canInvite = false; canResend = false; canRetry = false; canDisable = false; canRemove = false; }

        actions.put("inviteExternal", userCapability(currentUser, "users.invite_external", canInvite,
                "This user already has an active or pending Microsoft link."));
        actions.put("resendExternalInvitation", userCapability(currentUser, "users.resend_external_invitation", canResend,
                "An invitation can only be resent while one is still pending."));
        actions.put("retryExternalProvisioning", userCapability(currentUser, "users.retry_external_provisioning", canRetry,
                "Retry is only available after a failed provisioning attempt."));
        actions.put("disableMicrosoftAccess", userCapability(currentUser, "users.disable_microsoft_access", canDisable,
                "There is no active Microsoft link to disable."));
        actions.put("removeExternalUser", userCapability(currentUser, "users.remove_external_identity", canRemove,
                "There is no Microsoft link to remove."));
        actions.put("viewExternalProvisioning", userCapability(currentUser, "users.view_external_provisioning"));

        return new com.eqms.dto.user.UserActionCapabilitiesResponse(id.toString(), actions);
    }

    private com.eqms.dto.user.UserActionCapabilitiesResponse.ActionCapability userCapability(UserAccount currentUser, String permissionCode) {
        boolean allowed = permissionEvaluationService.hasPermission(currentUser, permissionCode);
        return new com.eqms.dto.user.UserActionCapabilitiesResponse.ActionCapability(
                allowed,
                allowed ? null : "You do not have permission to perform this action.",
                permissionCode
        );
    }

    private com.eqms.dto.user.UserActionCapabilitiesResponse.ActionCapability userCapability(
            UserAccount currentUser, String permissionCode, boolean statusEligible, String statusIneligibleReason) {
        if (!permissionEvaluationService.hasPermission(currentUser, permissionCode)) {
            return new com.eqms.dto.user.UserActionCapabilitiesResponse.ActionCapability(
                    false, "You do not have permission to perform this action.", permissionCode);
        }
        if (!statusEligible) {
            return new com.eqms.dto.user.UserActionCapabilitiesResponse.ActionCapability(false, statusIneligibleReason, permissionCode);
        }
        return new com.eqms.dto.user.UserActionCapabilitiesResponse.ActionCapability(true, null, permissionCode);
    }

    public List<PermissionGroupResponse> getPermissionCatalog(String module, String search) {
        return getPermissionCatalog(module, search, null);
    }

    /**
     * Returns the permission catalog after applying only filters backed by persisted
     * permission data.  Keeping this filtering here ensures every administration
     * screen receives the same catalogue and does not infer policy attributes in
     * the browser.
     */
    public List<PermissionGroupResponse> getPermissionCatalog(String module, String search, String audit) {
        List<Permission> permissions;
        if (hasText(search)) {
            permissions = permissionRepository.searchPermissions(search.trim());
            if (hasText(module)) {
                String normalizedModule = module.trim().toLowerCase(Locale.ROOT);
                permissions = permissions.stream()
                        .filter(p -> normalizedModule.equalsIgnoreCase(p.getModuleKey()))
                        .toList();
            }
        } else if (hasText(module)) {
            permissions = permissionRepository.findAllByModuleKeyIgnoreCaseOrderByDisplayOrderAscCodeAsc(module.trim());
        } else if ("AUDIT".equalsIgnoreCase(audit)) {
            permissions = permissionRepository.findAllByRequiresAuditOrderByModuleKeyAscGroupKeyAscDisplayOrderAscCodeAsc(true);
        } else if ("NO_AUDIT".equalsIgnoreCase(audit)) {
            permissions = permissionRepository.findAllByRequiresAuditOrderByModuleKeyAscGroupKeyAscDisplayOrderAscCodeAsc(false);
        } else {
            permissions = permissionRepository.findAll().stream()
                .sorted(Comparator
                        .comparing((Permission permission) -> permission.getModuleKey() == null ? "" : permission.getModuleKey(), String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(permission -> permission.getGroupKey() == null ? permission.getCategory() : permission.getGroupKey(), String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(permission -> permission.getDisplayOrder() == null ? Integer.MAX_VALUE : permission.getDisplayOrder())
                        .thenComparing(Permission::getCode, String.CASE_INSENSITIVE_ORDER))
                .toList();
        }

        if (hasText(search) || hasText(module)) {
            if ("AUDIT".equalsIgnoreCase(audit)) {
            permissions = permissions.stream().filter(Permission::isRequiresAudit).toList();
            } else if ("NO_AUDIT".equalsIgnoreCase(audit)) {
            permissions = permissions.stream().filter(permission -> !permission.isRequiresAudit()).toList();
            }
        }

        Map<String, List<Permission>> grouped = permissions.stream()
                .collect(Collectors.groupingBy(
                        permission -> hasText(permission.getModuleKey()) ? permission.getModuleKey() : slugify(permission.getCategory()),
                        LinkedHashMap::new,
                        Collectors.toList()
                ));

        return grouped.entrySet().stream()
                .map(entry -> {
                    List<Permission> modulePerms = entry.getValue().stream()
                            .sorted(Comparator
                                    .comparing((Permission p) -> p.getGroupKey() == null ? "" : p.getGroupKey())
                                    .thenComparing(p -> p.getDisplayOrder() == null ? Integer.MAX_VALUE : p.getDisplayOrder()))
                            .toList();
                    Permission first = modulePerms.get(0);
                    List<PermissionCatalogItemResponse> items = modulePerms.stream()
                            .map(permission -> new PermissionCatalogItemResponse(
                                    permission.getCode(),
                                    permission.getName(),
                                    permission.getDescription(),
                                    permission.getModuleKey(),
                                    permission.getGroupKey(),
                                    permission.getDisplayOrder() == null ? 0 : permission.getDisplayOrder(),
                                    permission.isRequiresAudit()
                            ))
                            .toList();
                    return new PermissionGroupResponse(
                            entry.getKey(),
                            first.getCategory(),
                            null,
                            items
                    );
                })
                .toList();
    }

    public PageResponse<PermissionCatalogFlatResponse> getPermissionCatalogPaged(
            String module, String search, int page, int limit, String sortBy, String sortDir) {
        List<Permission> permissions;
        if (hasText(search)) {
            permissions = permissionRepository.searchPermissions(search.trim());
            if (hasText(module)) {
                String normalizedModule = module.trim().toLowerCase(Locale.ROOT);
                permissions = permissions.stream()
                        .filter(p -> normalizedModule.equalsIgnoreCase(p.getModuleKey()))
                        .toList();
            }
        } else if (hasText(module)) {
            permissions = permissionRepository.findAllByModuleKeyIgnoreCaseOrderByDisplayOrderAscCodeAsc(module.trim());
        } else {
            permissions = permissionRepository.findAll();
        }

        List<PermissionCatalogFlatResponse> flat = permissions.stream()
                .map(p -> new PermissionCatalogFlatResponse(
                        p.getCode(),
                        p.getName(),
                        p.getDescription(),
                        p.getModuleKey(),
                        p.getCategory(),
                        p.isRequiresAudit()
                ))
                .collect(Collectors.toCollection(ArrayList::new));

        Comparator<PermissionCatalogFlatResponse> comparator = switch (sortBy == null ? "code" : sortBy) {
            case "name" -> Comparator.comparing(PermissionCatalogFlatResponse::name, String.CASE_INSENSITIVE_ORDER);
            case "module" -> Comparator.comparing(
                    (PermissionCatalogFlatResponse r) -> r.module() == null ? "" : r.module(), String.CASE_INSENSITIVE_ORDER);
            case "groupName" -> Comparator.comparing(
                    (PermissionCatalogFlatResponse r) -> r.groupName() == null ? "" : r.groupName(), String.CASE_INSENSITIVE_ORDER);
            default -> Comparator.comparing(PermissionCatalogFlatResponse::code, String.CASE_INSENSITIVE_ORDER);
        };
        if ("desc".equalsIgnoreCase(sortDir)) comparator = comparator.reversed();
        flat.sort(comparator);

        return PagedList.paginate(flat, page, limit);
    }

    @Transactional
    public UserManagementResponse updateRole(UUID id, UpdateRoleRequest request, HttpServletRequest httpRequest) {
        UserAccount user = requireUser(id);
        String oldRole = user.getRoleName();
        String oldStatus = user.getStatus() != null ? user.getStatus().name() : null;
        user.setRoleName(request.role());
        auditService.log("user_role_updated", user, auditDetails("role", request.role()), clientIp(httpRequest), userAgent(httpRequest));

        List<AuditTrailChangeResponse> changes = new ArrayList<>();
        changes.add(new AuditTrailChangeResponse("role", oldRole != null ? oldRole : "", request.role() != null ? request.role() : ""));
        auditTrailService.log(
                "USER",
                user.getFullName(),
                user.getId(),
                ACTION_USER_ROLE_UPDATED,
                oldStatus,
                user.getStatus() != null ? user.getStatus().name() : null,
                "Updated role from " + oldRole + " to " + request.role() + " for user " + user.getUsername(),
                changes
        );

        return toResponse(user, true);
    }

    public List<RoleSummaryResponse> getRoles() {
        return roleRepository.findAll()
                .stream()
                .filter(RoleDefinition::isActive)
                .map(this::toRoleSummaryResponse)
                .sorted((a, b) -> a.role().compareToIgnoreCase(b.role()))
                .toList();
    }

    public PageResponse<RoleSummaryResponse> getRoles(
            int page,
            int limit,
            String search,
            String type,
            String status,
            String sortBy,
            String sortDirection
    ) {
        int safePage = Math.max(page, 1);
        int safeLimit = Math.max(limit, 1);
        List<RoleSummaryResponse> filtered = roleRepository.findAll(buildRoleSpecification(search, type, status))
                .stream()
                .map(this::toRoleSummaryResponse)
                .sorted(buildRoleComparator(sortBy, sortDirection))
                .toList();

        int totalItems = filtered.size();
        int totalPages = Math.max(1, (int) Math.ceil(totalItems / (double) safeLimit));
        int fromIndex = Math.min((safePage - 1) * safeLimit, totalItems);
        int toIndex = Math.min(fromIndex + safeLimit, totalItems);

        return new PageResponse<>(
                filtered.subList(fromIndex, toIndex),
                new PaginationResponse(safePage, safeLimit, totalItems, totalPages)
        );
    }

    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public RoleSummaryResponse getRole(UUID id) {
        return toRoleSummaryResponse(requireRole(id));
    }

    @Transactional
    public RoleSummaryResponse createRole(RoleUpsertRequest request, HttpServletRequest httpRequest) {
        UserAccount actor = currentUserService.requireCurrentUser();
        UUID signatureId = resolveSignatureId(request.signatureToken(), actor);

        String roleName = request.role().trim();
        if (roleRepository.findByName(roleName).isPresent()) {
            throw new IllegalArgumentException("Role already exists");
        }
        RoleDefinition role = new RoleDefinition();
        role.setName(roleName);
        role.setCode(blankToNull(request.code()) != null ? request.code().trim() : slugify(roleName));
        role.setDescription(blankToNull(request.description()));
        role.setSystem(false);
        role.setActive(request.active() == null || request.active());
        role = roleRepository.save(role);
        List<Permission> assignedPermissions = resolvePermissions(request.permissions());
        replaceRolePermissionsResolved(role, assignedPermissions);
        auditService.log("role_created", actor, auditDetails("role", role.getName(), "code", role.getCode()), clientIp(httpRequest), userAgent(httpRequest));

        List<AuditTrailChangeResponse> createChanges = assignedPermissions.stream()
                .map(p -> new AuditTrailChangeResponse("Permission Granted", null, p.getName()))
                .collect(java.util.stream.Collectors.toList());

        String comment = hasText(request.reason())
                ? request.reason()
                : "Created role: " + role.getName() + " (" + role.getCode() + ")";
        auditTrailService.logAs(
                actor,
                "ROLE",
                role.getName(),
                role.getId(),
                ACTION_ROLE_CREATED,
                null,
                role.isActive() ? "Active" : "Inactive",
                comment,
                createChanges.isEmpty() ? null : createChanges,
                signatureId
        );

        return toRoleSummaryResponse(role);
    }

    @Transactional
    public RoleSummaryResponse updateRole(UUID id, RoleUpsertRequest request, HttpServletRequest httpRequest) {
        UserAccount actor = currentUserService.requireCurrentUser();
        UUID signatureId = resolveSignatureId(request.signatureToken(), actor);

        RoleDefinition role = requireRole(id);
        String previousName = role.getName();
        String newName = request.role().trim();
        if (!previousName.equalsIgnoreCase(newName) && roleRepository.findByName(newName).isPresent()) {
            throw new IllegalArgumentException("Role already exists");
        }
        String oldStatus = role.isActive() ? "Active" : "Inactive";

        List<AuditTrailChangeResponse> changes = new ArrayList<>();
        compareField(changes, "Role Name", role.getName(), newName);
        compareField(changes, "Description", role.getDescription(), blankToNull(request.description()));
        if (request.active() != null) {
            compareField(changes, "Status", role.isActive() ? "Active" : "Inactive", request.active() ? "Active" : "Inactive");
        }

        // Compute permission diff before replacing
        Set<String> currentCodes = rolePermissionRepository.findAllByRole_Id(role.getId()).stream()
                .map(rp -> rp.getPermission().getCode())
                .collect(java.util.stream.Collectors.toSet());
        List<Permission> newPermissions = resolvePermissions(request.permissions());
        Set<String> newCodes = newPermissions.stream().map(Permission::getCode).collect(java.util.stream.Collectors.toSet());

        // Added permissions
        newPermissions.stream()
                .filter(p -> !currentCodes.contains(p.getCode()))
                .forEach(p -> changes.add(new AuditTrailChangeResponse("Permission Granted", null, p.getName())));
        // Removed permissions — need names from current list
        List<Permission> currentPermissions = rolePermissionRepository.findAllByRole_Id(role.getId()).stream()
                .map(rp -> rp.getPermission())
                .toList();
        currentPermissions.stream()
                .filter(p -> !newCodes.contains(p.getCode()))
                .forEach(p -> changes.add(new AuditTrailChangeResponse("Permission Revoked", p.getName(), null)));

        role.setName(newName);
        role.setCode(blankToNull(request.code()) != null ? request.code().trim() : slugify(newName));
        role.setDescription(blankToNull(request.description()));
        if (request.active() != null) {
            role.setActive(request.active());
        }
        roleRepository.save(role);
        replaceRolePermissionsResolved(role, newPermissions);
        if (!previousName.equals(newName)) {
            // A role rename may touch a large tenant. Perform it as one database
            // update instead of materialising every user account in the request JVM.
            userRepository.replaceRoleName(previousName, newName);
        }
        auditService.log("role_updated", actor, auditDetails("role", role.getName()), clientIp(httpRequest), userAgent(httpRequest));

        String comment = hasText(request.reason())
                ? request.reason()
                : "Updated role: " + role.getName();
        auditTrailService.logAs(
                actor,
                "ROLE",
                role.getName(),
                role.getId(),
                ACTION_ROLE_UPDATED,
                oldStatus,
                role.isActive() ? "Active" : "Inactive",
                comment,
                changes,
                signatureId
        );

        permissionEvaluationService.clearCache();

        return toRoleSummaryResponse(role);
    }

    @Transactional
    public void deleteRole(UUID id, HttpServletRequest httpRequest) {
        RoleDefinition role = requireRole(id);
        if (role.isSystem()) {
            throw new IllegalArgumentException("System roles cannot be deleted");
        }
        if (userRepository.countByRoleName(role.getName()) > 0) {
            throw new IllegalArgumentException("Role is in use and cannot be deleted");
        }
        String oldStatus = role.isActive() ? "Active" : "Inactive";
        rolePermissionRepository.deleteAllByRole_Id(role.getId());
        role.setActive(false);
        roleRepository.save(role);
        auditService.log("role_deleted", currentUserService.requireCurrentUser(), auditDetails("role", role.getName()), clientIp(httpRequest), userAgent(httpRequest));

        auditTrailService.log(
                "ROLE",
                role.getName(),
                role.getId(),
                ACTION_ROLE_DELETED,
                oldStatus,
                "Inactive",
                "Deleted role: " + role.getName()
        );

        permissionEvaluationService.clearCache();
    }

    @Transactional
    public RoleSummaryResponse updateRolePermissions(UUID id, RolePermissionsUpdateRequest request, HttpServletRequest httpRequest) {
        RoleDefinition role = requireRole(id);
        List<String> oldPermissions = permissionCodesForRole(role);
        replaceRolePermissions(role, request.permissions());
        List<String> newPermissions = request.permissions();
        auditService.log("role_permissions_updated", currentUserService.requireCurrentUser(), auditDetails("permissionCount", request.permissions().size()), clientIp(httpRequest), userAgent(httpRequest));

        List<AuditTrailChangeResponse> changes = new ArrayList<>();
        changes.add(new AuditTrailChangeResponse(
                "permissions",
                String.join(", ", oldPermissions),
                String.join(", ", newPermissions)
        ));

        auditTrailService.log(
                "ROLE",
                role.getName(),
                role.getId(),
                ACTION_ROLE_PERMISSIONS_UPDATED,
                role.isActive() ? "Active" : "Inactive",
                role.isActive() ? "Active" : "Inactive",
                "Updated permissions for role: " + role.getName(),
                changes
        );

        permissionEvaluationService.clearCache();

        return toRoleSummaryResponse(role);
    }

    public RoleSummaryResponse getRoleByCode(String code) {
        return roleRepository.findByCode(code)
                .map(this::toRoleSummaryResponse)
                .orElseThrow(() -> new IllegalArgumentException("Role not found"));
    }

    @Transactional
    public DocumentAdministrationResponse getDocumentAdministration() {
        DocumentWorkflowSetting setting = requireDocumentWorkflowSetting();
        return new DocumentAdministrationResponse(
                setting.isReviewerNoApprove(),
                setting.isRequireTwoReviewers(),
                setting.isRequireOneApprover(),
                setting.isAuthorCannotBeReviewerOrApprover(),
                setting.isCoAuthorCannotBeReviewerOrApprover(),
                setting.isSameUserCannotHoldMultipleWorkflowRoles(),
                setting.isDcoCannotBeReviewerOrApprover(),
                setting.isReviewerAndApproverDifferentDepartments(),
                singlePoolUserIds(WorkflowPoolTypes.DCO),
                poolUserIds(WorkflowPoolTypes.REVIEWER),
                poolUserIds(WorkflowPoolTypes.APPROVER),
                documentAdministrationRules(setting),
                setting.getVersion()
        );
    }

    /**
     * Server-owned policy definitions. The client renders this contract instead
     * of maintaining a separate copy of labels or rule semantics.
     */
    private List<DocumentAdministrationRuleResponse> documentAdministrationRules(DocumentWorkflowSetting setting) {
        return List.of(
                new DocumentAdministrationRuleResponse(
                        "reviewer-no-approve",
                        "Reviewer cannot approve the same revision",
                        "Prevents a participant assigned as Reviewer from also approving that revision.",
                        setting.isReviewerNoApprove()
                ),
                new DocumentAdministrationRuleResponse(
                        "require-two-reviewers",
                        "Require at least two reviewers",
                        "Requires two or more assigned reviewers before the workflow can proceed.",
                        setting.isRequireTwoReviewers()
                ),
                new DocumentAdministrationRuleResponse(
                        "require-one-approver",
                        "Require exactly one approver",
                        "Requires one assigned approver for each controlled revision.",
                        setting.isRequireOneApprover()
                ),
                new DocumentAdministrationRuleResponse(
                        "author-cannot-be-reviewer-or-approver",
                        "Prevent Author from reviewing their own revision",
                        "When enabled, the Author cannot be assigned as Reviewer. Author approval is always prohibited.",
                        setting.isAuthorCannotBeReviewerOrApprover()
                ),
                new DocumentAdministrationRuleResponse(
                        "co-author-cannot-be-reviewer-or-approver",
                        "Prevent Co-author from reviewing their own revision",
                        "When enabled, a Co-author cannot be assigned as Reviewer. Co-author approval is always prohibited.",
                        setting.isCoAuthorCannotBeReviewerOrApprover()
                ),
                new DocumentAdministrationRuleResponse(
                        "same-user-cannot-hold-multiple-workflow-roles",
                        "Prevent multiple assigned workflow roles",
                        "Prevents the same participant from holding overlapping Co-author, Reviewer or Approver assignments.",
                        setting.isSameUserCannotHoldMultipleWorkflowRoles()
                ),
                new DocumentAdministrationRuleResponse(
                        "workflow-coordinator-cannot-be-reviewer-or-approver",
                        "Prevent workflow coordinator from reviewing or approving",
                        "Prevents a user with document-control workspace capability from being assigned as Reviewer or Approver.",
                        setting.isWorkflowCoordinatorCannotBeReviewerOrApprover()
                ),
                new DocumentAdministrationRuleResponse(
                        "reviewer-and-approver-different-departments",
                        "Require reviewer and approver from different departments",
                        "Requires the assigned Approver to belong to a department different from each assigned Reviewer.",
                        setting.isReviewerAndApproverDifferentDepartments()
                )
        );
    }

    @Transactional
    public PageResponse<UserManagementResponse> getDocumentAdministrationUsers(
            String pool,
            int page,
            int limit,
            String search,
            String sortBy,
            String sortDirection
    ) {
        currentUserService.requireCurrentUser();
        String normalizedPool = pool == null ? "" : pool.trim().toUpperCase(Locale.ROOT);
        if (!WorkflowPoolTypes.REVIEWER.equals(normalizedPool)
                && !WorkflowPoolTypes.APPROVER.equals(normalizedPool)
                && !WorkflowPoolTypes.DCO.equals(normalizedPool)) {
            throw new IllegalArgumentException("Invalid pool type");
        }

        Set<UUID> poolMemberIds = poolUserIds(normalizedPool).stream()
                .map(this::parseUuid)
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toSet());
        if (poolMemberIds.isEmpty()) {
            return new PageResponse<>(List.of(), new PaginationResponse(Math.max(page, 1), Math.max(limit, 1), 0, 0));
        }

        int safePage = Math.max(page, 1);
        int safeLimit = Math.min(Math.max(limit, 1), 100);
        Specification<UserAccount> specification = buildSpecification(
                        search,
                        null,
                        UserStatus.Active.name(),
                        null,
                        null,
                                null,
                                null,
                                null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        false
                ).and((root, query, criteriaBuilder) -> root.get("id").in(poolMemberIds));
        Page<UserAccount> matching = userRepository.findAll(
                specification,
                PageRequest.of(
                        safePage - 1,
                        safeLimit,
                        Sort.by("desc".equalsIgnoreCase(sortDirection) ? Sort.Direction.DESC : Sort.Direction.ASC, resolveSortProperty(sortBy))
                )
        );
        return new PageResponse<>(
                matching.getContent().stream().map(user -> toResponse(user, false)).toList(),
                new PaginationResponse(safePage, safeLimit, matching.getTotalElements(), matching.getTotalPages())
        );
    }

    @Transactional
    public DocumentAdministrationResponse updateDocumentAdministration(DocumentAdministrationRequest request, HttpServletRequest httpRequest) {
        DocumentWorkflowSetting setting = requireDocumentWorkflowSetting();

        List<String> normalizedDcoUserIds = distinctNonBlank(request.dcoUserIds());
        if (normalizedDcoUserIds.size() > 1) {
            throw new IllegalArgumentException("Only one workflow coordinator can be assigned.");
        }

        List<AuditTrailChangeResponse> changes = new ArrayList<>();
        changes.add(new AuditTrailChangeResponse("reviewerNoApprove", String.valueOf(setting.isReviewerNoApprove()), String.valueOf(request.reviewerNoApprove())));
        changes.add(new AuditTrailChangeResponse("requireTwoReviewers", String.valueOf(setting.isRequireTwoReviewers()), String.valueOf(request.requireTwoReviewers())));
        changes.add(new AuditTrailChangeResponse("requireOneApprover", String.valueOf(setting.isRequireOneApprover()), String.valueOf(request.requireOneApprover())));
        changes.add(new AuditTrailChangeResponse("authorCannotBeReviewerOrApprover", String.valueOf(setting.isAuthorCannotBeReviewerOrApprover()), String.valueOf(request.authorCannotBeReviewerOrApprover())));
        changes.add(new AuditTrailChangeResponse("coAuthorCannotBeReviewerOrApprover", String.valueOf(setting.isCoAuthorCannotBeReviewerOrApprover()), String.valueOf(request.coAuthorCannotBeReviewerOrApprover())));
        changes.add(new AuditTrailChangeResponse("sameUserCannotHoldMultipleWorkflowRoles", String.valueOf(setting.isSameUserCannotHoldMultipleWorkflowRoles()), String.valueOf(request.sameUserCannotHoldMultipleWorkflowRoles())));
        changes.add(new AuditTrailChangeResponse("dcoCannotBeReviewerOrApprover", String.valueOf(setting.isDcoCannotBeReviewerOrApprover()), String.valueOf(request.dcoCannotBeReviewerOrApprover())));
        changes.add(new AuditTrailChangeResponse("reviewerAndApproverDifferentDepartments", String.valueOf(setting.isReviewerAndApproverDifferentDepartments()), String.valueOf(request.reviewerAndApproverDifferentDepartments())));

        setting.setReviewerNoApprove(request.reviewerNoApprove());
        setting.setRequireTwoReviewers(request.requireTwoReviewers());
        setting.setRequireOneApprover(request.requireOneApprover());
        setting.setAuthorCannotBeReviewerOrApprover(request.authorCannotBeReviewerOrApprover());
        setting.setCoAuthorCannotBeReviewerOrApprover(request.coAuthorCannotBeReviewerOrApprover());
        setting.setSameUserCannotHoldMultipleWorkflowRoles(request.sameUserCannotHoldMultipleWorkflowRoles());
        setting.setDcoCannotBeReviewerOrApprover(request.dcoCannotBeReviewerOrApprover());
        setting.setReviewerAndApproverDifferentDepartments(request.reviewerAndApproverDifferentDepartments());
        replacePoolMembers(WorkflowPoolTypes.DCO, normalizedDcoUserIds);
        replacePoolMembers(WorkflowPoolTypes.REVIEWER, request.reviewerUserIds());
        replacePoolMembers(WorkflowPoolTypes.APPROVER, request.approverUserIds());
        auditService.log("document_administration_updated", currentUserService.requireCurrentUser(), auditDetails(
                "workflowCoordinatorCount", normalizedDcoUserIds.size(),
                "reviewerCount", request.reviewerUserIds() == null ? 0 : request.reviewerUserIds().size(),
                "approverCount", request.approverUserIds() == null ? 0 : request.approverUserIds().size()
        ), clientIp(httpRequest), userAgent(httpRequest));

        String reason = request.reason();
        auditTrailService.log(
                "SYSTEM_CONFIGURATION",
                "Document Workflow Settings",
                setting.getId(),
                ACTION_DOCUMENT_ADMINISTRATION_UPDATED,
                null,
                null,
                (reason != null && !reason.isBlank())
                        ? "Updated document workflow administration configuration: " + reason
                        : "Updated document workflow administration configuration",
                changes
        );

        return getDocumentAdministration();
    }

    public List<LookupItemResponse> getDepartments() {
        return departmentRepository.findAllByActiveTrueOrderByNameAsc()
                .stream()
                .map(department -> new LookupItemResponse(
                        department.getId().toString(),
                        department.getName(),
                        department.getCode(),
                        department.getName(),
                        department.getName()
                ))
                .toList();
    }

    public List<LookupItemResponse> getBusinessUnits() {
        return businessUnitRepository.findAll()
                .stream()
                .filter(BusinessUnit::isActive)
                .sorted((a, b) -> a.getName().compareToIgnoreCase(b.getName()))
                .map(unit -> new LookupItemResponse(
                        unit.getId().toString(),
                        unit.getName(),
                        unit.getCode(),
                        unit.getName(),
                        unit.getName()
                ))
                .toList();
    }

    public List<LookupItemResponse> getPositions() {
        return positionRepository.findAllByActiveTrueOrderByNameAsc()
                .stream()
                .map(position -> new LookupItemResponse(
                        position.getId().toString(),
                        position.getName(),
                        position.getCode(),
                        position.getName(),
                        position.getName()
                ))
                .toList();
    }

    public FilterOptionsResponse getFilterOptions() {
        List<LookupItemResponse> genders = List.of(
                option("Male"),
                option("Female"),
                option("Other")
        );
        List<LookupItemResponse> employmentTypes = List.of(
                option("Full-time"),
                option("Part-time"),
                option("Contract"),
                option("Intern")
        );
        List<LookupItemResponse> statuses = List.of(
                option("Active"),
                option("Inactive"),
                option("Pending"),
                option("Suspended"),
                option("Terminated")
        );
        return new FilterOptionsResponse(
                getRoles().stream().map(role -> new LookupItemResponse(null, role.role(), role.role(), role.role(), role.role())).toList(),
                genders,
                employmentTypes,
                statuses,
                getDepartments(),
                getBusinessUnits(),
                getPositions()
        );
    }

    /** Writes a potentially large user export without materialising the tenant in memory. */
    @Transactional
    public void writeUsersExport(
            String search,
            String role,
            String status,
            String online,
            String businessUnit,
            String department,
            String position,
            String dateFrom,
            String dateTo,
            String suspendFrom,
            String suspendTo,
            String terminateFrom,
            String terminateTo,
            boolean includeTerminated,
            java.io.OutputStream outputStream
    ) throws java.io.IOException {
        Specification<UserAccount> specification = buildSpecification(
                search, role, status, online, businessUnit, department, position, dateFrom, dateTo, suspendFrom, suspendTo, terminateFrom, terminateTo, includeTerminated
        );

        try (PrintWriter writer = new PrintWriter(new OutputStreamWriter(outputStream, StandardCharsets.UTF_8))) {
            writer.println("Employee ID,Full Name,Username,Email,Role,Position,Business Unit,Department,Status,Last Login,Created Date");
            int page = 0;
            Page<UserAccount> result;
            do {
                result = userRepository.findAll(specification, PageRequest.of(page++, 500, Sort.by(Sort.Direction.ASC, "fullName")));
                for (UserAccount account : result.getContent()) {
                    UserManagementResponse user = toResponse(account, false);
                    writer.printf("%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s%n",
                            csv(user.employeeCode()), csv(user.fullName()), csv(user.username()), csv(user.email()),
                            csv(user.role()), csv(user.position()), csv(user.businessUnit()), csv(user.department()),
                            csv(user.status()), csv(user.lastLogin()), csv(user.createdDate()));
                }
                writer.flush();
            } while (result.hasNext());
        }
    }

    @Transactional
    public EducationResponse addEducation(UUID userId, EducationRequest request) {
        UserAccount user = requireUser(userId);
        UserEducation education = new UserEducation();
        education.setUser(user);
        education.setDegree(request.degree());
        education.setFieldOfStudy(request.fieldOfStudy());
        education.setInstitution(request.institution());
        education.setGraduationYear(blankToNull(request.graduationYear()));
        education.setGpa(blankToNull(request.gpa()));
        educationRepository.save(education);

        auditTrailService.log(
                "USER",
                user.getFullName(),
                user.getId(),
                ACTION_USER_EDUCATION_ADDED,
                null,
                null,
                "Added academic qualification: " + request.degree() + " in " + request.fieldOfStudy() + " from " + request.institution()
        );

        return toEducationResponse(education);
    }

    @Transactional
    public EducationResponse updateEducation(UUID userId, UUID educationId, EducationRequest request) {
        UserEducation education = requireEducation(userId, educationId);
        UserAccount user = education.getUser();

        List<AuditTrailChangeResponse> changes = new ArrayList<>();
        compareField(changes, "degree", education.getDegree(), request.degree());
        compareField(changes, "fieldOfStudy", education.getFieldOfStudy(), request.fieldOfStudy());
        compareField(changes, "institution", education.getInstitution(), request.institution());
        compareField(changes, "graduationYear", education.getGraduationYear(), blankToNull(request.graduationYear()));
        compareField(changes, "gpa", education.getGpa(), blankToNull(request.gpa()));

        education.setDegree(request.degree());
        education.setFieldOfStudy(request.fieldOfStudy());
        education.setInstitution(request.institution());
        education.setGraduationYear(blankToNull(request.graduationYear()));
        education.setGpa(blankToNull(request.gpa()));

        auditTrailService.log(
                "USER",
                user.getFullName(),
                user.getId(),
                ACTION_USER_EDUCATION_UPDATED,
                null,
                null,
                "Updated academic qualification: " + education.getDegree() + " in " + education.getFieldOfStudy(),
                changes
        );

        return toEducationResponse(education);
    }

    @Transactional
    public void deleteEducation(UUID userId, UUID educationId) {
        UserEducation education = requireEducation(userId, educationId);
        UserAccount user = education.getUser();

        auditTrailService.log(
                "USER",
                user.getFullName(),
                user.getId(),
                ACTION_USER_EDUCATION_DELETED,
                null,
                null,
                "Removed academic qualification: " + education.getDegree() + " in " + education.getFieldOfStudy() + " from " + education.getInstitution()
        );

        educationRepository.delete(education);
    }

    public List<EducationResponse> getEducations(UUID userId) {
        return educationRepository.findAllByUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(this::toEducationResponse)
                .toList();
    }

    @Transactional
    public CertificationResponse addCertification(UUID userId, CertificationRequest request) {
        UserAccount user = requireUser(userId);
        UserCertification cert = new UserCertification();
        cert.setUser(user);
        applyCertification(cert, request);
        certificationRepository.save(cert);

        auditTrailService.log(
                "USER",
                user.getFullName(),
                user.getId(),
                ACTION_USER_CERTIFICATION_ADDED,
                null,
                null,
                "Added certification: " + request.name() + " issued by " + request.issuingOrg()
        );

        return toCertificationResponse(cert);
    }

    @Transactional
    public CertificationResponse updateCertification(UUID userId, UUID certificationId, CertificationRequest request) {
        UserCertification cert = requireCertification(userId, certificationId);
        UserAccount user = cert.getUser();

        List<AuditTrailChangeResponse> changes = new ArrayList<>();
        compareField(changes, "certificationName", cert.getName(), request.name());
        compareField(changes, "issuingOrg", cert.getIssuingOrg(), request.issuingOrg());
        compareField(changes, "issueDate", cert.getIssueDate() != null ? cert.getIssueDate().toString() : null, parseDate(request.issueDate()) != null ? parseDate(request.issueDate()).toString() : null);
        compareField(changes, "expiryDate", cert.getExpiryDate() != null ? cert.getExpiryDate().toString() : null, parseDate(request.expiryDate()) != null ? parseDate(request.expiryDate()).toString() : null);

        applyCertification(cert, request);

        auditTrailService.log(
                "USER",
                user.getFullName(),
                user.getId(),
                ACTION_USER_CERTIFICATION_UPDATED,
                null,
                null,
                "Updated certification: " + cert.getName(),
                changes
        );

        return toCertificationResponse(cert);
    }

    public record CertificationFileDownload(byte[] content, String fileName, String contentType) {
    }

    @Transactional
    public CertificationResponse uploadCertificationFile(UUID userId, UUID certificationId, org.springframework.web.multipart.MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File is required");
        }
        UserCertification cert = requireCertification(userId, certificationId);
        UserAccount user = cert.getUser();
        String originalName = hasText(file.getOriginalFilename()) ? file.getOriginalFilename() : "certificate";
        try (var inputStream = file.getInputStream()) {
            FileStorageService.StorageWriteResult stored = fileStorageService.storeUserCertificationFile(userId, certificationId, originalName, inputStream);
            cert.setFileName(originalName);
            cert.setFileSize(file.getSize());
            cert.setFileType(file.getContentType());
            cert.setFileUrl(stored.storedPath());
            certificationRepository.save(cert);
        } catch (java.io.IOException ex) {
            throw new IllegalStateException("Failed to store certification file: " + ex.getMessage(), ex);
        }

        auditTrailService.log(
                "USER",
                user.getFullName(),
                user.getId(),
                ACTION_USER_CERTIFICATION_UPDATED,
                null,
                null,
                "Attached file \"" + originalName + "\" to certification: " + cert.getName()
        );

        return toCertificationResponse(cert);
    }

    public CertificationFileDownload downloadCertificationFile(UUID userId, UUID certificationId) {
        UserCertification cert = requireCertification(userId, certificationId);
        if (!hasText(cert.getFileUrl())) {
            throw new IllegalArgumentException("This certification has no attached file");
        }
        try {
            byte[] content = fileStorageService.readFile(cert.getFileUrl());
            return new CertificationFileDownload(content, cert.getFileName(), cert.getFileType());
        } catch (java.io.IOException ex) {
            throw new IllegalStateException("Failed to read certification file: " + ex.getMessage(), ex);
        }
    }

    @Transactional
    public void deleteCertification(UUID userId, UUID certificationId) {
        UserCertification cert = requireCertification(userId, certificationId);
        UserAccount user = cert.getUser();

        auditTrailService.log(
                "USER",
                user.getFullName(),
                user.getId(),
                ACTION_USER_CERTIFICATION_DELETED,
                null,
                null,
                "Removed certification: " + cert.getName() + " issued by " + cert.getIssuingOrg()
        );

        certificationRepository.delete(cert);
    }

    public List<CertificationResponse> getCertifications(UUID userId) {
        return certificationRepository.findAllByUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(this::toCertificationResponse)
                .toList();
    }

    public UserManagementResponse toResponse(UserAccount user, boolean includeDetails) {
        return toResponse(user, includeDetails, hasActiveSession(user.getId()), hasOnlineSession(user.getId()));
    }

    public UserManagementResponse toResponse(UserAccount user, boolean includeDetails, boolean inSession) {
        return toResponse(user, includeDetails, inSession, hasOnlineSession(user.getId()));
    }

    public UserManagementResponse toResponse(UserAccount user, boolean includeDetails, boolean inSession, boolean online) {
        return toResponse(user, includeDetails, inSession, online, null);
    }

    private UserManagementResponse toResponse(UserAccount user, boolean includeDetails, boolean inSession, boolean online,
            ExternalIdentityProvisioningResponse external) {
        List<String> permissions = permissionCodesForUser(user);
        List<EducationResponse> educations = includeDetails ? getEducations(user.getId()) : List.of();
        List<CertificationResponse> certifications = includeDetails ? getCertifications(user.getId()) : List.of();
        EducationResponse primaryEducation = educations.isEmpty() ? null : educations.get(0);

        String[] names = splitName(user.getFullName());

        return new UserManagementResponse(
                user.getId().toString(),
                user.getEmployeeCode(),
                user.getFullName(),
                user.getUsername(),
                user.getEmail(),
                user.getPhone(),
                user.getRoleName(),
                user.getPosition(),
                user.getBusinessUnit(),
                user.getDepartment(),
                user.getStatus() == null ? null : user.getStatus().name(),
                inSession,
                online,
                user.getLastLoginAt() == null ? "Never" : DateTimeFormatUtils.formatDateTime(user.getLastLoginAt()),
                DateTimeFormatUtils.formatDateTime(user.getCreatedAt()),
                names[0],
                names[1],
                permissions,
                user.getAvatar(),
                requiresPasswordChange(user),
                user.isMfaEnabled(),
                user.isMfaEmailFallbackEnabled(),
                user.isMfaRememberDeviceEnabled(),
                user.isEmailNotificationsEnabled(),
                systemConfigurationService.isMfaRequiredGlobally() && !user.isMfaEnabled() && !user.isMfaEmailFallbackEnabled(),
                systemConfigurationService.isMaintenanceModeEnabled(),
                DateTimeFormatUtils.formatDate(user.getDateOfBirth()),
                user.getGender(),
                user.getNationality(),
                user.getAddress(),
                user.getEmploymentType(),
                DateTimeFormatUtils.formatDate(user.getStartDate()),
                user.getManagerName(),
                user.getLanguage(),
                user.getIdNumber(),
                primaryEducation == null ? null : primaryEducation.degree(),
                primaryEducation == null ? null : primaryEducation.fieldOfStudy(),
                primaryEducation == null ? null : primaryEducation.institution(),
                primaryEducation == null ? null : primaryEducation.graduationYear(),
                primaryEducation == null ? null : primaryEducation.gpa(),
                educations,
                user.getProfessionalLevel(),
                user.getAreaOfExpertise(),
                user.getYearsOfExperience(),
                user.getPreviousEmployer(),
                certifications,
                DateTimeFormatUtils.formatDateTime(user.getPasswordChangedAt()),
                user.getSuspendReason(),
                DateTimeFormatUtils.formatDate(user.getSuspendedUntil()),
                user.getTerminationReason(),
                DateTimeFormatUtils.formatDate(user.getTerminationDate()),
                external == null ? null : external.status(),
                external == null ? null : external.email(),
                external == null ? null : external.statusLabel(),
                external == null ? null : external.statusColor()
        );
    }

    private boolean requiresPasswordChange(UserAccount user) {
        return user != null && (user.isMustChangePassword() || systemConfigurationService.isPasswordExpired(user));
    }

    private Specification<UserAccount> buildSpecification(
            String search,
            String role,
            String status,
            String online,
            String businessUnit,
            String department,
            String position,
            String dateFrom,
            String dateTo,
            String suspendFrom,
            String suspendTo,
            String terminateFrom,
            String terminateTo,
            boolean includeTerminated
    ) {
        return (root, query, cb) -> {
            List<jakarta.persistence.criteria.Predicate> predicates = new ArrayList<>();
            if (search != null && !search.isBlank()) {
                String q = "%" + search.trim().toLowerCase(Locale.ROOT) + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("fullName")), q),
                        cb.like(cb.lower(root.get("username")), q),
                        cb.like(cb.lower(root.get("email")), q),
                        cb.like(cb.lower(root.get("employeeCode")), q)
                ));
            }
            if (role != null && !role.isBlank() && !"All".equalsIgnoreCase(role)) {
                predicates.add(cb.equal(root.get("roleName"), role));
            }
            if (status != null && !status.isBlank() && !"All".equalsIgnoreCase(status)) {
                predicates.add(cb.equal(root.get("status"), UserStatus.valueOf(status)));
            }
            if (online != null && (online.equalsIgnoreCase("online") || online.equalsIgnoreCase("offline"))) {
                Instant now = Instant.now();
                jakarta.persistence.criteria.Subquery<UUID> onlineSession = query.subquery(UUID.class);
                jakarta.persistence.criteria.Root<AuthSession> session = onlineSession.from(AuthSession.class);
                onlineSession.select(session.get("user").get("id"));
                onlineSession.where(
                        cb.equal(session.get("user").get("id"), root.get("id")),
                        cb.isNull(session.get("revokedAt")),
                        cb.equal(session.get("status"), AuthSession.SessionStatus.ACTIVE),
                        cb.greaterThan(session.get("expiresAt"), now),
                        cb.greaterThan(session.get("lastActivityAt"), now.minus(java.time.Duration.ofMinutes(5)))
                );
                predicates.add(online.equalsIgnoreCase("online") ? cb.exists(onlineSession) : cb.not(cb.exists(onlineSession)));
            }
            if (businessUnit != null && !businessUnit.isBlank() && !"All".equalsIgnoreCase(businessUnit)) {
                predicates.add(cb.equal(root.get("businessUnit"), businessUnit));
            }
            if (department != null && !department.isBlank() && !"All".equalsIgnoreCase(department)) {
                predicates.add(cb.equal(root.get("department"), department));
            }
            if (position != null && !position.isBlank() && !"All".equalsIgnoreCase(position)) {
                predicates.add(cb.equal(root.get("position"), position));
            }
            if (dateFrom != null && !dateFrom.isBlank()) {
                LocalDate parsed = parseDate(dateFrom);
                if (parsed != null) {
                    predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), parsed.atStartOfDay(java.time.ZoneOffset.UTC).toInstant()));
                }
            }
            if (dateTo != null && !dateTo.isBlank()) {
                LocalDate parsed = parseDate(dateTo);
                if (parsed != null) {
                    predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), parsed.plusDays(1).atStartOfDay(java.time.ZoneOffset.UTC).minusNanos(1).toInstant()));
                }
            }
            if (suspendFrom != null && !suspendFrom.isBlank()) {
                LocalDate parsed = parseDate(suspendFrom);
                if (parsed != null) {
                    predicates.add(cb.greaterThanOrEqualTo(root.get("suspendedUntil"), parsed));
                }
            }
            if (suspendTo != null && !suspendTo.isBlank()) {
                LocalDate parsed = parseDate(suspendTo);
                if (parsed != null) {
                    predicates.add(cb.lessThanOrEqualTo(root.get("suspendedUntil"), parsed));
                }
            }
            if (terminateFrom != null && !terminateFrom.isBlank()) {
                LocalDate parsed = parseDate(terminateFrom);
                if (parsed != null) {
                    predicates.add(cb.greaterThanOrEqualTo(root.get("terminationDate"), parsed));
                }
            }
            if (terminateTo != null && !terminateTo.isBlank()) {
                LocalDate parsed = parseDate(terminateTo);
                if (parsed != null) {
                    predicates.add(cb.lessThanOrEqualTo(root.get("terminationDate"), parsed));
                }
            }
            boolean requestingTerminated = status != null && status.equalsIgnoreCase(UserStatus.Terminated.name());
            if (!includeTerminated && !requestingTerminated) {
                predicates.add(cb.notEqual(root.get("status"), UserStatus.Terminated));
            }
            return cb.and(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };
    }

    private String resolveSortProperty(String sortBy) {
        if (sortBy == null || sortBy.isBlank()) {
            return "employeeCode";
        }
        return switch (sortBy) {
            case "employeeCode" -> "employeeCode";
            case "fullName" -> "fullName";
            case "username" -> "username";
            case "email" -> "email";
            case "phone" -> "phone";
            case "role" -> "roleName";
            case "position" -> "position";
            case "businessUnit" -> "businessUnit";
            case "department" -> "department";
            case "status" -> "status";
            case "suspendedUntil" -> "suspendedUntil";
            case "terminationDate" -> "terminationDate";
            case "lastLogin" -> "lastLoginAt";
            case "createdDate" -> "createdAt";
            default -> "employeeCode";
        };
    }

    private boolean showTerminated(String status) {
        return status != null && status.equalsIgnoreCase(UserStatus.Terminated.name());
    }

    private void validateUniqueOnCreate(String employeeCode, String username, String email) {
        if (employeeCode != null && userRepository.findByEmployeeCode(employeeCode).isPresent()) {
            throw new IllegalArgumentException("Employee ID already exists");
        }
        if (userRepository.findByUsername(username).isPresent()) {
            throw new IllegalArgumentException("Username already exists");
        }
        if (userRepository.findByEmail(email).isPresent()) {
            throw new IllegalArgumentException("Email already exists");
        }
    }

    private void validateUniqueOnUpdate(UserAccount current, String employeeCode, String username, String email) {
        if (employeeCode != null && !employeeCode.equals(current.getEmployeeCode())) {
            userRepository.findByEmployeeCode(employeeCode).ifPresent(found -> {
                if (!found.getId().equals(current.getId())) {
                    throw new IllegalArgumentException("Employee ID already exists");
                }
            });
        }
        if (username != null && !username.equals(current.getUsername())) {
            userRepository.findByUsername(username).ifPresent(found -> {
                if (!found.getId().equals(current.getId())) {
                    throw new IllegalArgumentException("Username already exists");
                }
            });
        }
        if (email != null && !email.equals(current.getEmail())) {
            userRepository.findByEmail(email).ifPresent(found -> {
                if (!found.getId().equals(current.getId())) {
                    throw new IllegalArgumentException("Email already exists");
                }
            });
        }
    }

    private void applyCreateOrUpdate(UserAccount user, CreateUserRequest request) {
        user.setEmployeeCode(normalizeRequired(request.employeeCode(), "Employee ID"));
        user.setUsername(normalizeRequired(request.username(), "Username"));
        user.setFullName(normalizeRequired(request.fullName(), "Full Name"));
        user.setEmail(normalizeRequired(request.email(), "Email"));
        user.setPhone(normalizePhone(request.phone()));
        user.setRoleName(requireRoleName(request.role()));
        user.setBusinessUnit(requireBusinessUnit(request.businessUnit()));
        user.setDepartment(requireDepartment(request.businessUnit(), request.department()));
        user.setPosition(requirePosition(request.businessUnit(), request.department(), request.position()));
        user.setStatus(requireStatus(request.status()));
        user.setDateOfBirth(parseDateStrictOptional(request.dateOfBirth(), "Date of Birth", false));
        user.setGender(blankToNull(request.gender()));
        user.setNationality(blankToNull(request.nationality()));
        user.setAddress(blankToNull(request.address()));
        user.setEmploymentType(requireEmploymentType(request.employmentType()));
        user.setStartDate(parseDateStrictOptional(request.startDate(), "Start Date", true));
        user.setManagerName(blankToNull(request.managerName()));
        user.setLanguage(requireLanguageIfProvided(request.language()));
        user.setIdNumber(blankToNull(request.idNumber()));
        user.setProfessionalLevel(blankToNull(request.professionalLevel()));
        user.setAreaOfExpertise(blankToNull(request.areaOfExpertise()));
        user.setYearsOfExperience(blankToNull(request.yearsOfExperience()));
        user.setPreviousEmployer(blankToNull(request.previousEmployer()));
    }

    private void applyUpdate(UserAccount user, UpdateUserRequest request) {
        if (request.employeeCode() != null) user.setEmployeeCode(normalizeRequired(request.employeeCode(), "Employee ID"));
        if (request.username() != null) user.setUsername(normalizeRequired(request.username(), "Username"));
        if (request.fullName() != null) user.setFullName(normalizeRequired(request.fullName(), "Full Name"));
        if (request.email() != null) user.setEmail(normalizeRequired(request.email(), "Email"));
        if (request.phone() != null) user.setPhone(normalizePhone(request.phone()));
        if (request.role() != null) user.setRoleName(requireRoleName(request.role()));
        if (request.businessUnit() != null) user.setBusinessUnit(requireBusinessUnit(request.businessUnit()));
        if (request.department() != null) user.setDepartment(requireDepartment(request.businessUnit() != null ? request.businessUnit() : user.getBusinessUnit(), request.department()));
        if (request.position() != null) user.setPosition(requirePosition(
                request.businessUnit() != null ? request.businessUnit() : user.getBusinessUnit(),
                request.department() != null ? request.department() : user.getDepartment(),
                request.position()
        ));
        if (request.status() != null) user.setStatus(requireStatus(request.status()));
        if (request.dateOfBirth() != null) user.setDateOfBirth(parseDateStrictOptional(request.dateOfBirth(), "Date of Birth", false));
        if (request.gender() != null) user.setGender(blankToNull(request.gender()));
        if (request.nationality() != null) user.setNationality(blankToNull(request.nationality()));
        if (request.address() != null) user.setAddress(blankToNull(request.address()));
        if (request.employmentType() != null) user.setEmploymentType(requireEmploymentType(request.employmentType()));
        if (request.startDate() != null) user.setStartDate(parseDateStrictOptional(request.startDate(), "Start Date", true));
        if (request.managerName() != null) user.setManagerName(blankToNull(request.managerName()));
        if (request.language() != null) user.setLanguage(requireLanguageIfProvided(request.language()));
        if (request.idNumber() != null) user.setIdNumber(blankToNull(request.idNumber()));
        if (request.professionalLevel() != null) user.setProfessionalLevel(blankToNull(request.professionalLevel()));
        if (request.areaOfExpertise() != null) user.setAreaOfExpertise(blankToNull(request.areaOfExpertise()));
        if (request.yearsOfExperience() != null) user.setYearsOfExperience(blankToNull(request.yearsOfExperience()));
        if (request.previousEmployer() != null) user.setPreviousEmployer(blankToNull(request.previousEmployer()));
        if (request.avatar() != null) user.setAvatar(blankToNull(request.avatar()));
    }

    private void validateCreateRequest(CreateUserRequest request) {
        normalizeRequired(request.employeeCode(), "Employee ID");
        normalizeRequired(request.username(), "Username");
        normalizeRequired(request.fullName(), "Full Name");
        normalizeRequired(request.email(), "Email");
        validatePhone(request.phone());
        requireRoleName(request.role());
        requireBusinessUnit(request.businessUnit());
        requireDepartment(request.businessUnit(), request.department());
        requirePosition(request.businessUnit(), request.department(), request.position());
        requireStatus(request.status());
        validateDateOfBirth(request.dateOfBirth());
        validateStartDate(request.startDate());
        validateGenderIfProvided(request.gender());
        requireEmploymentType(request.employmentType());
        requireLanguageIfProvided(request.language());
    }

    private void validateUpdateRequest(UserAccount current, UpdateUserRequest request) {
        if (request.employeeCode() != null) {
            normalizeRequired(request.employeeCode(), "Employee ID");
        }
        if (request.username() != null) {
            normalizeRequired(request.username(), "Username");
        }
        if (request.fullName() != null) {
            normalizeRequired(request.fullName(), "Full Name");
        }
        if (request.email() != null) {
            normalizeRequired(request.email(), "Email");
        }
        if (request.phone() != null) {
            validatePhone(request.phone());
        }
        if (request.role() != null) {
            requireRoleName(request.role());
        }

        // Only re-validate the Business Unit / Department / Position hierarchy when the request
        // actually touches one of those fields. Re-checking the user's existing (unchanged) values
        // on every save would block unrelated edits (e.g. email) whenever a dictionary entry was
        // later renamed or removed — the stored value was valid when it was assigned.
        if (request.businessUnit() != null || request.department() != null || request.position() != null) {
            String effectiveBusinessUnit = request.businessUnit() != null ? normalizeOptional(request.businessUnit()) : current.getBusinessUnit();
            String effectiveDepartment = request.department() != null ? normalizeOptional(request.department()) : current.getDepartment();
            String effectivePosition = request.position() != null ? normalizeOptional(request.position()) : current.getPosition();
            validateHierarchy(effectiveBusinessUnit, effectiveDepartment, effectivePosition);
        }

        if (request.status() != null) {
            requireStatus(request.status());
        }
        if (request.dateOfBirth() != null) {
            validateDateOfBirth(request.dateOfBirth());
        }
        if (request.gender() != null) {
            validateGenderIfProvided(request.gender());
        }
        if (request.employmentType() != null) {
            requireEmploymentType(request.employmentType());
        }
        if (request.startDate() != null) {
            validateStartDate(request.startDate());
        }
        if (request.language() != null) {
            requireLanguageIfProvided(request.language());
        }
    }

    private UserAccount requireUser(UUID id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
    }

    private UserEducation requireEducation(UUID userId, UUID educationId) {
        UserEducation education = educationRepository.findById(educationId)
                .orElseThrow(() -> new IllegalArgumentException("Education not found"));
        if (!education.getUser().getId().equals(userId)) {
            throw new UnauthorizedException("Education does not belong to current user");
        }
        return education;
    }

    private UserCertification requireCertification(UUID userId, UUID certificationId) {
        UserCertification cert = certificationRepository.findById(certificationId)
                .orElseThrow(() -> new IllegalArgumentException("Certification not found"));
        if (!cert.getUser().getId().equals(userId)) {
            throw new UnauthorizedException("Certification does not belong to current user");
        }
        return cert;
    }

    /** app_users.role_name is not an entitlement source — resolve via the user's Access Profile. */
    private List<String> permissionCodesForUser(UserAccount user) {
        return permissionEvaluationService.getPermissionCodes(user)
                .stream()
                .sorted(String::compareToIgnoreCase)
                .toList();
    }

    private RoleDefinition requireRole(UUID id) {
        return roleRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Role not found"));
    }

    private List<String> permissionCodesForRole(RoleDefinition role) {
        return rolePermissionRepository.findAllByRole_Id(role.getId())
                .stream()
                .map(rolePermission -> rolePermission.getPermission().getCode())
                .sorted(String::compareToIgnoreCase)
                .toList();
    }

    private RoleSummaryResponse toRoleSummaryResponse(RoleDefinition role) {
        return new RoleSummaryResponse(
                role.getId().toString(),
                role.getCode(),
                role.getName(),
                role.getDescription(),
                role.isSystem() ? "system" : "custom",
                role.isActive(),
                userRepository.countByRoleName(role.getName()),
                permissionCodesForRole(role),
                DateTimeFormatUtils.formatDateTime(role.getCreatedAt()),
                DateTimeFormatUtils.formatDateTime(role.getUpdatedAt())
        );
    }

    private Specification<RoleDefinition> buildRoleSpecification(String search, String type, String status) {
        return (root, query, cb) -> {
            List<jakarta.persistence.criteria.Predicate> predicates = new ArrayList<>();

            if (search != null && !search.trim().isBlank()) {
                String keyword = "%" + search.trim().toLowerCase(Locale.ROOT) + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("name")), keyword),
                        cb.like(cb.lower(root.get("code")), keyword),
                        cb.like(cb.lower(root.get("description")), keyword)
                ));
            }

            if (type != null && !type.isBlank() && !"all".equalsIgnoreCase(type)) {
                boolean system = "system".equalsIgnoreCase(type);
                predicates.add(cb.equal(root.get("system"), system));
            }

            if (status != null && !status.isBlank() && !"all".equalsIgnoreCase(status)) {
                boolean active = "active".equalsIgnoreCase(status);
                predicates.add(cb.equal(root.get("active"), active));
            }

            return cb.and(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };
    }

    private Comparator<RoleSummaryResponse> buildRoleComparator(String sortBy, String sortDirection) {
        Comparator<RoleSummaryResponse> comparator = switch (normalizeSortKey(sortBy)) {
            case "code" -> Comparator.comparing(RoleSummaryResponse::code, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER));
            case "description" -> Comparator.comparing(RoleSummaryResponse::description, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER));
            case "type" -> Comparator.comparing(RoleSummaryResponse::type, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER));
            case "active" -> Comparator.comparing(RoleSummaryResponse::active);
            case "usercount" -> Comparator.comparingLong(RoleSummaryResponse::userCount);
            case "permissions" -> Comparator.comparingInt(role -> role.permissions() == null ? 0 : role.permissions().size());
            case "createddate" -> Comparator.comparing(role -> parseDateTimeString(role.createdDate()), Comparator.nullsLast(Comparator.naturalOrder()));
            case "modifieddate" -> Comparator.comparing(role -> parseDateTimeString(role.modifiedDate()), Comparator.nullsLast(Comparator.naturalOrder()));
            case "name" -> Comparator.comparing(RoleSummaryResponse::role, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER));
            default -> Comparator.comparing(RoleSummaryResponse::role, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER));
        };

        if ("desc".equalsIgnoreCase(sortDirection)) {
            comparator = comparator.reversed();
        }
        return comparator.thenComparing(RoleSummaryResponse::role, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER));
    }

    private String normalizeSortKey(String sortBy) {
        if (sortBy == null || sortBy.isBlank()) {
            return "name";
        }
        return sortBy.trim().toLowerCase(Locale.ROOT);
    }

    private LocalDateTime parseDateTimeString(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return LocalDateTime.parse(value, DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss"));
        } catch (Exception ignored) {
            return null;
        }
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private List<Permission> resolvePermissions(List<String> codes) {
        if (codes == null || codes.isEmpty()) return List.of();
        return codes.stream()
                .filter(c -> c != null && !c.isBlank())
                .distinct()
                .map(code -> permissionRepository.findByCode(code)
                        .orElseThrow(() -> new IllegalArgumentException("Permission not found: " + code)))
                .toList();
    }

    private void replaceRolePermissionsResolved(RoleDefinition role, List<Permission> permissions) {
        rolePermissionRepository.deleteAllByRole_Id(role.getId());
        for (Permission permission : permissions) {
            RolePermission rp = new RolePermission();
            RolePermissionId rpId = new RolePermissionId();
            rpId.setRoleId(role.getId());
            rpId.setPermissionId(permission.getId());
            rp.setId(rpId);
            rp.setRole(role);
            rp.setPermission(permission);
            rolePermissionRepository.save(rp);
        }
    }

    private void replaceRolePermissions(RoleDefinition role, List<String> permissions) {
        replaceRolePermissionsResolved(role, resolvePermissions(permissions));
    }

    private DocumentWorkflowSetting requireDocumentWorkflowSetting() {
        return documentWorkflowSettingRepository.findFirstByOrderByIdAsc()
                .orElseGet(() -> {
                    DocumentWorkflowSetting setting = new DocumentWorkflowSetting();
                    return documentWorkflowSettingRepository.save(setting);
                });
    }

    private List<String> poolUserIds(String poolType) {
        return documentWorkflowPoolMemberRepository.findAllByPoolTypeAndActiveTrueOrderByCreatedAtAsc(poolType)
                .stream()
                .map(member -> member.getUser() == null || member.getUser().getId() == null ? null : member.getUser().getId().toString())
                .filter(value -> value != null && !value.isBlank())
                .toList();
    }

    private List<String> singlePoolUserIds(String poolType) {
        List<String> ids = poolUserIds(poolType);
        if (ids.isEmpty()) {
            return List.of();
        }
        return List.of(ids.get(0));
    }

    private List<String> distinctNonBlank(List<String> values) {
        if (values == null) {
            return List.of();
        }
        return values.stream()
                .filter(value -> value != null && !value.isBlank())
                .distinct()
                .toList();
    }

    private void replacePoolMembers(String poolType, List<String> userIds) {
        if (userIds == null || userIds.isEmpty()) {
            documentWorkflowPoolMemberRepository.deleteAllByPoolType(poolType);
            return;
        }
        List<UUID> uniqueIds = userIds.stream()
                .filter(value -> value != null && !value.isBlank())
                .map(UUID::fromString)
                .distinct()
                .toList();
        List<UserAccount> resolvedUsers = uniqueIds.stream()
                .map(this::requireUser)
                .toList();
        documentWorkflowPoolMemberRepository.deleteAllByPoolType(poolType);
        for (UserAccount user : resolvedUsers) {
            DocumentWorkflowPoolMember member = new DocumentWorkflowPoolMember();
            member.setPoolType(poolType);
            member.setUser(user);
            member.setActive(true);
            documentWorkflowPoolMemberRepository.save(member);
        }
    }

    private String slugify(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        return value.trim()
                .toUpperCase(Locale.ROOT)
                .replaceAll("[^A-Z0-9]+", "_")
                .replaceAll("^_+|_+$", "");
    }

    private void revokeAllSessions(UUID userId) {
        sessionRepository.findAllByUserIdAndRevokedAtIsNullOrderByCreatedAtDesc(userId)
                .forEach(session -> {
                    session.setRevokedAt(Instant.now());
                    session.setCurrentSession(false);
                    session.setStatus(AuthSession.SessionStatus.REVOKED);
                });
    }

    private boolean hasActiveSession(UUID userId) {
        return sessionRepository.existsByUserIdAndRevokedAtIsNullAndStatusAndExpiresAtAfter(
                userId,
                AuthSession.SessionStatus.ACTIVE,
                Instant.now()
        );
    }

    private Set<UUID> activeSessionUserIds(List<UUID> userIds) {
        if (userIds == null || userIds.isEmpty()) {
            return Set.of();
        }
        return sessionRepository.findAllByUserIdInAndRevokedAtIsNullAndStatusAndExpiresAtAfter(
                        userIds,
                        AuthSession.SessionStatus.ACTIVE,
                        Instant.now()
                ).stream()
                .map(session -> session.getUser() == null ? null : session.getUser().getId())
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toSet());
    }

    /** A browser refreshes its authenticated session every 30 seconds. Five minutes tolerates
     * brief network interruptions without treating an idle but open session as permanently online. */
    private boolean hasOnlineSession(UUID userId) {
        Instant now = Instant.now();
        return sessionRepository.existsByUserIdAndRevokedAtIsNullAndStatusAndExpiresAtAfterAndLastActivityAtAfter(
                userId, AuthSession.SessionStatus.ACTIVE, now, now.minus(java.time.Duration.ofMinutes(5)));
    }

    private Set<UUID> onlineSessionUserIds(List<UUID> userIds) {
        if (userIds == null || userIds.isEmpty()) {
            return Set.of();
        }
        Instant now = Instant.now();
        return sessionRepository.findAllByUserIdInAndRevokedAtIsNullAndStatusAndExpiresAtAfterAndLastActivityAtAfter(
                        userIds, AuthSession.SessionStatus.ACTIVE, now, now.minus(java.time.Duration.ofMinutes(5)))
                .stream()
                .map(session -> session.getUser() == null ? null : session.getUser().getId())
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toSet());
    }

    private void applyCertification(UserCertification cert, CertificationRequest request) {
        cert.setName(request.name());
        cert.setIssuingOrg(request.issuingOrg());
        cert.setIssueDate(parseDateStrictOptional(request.issueDate(), "Issue Date", false));
        cert.setExpiryDate(parseDateStrictOptional(request.expiryDate(), "Expiry Date", false));
        cert.setFileName(blankToNull(request.fileName()));
        cert.setFileSize(request.fileSize());
        cert.setFileType(blankToNull(request.fileType()));
        cert.setFileUrl(blankToNull(request.fileUrl()));
    }

    private void syncPrimaryEducation(UserAccount user, String degree, String fieldOfStudy, String institution, String graduationYear, String gpa) {
        boolean hasEducation = (degree != null && !degree.isBlank())
                || (fieldOfStudy != null && !fieldOfStudy.isBlank())
                || (institution != null && !institution.isBlank())
                || (graduationYear != null && !graduationYear.isBlank())
                || (gpa != null && !gpa.isBlank());

        if (!hasEducation) {
            return;
        }

        List<UserEducation> existing = educationRepository.findAllByUserIdOrderByCreatedAtDesc(user.getId());
        UserEducation education = existing.isEmpty() ? new UserEducation() : existing.get(0);
        education.setUser(user);
        education.setDegree(blankToNull(degree));
        education.setFieldOfStudy(blankToNull(fieldOfStudy));
        education.setInstitution(blankToNull(institution));
        education.setGraduationYear(blankToNull(graduationYear));
        education.setGpa(blankToNull(gpa));
        educationRepository.save(education);
    }

    private EducationResponse toEducationResponse(UserEducation education) {
        return new EducationResponse(
                education.getId().toString(),
                education.getDegree(),
                education.getFieldOfStudy(),
                education.getInstitution(),
                education.getGraduationYear(),
                education.getGpa()
        );
    }

    private CertificationResponse toCertificationResponse(UserCertification cert) {
        return new CertificationResponse(
                cert.getId().toString(),
                cert.getName(),
                cert.getIssuingOrg(),
                DateTimeFormatUtils.formatDate(cert.getIssueDate()),
                DateTimeFormatUtils.formatDate(cert.getExpiryDate()),
                cert.getFileName(),
                cert.getFileSize(),
                cert.getFileType(),
                cert.getFileUrl()
        );
    }

    private String generatePassword() {
        com.fasterxml.jackson.databind.JsonNode security = systemConfigurationService.requireConfiguration().getSecurityConfig();
        int minLength = security != null ? security.path("passwordMinLength").asInt(12) : 12;
        if (minLength < 8) minLength = 8;

        String uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        String lowercase = "abcdefghijklmnopqrstuvwxyz";
        String numbers = "0123456789";
        String special = "@#$%&*!?";
        String all = uppercase + lowercase + numbers + special;
        java.security.SecureRandom random = new java.security.SecureRandom();
        StringBuilder password = new StringBuilder();
        password.append(uppercase.charAt(random.nextInt(uppercase.length())));
        password.append(lowercase.charAt(random.nextInt(lowercase.length())));
        password.append(numbers.charAt(random.nextInt(numbers.length())));
        password.append(special.charAt(random.nextInt(special.length())));
        while (password.length() < minLength) {
            password.append(all.charAt(random.nextInt(all.length())));
        }
        return password.toString().chars()
                .mapToObj(c -> String.valueOf((char) c))
                .collect(Collectors.collectingAndThen(Collectors.toList(), list -> {
                    java.util.Collections.shuffle(list);
                    return String.join("", list);
                }));
    }

    private LocalDate parseDate(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return parseFlexibleLocalDate(value);
        } catch (DateTimeParseException ex) {
            return null;
        }
    }

    private LocalDate parseDateStrictOptional(String value, String fieldName, boolean disallowFuture) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            LocalDate parsed = parseFlexibleLocalDate(value);
            if (disallowFuture && parsed.isAfter(LocalDate.now())) {
                throw new IllegalArgumentException(fieldName + " cannot be in the future");
            }
            return parsed;
        } catch (DateTimeParseException ex) {
            throw new IllegalArgumentException(fieldName + " is invalid");
        }
    }

    private LocalDate parseFlexibleLocalDate(String value) {
        String normalized = value.trim();
        String datePart = normalized.contains("T")
                ? normalized.substring(0, 10)
                : normalized.split("\\s+")[0];
        if (datePart.matches("^\\d{4}-\\d{2}-\\d{2}$")) {
            return LocalDate.parse(datePart);
        }
        if (datePart.matches("^\\d{2}/\\d{2}/\\d{4}$")) {
            return LocalDate.parse(datePart, DateTimeFormatter.ofPattern("dd/MM/yyyy"));
        }
        return LocalDate.parse(datePart);
    }

    private void validateDateOfBirth(String value) {
        parseDateStrictOptional(value, "Date of Birth", true);
    }

    private void validateStartDate(String value) {
        parseDateStrictOptional(value, "Start Date", true);
    }

    private void validatePhone(String value) {
        if (value == null || value.isBlank()) {
            return;
        }
        if (!value.trim().matches("^\\d{7,15}$")) {
            throw new IllegalArgumentException("Invalid phone number");
        }
    }

    private String normalizePhone(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String normalized = value.trim();
        if (!normalized.matches("^\\d{7,15}$")) {
            throw new IllegalArgumentException("Invalid phone number");
        }
        return normalized;
    }

    private String normalizeOptional(String value) {
        return blankToNull(value);
    }

    private String normalizeRequired(String value, String fieldName) {
        String normalized = blankToNull(value);
        if (normalized == null) {
            throw new IllegalArgumentException(fieldName + " is required");
        }
        return normalized;
    }

    private UserStatus requireStatus(String value) {
        String normalized = normalizeRequired(value, "Status");
        try {
            return UserStatus.valueOf(normalized);
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Invalid status");
        }
    }

    private String requireRoleName(String value) {
        String normalized = normalizeRequired(value, "Role");
        if (roleRepository.findByNameIgnoreCase(normalized).isPresent()) {
            return roleRepository.findByNameIgnoreCase(normalized).get().getName();
        }
        return roleRepository.findByCodeIgnoreCase(normalized)
                .map(RoleDefinition::getName)
                .orElseThrow(() -> new IllegalArgumentException("Invalid role"));
    }

    private String requireBusinessUnit(String value) {
        String normalized = normalizeRequired(value, "Business Unit");
        return businessUnitRepository.findByNameIgnoreCase(normalized)
                .or(() -> businessUnitRepository.findByCodeIgnoreCase(normalized))
                .map(BusinessUnit::getName)
                .orElseThrow(() -> new IllegalArgumentException("Invalid business unit"));
    }

    private String requireDepartment(String businessUnitValue, String value) {
        String normalized = normalizeRequired(value, "Department");
        Department department = departmentRepository.findByNameIgnoreCase(normalized)
                .or(() -> departmentRepository.findByCodeIgnoreCase(normalized))
                .orElseThrow(() -> new IllegalArgumentException("Invalid department"));
        String effectiveBusinessUnit = requireBusinessUnit(businessUnitValue);
        if (department.getBusinessUnit() == null || department.getBusinessUnit().getName() == null
                || !effectiveBusinessUnit.equalsIgnoreCase(department.getBusinessUnit().getName())) {
            throw new IllegalArgumentException("Department does not belong to selected Business Unit");
        }
        return department.getName();
    }

    private String requirePosition(String businessUnitValue, String departmentValue, String value) {
        String normalized = normalizeRequired(value, "Position");
        Position position = positionRepository.findByNameIgnoreCase(normalized)
                .or(() -> positionRepository.findByCodeIgnoreCase(normalized))
                .orElseThrow(() -> new IllegalArgumentException("Invalid position"));
        String effectiveBusinessUnit = requireBusinessUnit(businessUnitValue);
        String effectiveDepartment = requireDepartment(businessUnitValue, departmentValue);
        if (position.getBusinessUnit() == null || position.getBusinessUnit().getName() == null
                || position.getDepartment() == null || position.getDepartment().getName() == null
                || !effectiveBusinessUnit.equalsIgnoreCase(position.getBusinessUnit().getName())
                || !effectiveDepartment.equalsIgnoreCase(position.getDepartment().getName())) {
            throw new IllegalArgumentException("Position does not match selected Business Unit / Department");
        }
        return position.getName();
    }

    private String requireEmploymentType(String value) {
        String normalized = normalizeRequired(value, "Employment Type");
        List<String> allowed = List.of("Full-time", "Part-time", "Contract", "Intern");
        if (allowed.stream().noneMatch(item -> item.equalsIgnoreCase(normalized))) {
            throw new IllegalArgumentException("Invalid employment type");
        }
        return allowed.stream()
                .filter(item -> item.equalsIgnoreCase(normalized))
                .findFirst()
                .orElse(normalized);
    }

    private String requireLanguageIfProvided(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String normalized = value.trim();
        return userLanguageRepository.findByCodeIgnoreCase(normalized)
                .map(UserLanguage::getName)
                .or(() -> userLanguageRepository.findAllByActiveTrueOrderBySortOrderAscNameAsc()
                        .stream()
                        .filter(language -> language.getName() != null && language.getName().equalsIgnoreCase(normalized))
                        .findFirst()
                        .map(UserLanguage::getName))
                .orElseThrow(() -> new IllegalArgumentException("Invalid language"));
    }

    private void validateGenderIfProvided(String value) {
        if (value == null || value.isBlank()) {
            return;
        }
        List<String> allowed = List.of("Male", "Female", "Other");
        if (allowed.stream().noneMatch(item -> item.equalsIgnoreCase(value.trim()))) {
            throw new IllegalArgumentException("Invalid gender");
        }
    }

    private void validateHierarchy(String businessUnitValue, String departmentValue, String positionValue) {
        if (businessUnitValue == null || businessUnitValue.isBlank()) {
            throw new IllegalArgumentException("Business Unit is required");
        }
        if (departmentValue == null || departmentValue.isBlank()) {
            throw new IllegalArgumentException("Department is required");
        }
        if (positionValue == null || positionValue.isBlank()) {
            throw new IllegalArgumentException("Position is required");
        }
        requirePosition(businessUnitValue, departmentValue, positionValue);
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private UUID parseUuid(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return UUID.fromString(value.trim());
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }

    private UUID resolveSignatureId(String signatureToken, UserAccount actor) {
        if (!hasText(signatureToken)) {
            return null;
        }
        var parsed = tokenService.parseSignatureToken(signatureToken)
                .orElseThrow(() -> new UnauthorizedException("Electronic signature is invalid or expired"));
        if (!parsed.principal().userId().equals(actor.getId())) {
            throw new UnauthorizedException("Electronic signature must belong to the current user");
        }
        return parsed.principal().sessionId();
    }

    private Map<String, Object> auditDetails(Object... keyValues) {
        Map<String, Object> details = new LinkedHashMap<>();
        for (int i = 0; i + 1 < keyValues.length; i += 2) {
            Object key = keyValues[i];
            Object value = keyValues[i + 1];
            if (key != null && value != null) {
                details.put(String.valueOf(key), value);
            }
        }
        return details;
    }

    private String[] splitName(String fullName) {
        if (fullName == null || fullName.isBlank()) {
            return new String[]{"", ""};
        }
        String[] parts = fullName.trim().split("\\s+");
        if (parts.length == 1) {
            return new String[]{parts[0], ""};
        }
        String first = parts[0];
        String last = String.join(" ", java.util.Arrays.copyOfRange(parts, 1, parts.length));
        return new String[]{first, last};
    }

    private LookupItemResponse option(String value) {
        return new LookupItemResponse(null, value, value, value, value);
    }

    private String csv(String value) {
        if (value == null) {
            return "";
        }
        String escaped = value.replace("\"", "\"\"");
        if (escaped.contains(",") || escaped.contains("\"") || escaped.contains("\n")) {
            return "\"" + escaped + "\"";
        }
        return escaped;
    }

    private String clientIp(HttpServletRequest request) {
        return request == null ? null : request.getRemoteAddr();
    }

    private String userAgent(HttpServletRequest request) {
        return request == null ? null : request.getHeader("User-Agent");
    }

    private List<AuditTrailChangeResponse> detectUserChanges(UserAccount user, UpdateUserRequest request) {
        List<AuditTrailChangeResponse> changes = new ArrayList<>();
        compareField(changes, "employeeCode", user.getEmployeeCode(), request.employeeCode());
        compareField(changes, "username", user.getUsername(), request.username());
        compareField(changes, "fullName", user.getFullName(), request.fullName());
        compareField(changes, "email", user.getEmail(), request.email());
        compareField(changes, "phone", user.getPhone(), request.phone());
        compareField(changes, "role", user.getRoleName(), request.role());
        compareField(changes, "businessUnit", user.getBusinessUnit(), blankToNull(request.businessUnit()));
        compareField(changes, "department", user.getDepartment(), blankToNull(request.department()));
        compareField(changes, "position", user.getPosition(), blankToNull(request.position()));
        
        if (request.status() != null) {
            compareField(changes, "status", user.getStatus() != null ? user.getStatus().name() : null, request.status());
        }
        if (request.dateOfBirth() != null) {
            compareField(changes, "dateOfBirth", user.getDateOfBirth() != null ? user.getDateOfBirth().toString() : null, parseDate(request.dateOfBirth()) != null ? parseDate(request.dateOfBirth()).toString() : null);
        }
        compareField(changes, "gender", user.getGender(), blankToNull(request.gender()));
        compareField(changes, "nationality", user.getNationality(), blankToNull(request.nationality()));
        compareField(changes, "address", user.getAddress(), blankToNull(request.address()));
        compareField(changes, "employmentType", user.getEmploymentType(), blankToNull(request.employmentType()));
        
        if (request.startDate() != null) {
            compareField(changes, "startDate", user.getStartDate() != null ? user.getStartDate().toString() : null, parseDate(request.startDate()) != null ? parseDate(request.startDate()).toString() : null);
        }
        compareField(changes, "managerName", user.getManagerName(), blankToNull(request.managerName()));
        compareField(changes, "language", user.getLanguage(), blankToNull(request.language()));
        compareField(changes, "idNumber", user.getIdNumber(), blankToNull(request.idNumber()));
        compareField(changes, "professionalLevel", user.getProfessionalLevel(), blankToNull(request.professionalLevel()));
        compareField(changes, "areaOfExpertise", user.getAreaOfExpertise(), blankToNull(request.areaOfExpertise()));
        compareField(changes, "yearsOfExperience", user.getYearsOfExperience(), blankToNull(request.yearsOfExperience()));
        compareField(changes, "previousEmployer", user.getPreviousEmployer(), blankToNull(request.previousEmployer()));
        compareField(changes, "avatar", user.getAvatar(), blankToNull(request.avatar()));
        return changes;
    }

    private void compareField(List<AuditTrailChangeResponse> changes, String field, String oldValue, String newValue) {
        if (newValue != null) {
            String cleanOld = oldValue == null ? "" : oldValue;
            String cleanNew = newValue;
            if (!cleanOld.equals(cleanNew)) {
                changes.add(new AuditTrailChangeResponse(field, cleanOld, cleanNew));
            }
        }
    }
}
