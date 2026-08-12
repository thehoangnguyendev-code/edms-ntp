package com.eqms.service;

import com.eqms.auth.AuthenticatedUser;
import com.eqms.auth.CurrentUserService;
import com.eqms.auth.TokenService;
import com.eqms.auth.TotpService;
import com.eqms.auth.UnauthorizedException;
import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.dto.auth.*;
import com.eqms.dto.user.UserManagementResponse;
import com.eqms.entity.*;
import com.eqms.repository.*;
import com.eqms.util.NotificationPreferenceUtils;
import com.eqms.util.DateTimeFormatUtils;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityNotFoundException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class AuthService {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final boolean MFA_DISABLED = true;
    public static final String TRUSTED_DEVICE_COOKIE = "trustedDeviceToken";
    private static final long TRUSTED_DEVICE_TTL_SECONDS = 8 * 60 * 60;

    private final UserAccountRepository userRepository;
    private final AuthSessionRepository sessionRepository;
    private final LoginChallengeRepository challengeRepository;
    private final MfaFactorRepository mfaFactorRepository;
    private final MfaTrustedDeviceRepository mfaTrustedDeviceRepository;
    private final PasswordResetTokenRepository resetTokenRepository;
    private final RoleDefinitionRepository roleDefinitionRepository;
    private final RolePermissionRepository rolePermissionRepository;
    private final PermissionEvaluationService permissionEvaluationService;
    private final TokenService tokenService;
    private final TotpService totpService;
    private final PasswordEncoder passwordEncoder;
    private final AuthAuditService auditService;
    private final AuditTrailService trailService;
    private final CurrentUserService currentUserService;
    private final UserManagementService userManagementService;
    private final SystemConfigurationService systemConfigurationService;
    private final EmailService emailService;
    private final NotificationDispatcher notificationDispatcher;
    private final ObjectMapper objectMapper;
    private final long accessTokenTtlMinutes;
    private final long refreshTokenTtlDays;
    private final long loginChallengeTtlMinutes;
    private final long signatureTokenTtlMinutes;

    public AuthService(
            UserAccountRepository userRepository,
            AuthSessionRepository sessionRepository,
            LoginChallengeRepository challengeRepository,
            MfaFactorRepository mfaFactorRepository,
            MfaTrustedDeviceRepository mfaTrustedDeviceRepository,
            PasswordResetTokenRepository resetTokenRepository,
            RoleDefinitionRepository roleDefinitionRepository,
            RolePermissionRepository rolePermissionRepository,
            PermissionEvaluationService permissionEvaluationService,
            TokenService tokenService,
            TotpService totpService,
            PasswordEncoder passwordEncoder,
            AuthAuditService auditService,
            AuditTrailService trailService,
            CurrentUserService currentUserService,
            UserManagementService userManagementService,
            SystemConfigurationService systemConfigurationService,
            EmailService emailService,
            NotificationDispatcher notificationDispatcher,
            ObjectMapper objectMapper,
            @Value("${app.auth.access-token-ttl-minutes}") long accessTokenTtlMinutes,
            @Value("${app.auth.refresh-token-ttl-days}") long refreshTokenTtlDays,
            @Value("${app.auth.login-challenge-ttl-minutes}") long loginChallengeTtlMinutes,
            @Value("${app.auth.signature-token-ttl-minutes}") long signatureTokenTtlMinutes
    ) {
        this.userRepository = userRepository;
        this.sessionRepository = sessionRepository;
        this.challengeRepository = challengeRepository;
        this.mfaFactorRepository = mfaFactorRepository;
        this.mfaTrustedDeviceRepository = mfaTrustedDeviceRepository;
        this.resetTokenRepository = resetTokenRepository;
        this.roleDefinitionRepository = roleDefinitionRepository;
        this.rolePermissionRepository = rolePermissionRepository;
        this.permissionEvaluationService = permissionEvaluationService;
        this.tokenService = tokenService;
        this.totpService = totpService;
        this.passwordEncoder = passwordEncoder;
        this.auditService = auditService;
        this.trailService = trailService;
        this.currentUserService = currentUserService;
        this.userManagementService = userManagementService;
        this.systemConfigurationService = systemConfigurationService;
        this.emailService = emailService;
        this.notificationDispatcher = notificationDispatcher;
        this.objectMapper = objectMapper;
        this.accessTokenTtlMinutes = accessTokenTtlMinutes;
        this.refreshTokenTtlDays = refreshTokenTtlDays;
        this.loginChallengeTtlMinutes = loginChallengeTtlMinutes;
        this.signatureTokenTtlMinutes = signatureTokenTtlMinutes;
    }

    // noRollbackFor is required here: a wrong password is an expected business outcome, not a
    // technical failure, and handleFailedLogin()'s failedLoginCount/lockedUntil writes (plus the
    // audit/trail log entries) exist specifically to persist despite this method throwing --
    // without this, @Transactional's default rollback-on-RuntimeException silently discarded
    // every failed-attempt counter increment, so account lockout could never actually trigger
    // (found while live-verifying the new security.account_locked notification wiring).
    @Transactional(noRollbackFor = UnauthorizedException.class)
    public Object login(LoginRequest request, HttpServletRequest httpRequest) {
        UserAccount user = findActiveUserByIdentifier(request.identifier())
                .orElseThrow(() -> new UnauthorizedException("Username or email not found"));

        if (user.getLockedUntil() != null && user.getLockedUntil().isAfter(Instant.now())) {
            throw new UnauthorizedException("Account is locked. Please contact administrator.");
        }

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new UnauthorizedException(handleFailedLogin(user, httpRequest));
        }

        // A successful primary-password login starts a new consecutive-failure
        // window.  Persist this reset before any subsequent authentication
        // work so the next bad password is counted from zero again.
        resetLoginFailures(user);
        user.setLastLoginAt(Instant.now());

        if (MFA_DISABLED) {
            user.setMfaEnabled(false);
            user.setMfaEmailFallbackEnabled(false);
            user.setMfaRememberDeviceEnabled(false);
            AuthSession session = createSession(user, httpRequest, null);
            trailService.logAs(
                    user,
                    "SESSION",
                    "Authentication Session",
                    session.getId(),
                    "LOGIN",
                    null,
                    "ACTIVE",
                    "Login successful"
            );
            return buildAuthResponse(user, session);
        }

        List<MfaFactor> enabledFactors = mfaFactorRepository.findAllByUserIdAndEnabledTrue(user.getId());

        boolean hasAppMfa = user.isMfaEnabled() && enabledFactors.stream().anyMatch(f -> MfaMethod.app.equals(f.getMethod()));
        boolean hasEmailMfa = user.isMfaEmailFallbackEnabled();

        // Challenge MFA only when at least one verification method is available.
        // If both app and email fallback are disabled, the user logs in directly.
        boolean shouldEnforceMfa = hasAppMfa || hasEmailMfa;

        if (shouldEnforceMfa) {
            if (user.isMfaRememberDeviceEnabled() && hasValidTrustedDevice(user, httpRequest)) {
                AuthSession trustedSession = createSession(user, httpRequest, null);
                trailService.logAs(
                        user,
                        "SESSION",
                        "Authentication Session",
                        trustedSession.getId(),
                        "LOGIN",
                        null,
                        "ACTIVE",
                        "Login successful via trusted device"
                );
                auditService.log("login_trusted_device_bypass", user, Map.of(), clientIp(httpRequest), userAgent(httpRequest));
                return buildAuthResponse(user, trustedSession);
            }
            List<String> availableMethods = new java.util.ArrayList<>();
            if (hasAppMfa) {
                availableMethods.add("app");
            }
            if (hasEmailMfa) {
                availableMethods.add("email");
            }
            return createLoginChallenge(user, availableMethods, httpRequest);
        }

        AuthSession session = createSession(user, httpRequest, null);
        trailService.logAs(
                user,
                "SESSION",
                "Authentication Session",
                session.getId(),
                "LOGIN",
                null,
                "ACTIVE",
                "Login successful"
        );
        return buildAuthResponse(user, session);
    }

    @Transactional
    public MfaVerificationOutcome verifyMfa(VerifyMfaRequest request, HttpServletRequest httpRequest) {
        if (MFA_DISABLED) {
            LoginChallenge challenge = challengeRepository.findByMfaTokenHash(tokenService.hashToken(request.mfaToken()))
                    .orElseThrow(() -> new UnauthorizedException("MFA challenge not found or expired"));
            UserAccount user = challenge.getUser();
            challenge.setConsumedAt(Instant.now());
            user.setMfaEnabled(false);
            user.setMfaEmailFallbackEnabled(false);
            user.setMfaRememberDeviceEnabled(false);
            AuthSession session = createSession(user, httpRequest, null);
            resetLoginFailures(user);
            user.setLastLoginAt(Instant.now());
            trailService.logAs(
                    user,
                    "SESSION",
                    "Authentication Session",
                    session.getId(),
                    "LOGIN",
                    null,
                    "ACTIVE",
                    "MFA verification bypassed because MFA is disabled"
            );
            return new MfaVerificationOutcome(buildAuthResponse(user, session), null);
        }

        LoginChallenge challenge = challengeRepository.findByMfaTokenHash(tokenService.hashToken(request.mfaToken()))
                .orElseThrow(() -> new UnauthorizedException("MFA challenge not found or expired"));

        if (challenge.getConsumedAt() != null || challenge.isExpired()) {
            throw new UnauthorizedException("MFA challenge expired");
        }

        UserAccount user = challenge.getUser();
        String method = request.method().toLowerCase(Locale.ROOT);

        if ("email".equals(method)) {
            if (challenge.getOtpHash() == null || !passwordEncoder.matches(request.otp(), challenge.getOtpHash())) {
                challenge.setAttemptCount(challenge.getAttemptCount() + 1);
                throw new UnauthorizedException("Invalid verification code");
            }
        } else if ("app".equals(method)) {
            MfaFactor factor = mfaFactorRepository.findByUserIdAndMethod(user.getId(), MfaMethod.app)
                    .orElseThrow(() -> new UnauthorizedException("Authenticator app is not configured"));
            if (!factor.isEnabled() || !totpService.verify(factor.getSecretEncrypted(), request.otp())) {
                challenge.setAttemptCount(challenge.getAttemptCount() + 1);
                throw new UnauthorizedException("Invalid verification code");
            }
        } else {
            throw new IllegalArgumentException("Unsupported MFA method: " + request.method());
        }

        challenge.setConsumedAt(Instant.now());
        AuthSession session = createSession(user, httpRequest, null);
        // MFA completion is also a successful login.  Keep this explicit so
        // every authentication path resets the consecutive failed-login
        // counter, including users who complete a challenge after a password
        // attempt.
        resetLoginFailures(user);
        user.setLastLoginAt(Instant.now());
        trailService.logAs(
                user,
                "SESSION",
                "Authentication Session",
                session.getId(),
                "LOGIN",
                null,
                "ACTIVE",
                "MFA verification successful"
        );
        String trustedDeviceToken = null;
        if (Boolean.TRUE.equals(request.rememberDevice()) && user.isMfaRememberDeviceEnabled()) {
            trustedDeviceToken = registerTrustedDevice(user, httpRequest);
            auditService.log("trusted_device_issued", user, Map.of(), clientIp(httpRequest), userAgent(httpRequest));
            trailService.logAs(
                    user,
                    "USER",
                    user.getFullName(),
                    user.getId(),
                    "ISSUE_TRUSTED_DEVICE",
                    null,
                    null,
                    "Trusted device issued for MFA bypass"
            );
        }
        return new MfaVerificationOutcome(buildAuthResponse(user, session), trustedDeviceToken);
    }

    @Transactional
    public AuthResponse refresh(RefreshRequest request, HttpServletRequest httpRequest) {
        String refreshToken = null;
        if (request != null && request.refreshToken() != null && !request.refreshToken().isBlank()) {
            refreshToken = request.refreshToken();
        } else if (httpRequest.getCookies() != null) {
            for (jakarta.servlet.http.Cookie cookie : httpRequest.getCookies()) {
                if ("refreshToken".equals(cookie.getName())) {
                    refreshToken = cookie.getValue();
                    break;
                }
            }
        }

        if (refreshToken == null || refreshToken.isBlank()) {
            throw new UnauthorizedException("Refresh token is missing");
        }

        AuthSession session = sessionRepository.findByRefreshTokenHash(tokenService.hashToken(refreshToken))
                .orElseThrow(() -> new UnauthorizedException("Refresh token is invalid"));
        if (!session.isActive()) {
            throw new UnauthorizedException("Refresh token expired or revoked");
        }

        String newRefreshToken = tokenService.createRefreshToken();
        session.setRefreshTokenHash(tokenService.hashToken(newRefreshToken));
        session.setLastActivityAt(Instant.now());
        session.setExpiresAt(Instant.now().plusSeconds(refreshTokenTtlDays * 24 * 60 * 60));

        UserAccount user = session.getUser();
        auditService.log(
                "session_refresh",
                user,
                auditDetails("sessionId", session.getId()),
                clientIp(httpRequest),
                userAgent(httpRequest)
        );
        return new AuthResponse(
                toAuthUserResponse(user, session.getId()),
                tokenService.createAccessToken(user, session.getId()),
                newRefreshToken,
                accessTokenTtlMinutes * 60
        );
    }

    @Transactional
    public void logout(LogoutRequest request, HttpServletRequest httpRequest) {
        AuthSession logoutSession = null;
        String refreshToken = request != null ? request.refreshToken() : null;
        if (refreshToken == null || refreshToken.isBlank()) {
            refreshToken = readCookie(httpRequest, "refreshToken");
        }
        if (refreshToken != null && !refreshToken.isBlank()) {
            logoutSession = sessionRepository.findByRefreshTokenHash(tokenService.hashToken(refreshToken))
                    .map(session -> {
                        session.setRevokedAt(Instant.now());
                        session.setCurrentSession(false);
                        return session;
                    })
                    .orElse(null);
        }

        try {
            AuthenticatedUser principal = currentUserService.requireAuthenticatedPrincipal();
            logoutSession = sessionRepository.findById(principal.sessionId())
                    .map(session -> {
                        session.setRevokedAt(Instant.now());
                        session.setCurrentSession(false);
                        return session;
                    })
                    .orElse(logoutSession);
        } catch (UnauthorizedException ignored) {
            // Logout should still succeed even when the access token is already absent or expired.
        }

        if (logoutSession != null) {
            UserAccount actor = null;
            try {
                actor = currentUserService.requireCurrentUser();
            } catch (UnauthorizedException ignored) {
                actor = logoutSession.getUser();
            }
            trailService.logAs(
                    actor,
                    "SESSION",
                    "Authentication Session",
                    logoutSession.getId(),
                    "LOGOUT",
                    "ACTIVE",
                    "REVOKED",
                    "User logged out"
            );
        }
    }

    @Transactional
    public AuthResponse reauthenticate(ReauthenticateRequest request, HttpServletRequest httpRequest) {
        AuthenticatedUser principal = currentUserService.requireAuthenticatedPrincipal();
        UserAccount user = currentUserService.requireCurrentUser();
        AuthSession session = sessionRepository.findById(principal.sessionId())
                .orElseThrow(() -> new UnauthorizedException("Session not found"));

        if (session.getStatus() != AuthSession.SessionStatus.LOCKED) {
            throw new UnauthorizedException("Session is not locked");
        }

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            session.setFailedReauthCount(session.getFailedReauthCount() + 1);
            auditService.log(
                    "session_reauth_failed",
                    user,
                    auditDetails("sessionId", session.getId(), "failedReauthCount", session.getFailedReauthCount()),
                    clientIp(httpRequest),
                    userAgent(httpRequest)
            );
            auditService.log(
                    "session_logout_after_reauth_failed",
                    user,
                    auditDetails("sessionId", session.getId()),
                    clientIp(httpRequest),
                    userAgent(httpRequest)
            );
            trailService.logSafely(
                    "SESSION",
                    "Session",
                    session.getId(),
                    "SESSION_REAUTH_FAILED",
                    null,
                    null,
                    "Password re-authentication failed"
            );
            throw new UnauthorizedException("Password is incorrect");
        }

        session.setStatus(AuthSession.SessionStatus.ACTIVE);
        session.setLockedAt(null);
        session.setFailedReauthCount(0);
        session.setLastActivityAt(Instant.now());
        session.setRevokedAt(null);
        session.setCurrentSession(true);
        String newRefreshToken = tokenService.createRefreshToken();
        session.setRefreshTokenHash(tokenService.hashToken(newRefreshToken));
        session.setExpiresAt(Instant.now().plusSeconds(refreshTokenTtlDays * 24 * 60 * 60));
        auditService.log(
                "session_reauth_success",
                user,
                auditDetails("sessionId", session.getId()),
                clientIp(httpRequest),
                userAgent(httpRequest)
        );
        trailService.logSafely(
                "SESSION",
                "Session",
                session.getId(),
                "SESSION_REAUTH_SUCCESS",
                "LOCKED",
                "ACTIVE",
                "Session re-authenticated successfully"
        );
        return new AuthResponse(
                toAuthUserResponse(user, session.getId()),
                tokenService.createAccessToken(user, session.getId()),
                newRefreshToken,
                accessTokenTtlMinutes * 60
        );
    }

    @Transactional
    public void touchSession(HttpServletRequest httpRequest) {
        AuthenticatedUser principal = currentUserService.requireAuthenticatedPrincipal();
        AuthSession session = sessionRepository.findById(principal.sessionId())
                .orElseThrow(() -> new UnauthorizedException("Session not found"));

        if (session.getRevokedAt() != null || session.getStatus() == AuthSession.SessionStatus.REVOKED) {
            throw new UnauthorizedException("Session revoked");
        }

        if (session.getStatus() == AuthSession.SessionStatus.EXPIRED) {
            throw new UnauthorizedException("Session expired");
        }

        if (session.getStatus() == AuthSession.SessionStatus.LOCKED) {
            throw new UnauthorizedException("Session locked");
        }

        Instant now = Instant.now();
        session.setStatus(AuthSession.SessionStatus.ACTIVE);
        session.setLastActivityAt(now);
        session.setCurrentSession(true);
    }

    @Transactional(readOnly = true)
    public UserManagementResponse me() {
        UserAccount user = currentUserService.requireCurrentUser();
        return userManagementService.getUser(user.getId());
    }

    @Transactional
    public UserProfileResponse updateProfile(UpdateProfileRequest request) {
        UserAccount user = currentUserService.requireCurrentUser();
        String oldFullName = user.getFullName();
        String oldEmail = user.getEmail();
        String oldPhone = user.getPhone();
        String oldAvatar = user.getAvatar();
        List<AuditTrailChangeResponse> changes = new java.util.ArrayList<>();

        if (request.fullName() != null && !request.fullName().isBlank()) {
            String newFullName = request.fullName().trim();
            if (!equalsIgnoringNull(oldFullName, newFullName)) {
                changes.add(new AuditTrailChangeResponse("Full Name", oldFullName, newFullName));
            }
            user.setFullName(newFullName);
        }
        if (request.phone() != null) {
            String newPhone = request.phone().trim();
            if (!equalsIgnoringNull(oldPhone, newPhone)) {
                changes.add(new AuditTrailChangeResponse("Phone", oldPhone, newPhone));
            }
            user.setPhone(newPhone);
        }
        if (request.avatar() != null) {
            String newAvatar = request.avatar().trim();
            if (!equalsIgnoringNull(oldAvatar, newAvatar)) {
                changes.add(new AuditTrailChangeResponse("Avatar", oldAvatar, newAvatar));
            }
            user.setAvatar(newAvatar);
        }
        if (request.email() != null && !request.email().isBlank()) {
            String normalizedEmail = request.email().trim();
            userRepository.findByEmail(normalizedEmail)
                    .filter(existing -> !existing.getId().equals(user.getId()))
                    .ifPresent(existing -> {
                        throw new IllegalArgumentException("Email is already in use by another account");
                    });
            if (!equalsIgnoringNull(oldEmail, normalizedEmail)) {
                changes.add(new AuditTrailChangeResponse("Email", oldEmail, normalizedEmail));
            }
            user.setEmail(normalizedEmail);
        }

        if (!changes.isEmpty()) {
            trailService.logAs(
                    user,
                    "USER",
                    user.getFullName(),
                    user.getId(),
                    "UPDATE_PROFILE",
                    null,
                    null,
                    "User profile updated",
                    changes
            );
        }
        return toUserProfileResponse(user, currentUserService.requireAuthenticatedPrincipal().sessionId());
    }

    @Transactional
    public AuthUserResponse updateNotificationSettings(UpdateNotificationSettingsRequest request) {
        UserAccount user = currentUserService.requireCurrentUser();
        boolean changed = false;

        if (request.emailNotificationsEnabled() != null) {
            boolean nextValue = request.emailNotificationsEnabled();
            if (user.isEmailNotificationsEnabled() != nextValue) {
                user.setEmailNotificationsEnabled(nextValue);
                changed = true;
            }
        }

        if (request.notificationPreferences() != null) {
            String normalizedPreferences = NotificationPreferenceUtils.serializePreferences(objectMapper, request.notificationPreferences());
            if (normalizedPreferences != null && !normalizedPreferences.equals(user.getNotificationPreferences())) {
                user.setNotificationPreferences(normalizedPreferences);
                changed = true;
            }
        }

        if (changed) {
            trailService.logAs(
                    user,
                    "USER",
                    user.getFullName(),
                    user.getId(),
                    "UPDATE_NOTIFICATION_SETTINGS",
                    null,
                    null,
                    "Notification settings updated"
            );
        }

        return toAuthUserResponse(user, currentUserService.requireAuthenticatedPrincipal().sessionId());
    }

    @Transactional
    public void changePassword(ChangePasswordRequest request) {
        if (!request.newPassword().equals(request.confirmPassword())) {
            throw new IllegalArgumentException("Passwords do not match");
        }
        UserAccount user = currentUserService.requireCurrentUser();

        // Enforce password policy
        systemConfigurationService.validatePasswordPolicy(request.newPassword());

        // Enforce password history
        com.fasterxml.jackson.databind.JsonNode security = systemConfigurationService.requireConfiguration().getSecurityConfig();
        if (security != null && security.path("preventPasswordReuse").asBoolean(true)) {
            int historyCount = security.path("passwordHistoryCount").asInt(5);
            systemConfigurationService.validatePasswordHistory(request.newPassword(), user.getPasswordHistory(), historyCount, passwordEncoder);
        }

        String oldPasswordChangedAt = DateTimeFormatUtils.formatDateTime(user.getPasswordChangedAt());
        if (request.currentPassword() != null && !request.currentPassword().isBlank()) {
            if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
                throw new UnauthorizedException("Current password is invalid");
            }
        }

        String newHash = passwordEncoder.encode(request.newPassword());
        user.setPasswordHash(newHash);

        // Update password history
        if (security != null) {
            int historyCount = security.path("passwordHistoryCount").asInt(5);
            user.setPasswordHistory(systemConfigurationService.updatePasswordHistory(user.getPasswordHistory(), newHash, historyCount));
        }

        user.setMustChangePassword(false);
        user.setPasswordChangedAt(Instant.now());
        revokeTrustedDevices(user, "Password changed");
        trailService.logAs(
                user,
                "USER",
                user.getFullName(),
                user.getId(),
                "CHANGE_PASSWORD",
                null,
                null,
                "Password changed successfully",
                List.of(new AuditTrailChangeResponse("Password Changed At", oldPasswordChangedAt, DateTimeFormatUtils.formatDateTime(user.getPasswordChangedAt())))
        );
        notificationDispatcher.dispatch("security.password_changed", List.of(user), Map.of());
    }

    @Transactional
    public void forgotPassword(ForgotPasswordRequest request, HttpServletRequest httpRequest) {
        String normalizedIdentifier = request.identifier() == null ? "" : request.identifier().trim();
        Optional<UserAccount> optionalUser = userRepository.findByEmail(normalizedIdentifier)
                .or(() -> userRepository.findByUsername(normalizedIdentifier));
        if (optionalUser.isEmpty()) {
            return;
        }
        UserAccount user = optionalUser.get();
        String rawToken = UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().replace("-", "");
        PasswordResetToken token = new PasswordResetToken();
        token.setUser(user);
        token.setTokenHash(tokenService.hashToken(rawToken));
        token.setExpiresAt(Instant.now().plusSeconds(24 * 60 * 60));
        resetTokenRepository.save(token);
        auditService.log(
                "password_reset_requested",
                user,
                auditDetails(
                        "identifier", normalizedIdentifier,
                        "reason", safeAuditText(request.reason()),
                        "token", "[redacted]"
                ),
                clientIp(httpRequest),
                userAgent(httpRequest)
        );
        trailService.logAs(
                user,
                "USER",
                user.getFullName(),
                user.getId(),
                "REQUEST_PASSWORD_RESET",
                null,
                null,
                "Password reset link requested",
                List.of(
                        new AuditTrailChangeResponse("Identifier", null, normalizedIdentifier),
                        new AuditTrailChangeResponse("Reason", null, safeAuditText(request.reason()))
                )
        );

        String baseUrl = httpRequest.getHeader("Origin");
        if (baseUrl == null || baseUrl.isBlank()) {
            baseUrl = "http://localhost:3000";
        }
        String resetLink = baseUrl + "/reset-password?token=" + rawToken;

        emailService.sendEmail(
                user.getEmail(),
                "Password Reset Link",
                buildCommonEmailVariables(user, Map.of(
                        "resetLink", resetLink,
                        "resetPasswordUrl", resetLink
                ))
        );
    }

    @Transactional
    public void resetPassword(ResetPasswordRequest request, HttpServletRequest httpRequest) {
        if (!request.newPassword().equals(request.confirmPassword())) {
            throw new IllegalArgumentException("Passwords do not match");
        }
        PasswordResetToken token = resetTokenRepository.findByTokenHash(tokenService.hashToken(request.token()))
                .orElseThrow(() -> new UnauthorizedException("Reset token is invalid"));
        if (!token.isValid()) {
            throw new UnauthorizedException("Reset token expired");
        }
        UserAccount user = token.getUser();

        // Enforce password policy
        systemConfigurationService.validatePasswordPolicy(request.newPassword());

        // Enforce password history
        com.fasterxml.jackson.databind.JsonNode security = systemConfigurationService.requireConfiguration().getSecurityConfig();
        if (security != null && security.path("preventPasswordReuse").asBoolean(true)) {
            int historyCount = security.path("passwordHistoryCount").asInt(5);
            systemConfigurationService.validatePasswordHistory(request.newPassword(), user.getPasswordHistory(), historyCount, passwordEncoder);
        }

        String newHash = passwordEncoder.encode(request.newPassword());
        user.setPasswordHash(newHash);

        // Update password history
        if (security != null) {
            int historyCount = security.path("passwordHistoryCount").asInt(5);
            user.setPasswordHistory(systemConfigurationService.updatePasswordHistory(user.getPasswordHistory(), newHash, historyCount));
        }

        user.setMustChangePassword(false);
        user.setPasswordChangedAt(Instant.now());
        token.setUsedAt(Instant.now());
        revokeTrustedDevices(user, "Password reset completed");
        List<AuthSession> activeSessions = sessionRepository.findAllByUserIdAndRevokedAtIsNullOrderByCreatedAtDesc(user.getId());
        activeSessions.forEach(session -> {
            session.setRevokedAt(Instant.now());
            session.setCurrentSession(false);
        });
        auditService.log(
                "password_reset_completed",
                user,
                auditDetails("sessionsRevoked", activeSessions.size()),
                clientIp(httpRequest),
                userAgent(httpRequest)
        );
        trailService.logAs(
                user,
                "USER",
                user.getFullName(),
                user.getId(),
                "RESET_PASSWORD",
                null,
                null,
                "Password reset completed via reset token",
                List.of(
                        new AuditTrailChangeResponse("Password Changed At", null, DateTimeFormatUtils.formatDateTime(user.getPasswordChangedAt()))
                )
        );
        notificationDispatcher.dispatch("security.password_changed", List.of(user), Map.of());
    }

    @Transactional(readOnly = true)
    public ResetPasswordValidationResponse validateResetToken(String token) {
        return resetTokenRepository.findByTokenHash(tokenService.hashToken(token))
                .map(found -> new ResetPasswordValidationResponse(found.isValid(), DateTimeFormatUtils.formatDateTime(found.getExpiresAt())))
                .orElse(new ResetPasswordValidationResponse(false, null));
    }

    @Transactional
    public SetupMfaResponse setupMfa(SetupMfaRequest request) {
        if (MFA_DISABLED) {
            UserAccount user = currentUserService.requireCurrentUser();
            user.setMfaEnabled(false);
            user.setMfaEmailFallbackEnabled(false);
            user.setMfaRememberDeviceEnabled(false);
            return new SetupMfaResponse("", "", "disabled");
        }
        UserAccount user = currentUserService.requireCurrentUser();
        String method = request != null && request.method() != null ? request.method().toLowerCase(Locale.ROOT) : "app";

        MfaFactor factor = mfaFactorRepository.findByUserIdAndMethod(user.getId(), toMfaMethod(method))
                .orElseGet(MfaFactor::new);
        factor.setUser(user);
        factor.setMethod(toMfaMethod(method));

        if ("app".equals(method)) {
            String secret = totpService.generateSecret();
            factor.setSecretEncrypted(secret);
            factor.setEnabled(false);
            mfaFactorRepository.save(factor);
            auditService.log("mfa_setup_started", user, auditDetails("method", method), null, null);
            trailService.logAs(
                    user,
                    "USER",
                    user.getFullName(),
                    user.getId(),
                    "MFA_SETUP",
                    null,
                    null,
                    "Authenticator app setup initialized"
            );
            return new SetupMfaResponse(secret, totpService.createOtpAuthUri("EQMS", user.getUsername(), secret), "app");
        }

        String activationCode = generateOtp();
        factor.setSecretEncrypted(activationCode);
        factor.setEnabled(false);
        mfaFactorRepository.save(factor);

        emailService.sendEmail(
                user.getEmail(),
                "MFA OTP Login Code",
                buildCommonEmailVariables(user, Map.of(
                        "otpCode", activationCode,
                        "expiresIn", String.valueOf(loginChallengeTtlMinutes)
                ))
        );
        auditService.log("mfa_setup_started", user, auditDetails("method", method), null, null);
        trailService.logAs(
                user,
                "USER",
                user.getFullName(),
                user.getId(),
                "MFA_SETUP",
                null,
                null,
                "Email MFA setup initialized"
        );

        return new SetupMfaResponse(activationCode, "email-setup://" + user.getUsername(), "email");
    }

    @Transactional
    public void enableMfa(EnableMfaRequest request) {
        if (MFA_DISABLED) {
            UserAccount user = currentUserService.requireCurrentUser();
            user.setMfaEnabled(false);
            user.setMfaEmailFallbackEnabled(false);
            user.setMfaRememberDeviceEnabled(false);
            challengeRepository.deleteAll();
            mfaFactorRepository.deleteAll();
            mfaTrustedDeviceRepository.deleteAll();
            return;
        }
        UserAccount user = currentUserService.requireCurrentUser();
        String method = request.method() == null ? "app" : request.method().toLowerCase(Locale.ROOT);
        MfaFactor factor = mfaFactorRepository.findByUserIdAndMethod(user.getId(), toMfaMethod(method))
                .orElseThrow(() -> new UnauthorizedException("MFA setup not found"));

        boolean valid;
        if ("app".equals(method)) {
            valid = totpService.verify(factor.getSecretEncrypted(), request.otp());
        } else {
            valid = request.otp().equals(factor.getSecretEncrypted());
        }

        if (!valid) {
            throw new UnauthorizedException("Invalid verification code");
        }

        factor.setEnabled(true);
        user.setMfaEnabled(true);
        revokeTrustedDevices(user, "MFA enabled");
        auditService.log("mfa_enabled", user, auditDetails("method", method), null, null);
        trailService.logAs(
                user,
                "USER",
                user.getFullName(),
                user.getId(),
                "ENABLE_MFA",
                null,
                null,
                "MFA enabled successfully"
        );
        notificationDispatcher.dispatch("security.mfa_updated", List.of(user), Map.of());
    }

    @Transactional
    public void disableMfa(DisableMfaRequest request) {
        if (MFA_DISABLED) {
            UserAccount user = currentUserService.requireCurrentUser();
            user.setMfaEnabled(false);
            user.setMfaEmailFallbackEnabled(false);
            user.setMfaRememberDeviceEnabled(false);
            challengeRepository.deleteAll();
            mfaFactorRepository.deleteAll();
            mfaTrustedDeviceRepository.deleteAll();
            return;
        }
        UserAccount user = currentUserService.requireCurrentUser();
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new UnauthorizedException("Password verification failed");
        }
        mfaFactorRepository.findByUserIdAndMethod(user.getId(), MfaMethod.app)
                .ifPresent(factor -> factor.setEnabled(false));
        user.setMfaEnabled(false);
        revokeTrustedDevices(user, "MFA disabled");
        auditService.log("mfa_disabled", user, Map.of(), null, null);
        trailService.logAs(
                user,
                "USER",
                user.getFullName(),
                user.getId(),
                "DISABLE_MFA",
                null,
                null,
                "Authenticator app disabled"
        );
        notificationDispatcher.dispatch("security.mfa_updated", List.of(user), Map.of());
    }

    @Transactional
    public void updateMfaSettings(UpdateMfaSettingsRequest request) {
        if (MFA_DISABLED) {
            UserAccount user = currentUserService.requireCurrentUser();
            user.setMfaEnabled(false);
            user.setMfaEmailFallbackEnabled(false);
            user.setMfaRememberDeviceEnabled(false);
            return;
        }
        UserAccount user = currentUserService.requireCurrentUser();
        
        if (request.mfaEmailFallbackEnabled() != null) {
            boolean previous = user.isMfaEmailFallbackEnabled();
            user.setMfaEmailFallbackEnabled(request.mfaEmailFallbackEnabled());
            if (previous != request.mfaEmailFallbackEnabled()) {
                revokeTrustedDevices(user, "MFA email fallback changed");
            }
            auditService.log(
                    "mfa_settings_updated",
                    user,
                    Map.of("emailFallbackEnabled", request.mfaEmailFallbackEnabled()),
                    null,
                    null
            );
            trailService.logAs(
                    user,
                    "USER",
                    user.getFullName(),
                    user.getId(),
                    "UPDATE_MFA_SETTINGS",
                    null,
                    null,
                    "MFA email fallback " + (request.mfaEmailFallbackEnabled() ? "enabled" : "disabled")
            );
        }
        if (request.mfaRememberDeviceEnabled() != null) {
            boolean previous = user.isMfaRememberDeviceEnabled();
            boolean enabled = request.mfaRememberDeviceEnabled();
            user.setMfaRememberDeviceEnabled(enabled);
            if (previous != enabled) {
                revokeTrustedDevices(user, enabled ? "Remember device enabled" : "Remember device disabled");
            }
            auditService.log(
                    "mfa_settings_updated",
                    user,
                    Map.of("rememberDeviceEnabled", enabled),
                    null,
                    null
            );
            trailService.logAs(
                    user,
                    "USER",
                    user.getFullName(),
                    user.getId(),
                    "UPDATE_MFA_SETTINGS",
                    null,
                    null,
                    "Remember this device " + (enabled ? "enabled" : "disabled")
            );
        }
    }

    @Transactional
    public SendEmailOtpResponse sendEmailOtp(SendEmailOtpRequest request) {
        if (MFA_DISABLED) {
            throw new IllegalStateException("MFA is disabled for this environment");
        }
        LoginChallenge challenge = challengeRepository.findByMfaTokenHash(tokenService.hashToken(request.mfaToken()))
                .orElseThrow(() -> new UnauthorizedException("MFA challenge not found or expired"));
        if (challenge.getConsumedAt() != null || challenge.isExpired()) {
            throw new UnauthorizedException("MFA challenge expired");
        }

        String rawOtp = generateOtp();
        challenge.setOtpHash(passwordEncoder.encode(rawOtp));
        challenge.setOtpExpiresAt(Instant.now().plusSeconds(loginChallengeTtlMinutes * 60));
        auditService.log("login_otp_resent", challenge.getUser(), auditDetails("method", "email"), null, null);

        emailService.sendEmail(
                challenge.getUser().getEmail(),
                "MFA OTP Login Code",
                buildCommonEmailVariables(challenge.getUser(), Map.of(
                        "otpCode", rawOtp,
                        "expiresIn", String.valueOf(loginChallengeTtlMinutes)
                ))
        );

        return new SendEmailOtpResponse(loginChallengeTtlMinutes * 60, 60);
    }

    @Transactional(readOnly = true)
    public List<SessionResponse> getSessions() {
        AuthenticatedUser principal = currentUserService.requireAuthenticatedPrincipal();
        return sessionRepository.findAllByUserIdOrderByCreatedAtDesc(principal.userId())
                .stream()
                .map(session -> new SessionResponse(
                        session.getId().toString(),
                        session.getDeviceName() == null || session.getDeviceName().isBlank() ? "Unknown Device" : session.getDeviceName(),
                        session.getIpAddress(),
                        DateTimeFormatUtils.formatDateTime(session.getLastActivityAt()),
                        session.getId().equals(principal.sessionId())
                ))
                .toList();
    }

    @Transactional
    public void revokeSession(String sessionId) {
        AuthenticatedUser principal = currentUserService.requireAuthenticatedPrincipal();
        AuthSession session = sessionRepository.findById(UUID.fromString(sessionId))
                .orElseThrow(() -> new EntityNotFoundException("Session not found"));
        if (!session.getUser().getId().equals(principal.userId())) {
            throw new UnauthorizedException("Session does not belong to current user");
        }
        String oldStatus = session.getRevokedAt() == null ? "ACTIVE" : "REVOKED";
        session.setRevokedAt(Instant.now());
        session.setCurrentSession(false);
        trailService.logAs(
                session.getUser(),
                "SESSION",
                "Authentication Session",
                session.getId(),
                "REVOKE_SESSION",
                oldStatus,
                "REVOKED",
                "Session revoked from profile"
        );
    }

    @Transactional
    public void revokeOtherSessions() {
        AuthenticatedUser principal = currentUserService.requireAuthenticatedPrincipal();
        sessionRepository.findAllByUserIdAndRevokedAtIsNullOrderByCreatedAtDesc(principal.userId())
                .forEach(session -> {
                    if (!session.getId().equals(principal.sessionId())) {
                        session.setRevokedAt(Instant.now());
                        session.setCurrentSession(false);
                        trailService.logAs(
                                session.getUser(),
                                "SESSION",
                                "Authentication Session",
                                session.getId(),
                                "REVOKE_SESSION",
                                "ACTIVE",
                                "REVOKED",
                                "Other session revoked from profile"
                        );
                    }
                });
    }

    @Transactional
    public VerifySignatureResponse verifySignature(VerifySignatureRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        String normalizedUsername = request.username() == null ? "" : request.username().trim();
        if (StringUtils.hasText(normalizedUsername) && !currentUser.getUsername().equalsIgnoreCase(normalizedUsername)) {
            auditService.log("esign_verify_failed", currentUser, auditDetails("identifier", normalizedUsername, "reason", "signature_user_mismatch"), null, null);
            throw new UnauthorizedException("Electronic signature must belong to the current user");
        }
        if (!passwordEncoder.matches(request.password(), currentUser.getPasswordHash())) {
            auditService.log("esign_verify_failed", currentUser, auditDetails("identifier", currentUser.getUsername()), null, null);
            throw new UnauthorizedException("Password is incorrect");
        }
        String signatureToken = tokenService.createSignatureToken(currentUser);
        auditService.log("esign_verify_success", currentUser, Map.of(), null, null);
        trailService.logAs(
                currentUser,
                "USER",
                currentUser.getFullName(),
                currentUser.getId(),
                "VERIFY_E_SIGNATURE",
                null,
                null,
                "Electronic signature verified"
        );
        return new VerifySignatureResponse(
                true,
                currentUser.getId().toString(),
                currentUser.getUsername(),
                currentUser.getFullName(),
                currentUser.getPosition(),
                currentUser.getDepartment(),
                DateTimeFormatUtils.formatDateTime(Instant.now()),
                signatureToken
        );
    }

    private String handleFailedLogin(UserAccount user, HttpServletRequest request) {
        user.setFailedLoginCount(user.getFailedLoginCount() + 1);
        com.fasterxml.jackson.databind.JsonNode security = systemConfigurationService.requireConfiguration().getSecurityConfig();
        boolean lockoutEnabled = security != null && security.path("enableAccountLockout").asBoolean(true);
        int maxAttempts = security != null ? security.path("maxLoginAttempts").asInt(5) : 5;

        if (lockoutEnabled && user.getFailedLoginCount() >= maxAttempts) {
            user.setLockedUntil(Instant.now().plus(36500, java.time.temporal.ChronoUnit.DAYS));
            notificationDispatcher.dispatch("security.account_locked", List.of(user), Map.of());
        }
        auditService.log("login_failed", user, auditDetails("username", user.getUsername()), clientIp(request), userAgent(request));
        trailService.logAs(
                user,
                "USER",
                user.getFullName() == null || user.getFullName().isBlank() ? user.getUsername() : user.getFullName(),
                user.getId(),
                "LOGIN",
                null,
                "REVOKED",
                "Password is incorrect"
        );
        if (lockoutEnabled) {
            int remaining = Math.max(0, maxAttempts - user.getFailedLoginCount());
            if (remaining == 0) {
                return "Account is locked after too many failed login attempts. Please contact an administrator.";
            }
            return "Password is incorrect. You have " + remaining
                    + " login attempt" + (remaining == 1 ? "" : "s")
                    + " remaining before your account is locked.";
        }
        return "Password is incorrect";
    }

    private void resetLoginFailures(UserAccount user) {
        user.setFailedLoginCount(0);
        user.setLockedUntil(null);
    }

    private LoginChallengeResponse createLoginChallenge(UserAccount user, List<String> availableMethods, HttpServletRequest request) {
        String rawChallengeToken = tokenService.createRefreshToken();
        String rawOtp = generateOtp();

        LoginChallenge challenge = new LoginChallenge();
        challenge.setUser(user);
        challenge.setMfaTokenHash(tokenService.hashToken(rawChallengeToken));
        challenge.setAvailableMethods(availableMethods);
        challenge.setMaskedEmail(maskEmail(user.getEmail()));
        challenge.setOtpHash(passwordEncoder.encode(rawOtp));
        challenge.setOtpExpiresAt(Instant.now().plusSeconds(loginChallengeTtlMinutes * 60));
        challengeRepository.save(challenge);

        auditService.log("login_challenge_created", user, auditDetails(
                "methods", challenge.getAvailableMethods()
        ), clientIp(request), userAgent(request));

        return new LoginChallengeResponse(
                true,
                rawChallengeToken,
                challenge.getAvailableMethods(),
                challenge.getMaskedEmail(),
                user.getUsername(),
                loginChallengeTtlMinutes * 60,
                user.isMfaRememberDeviceEnabled()
        );
    }

    private AuthSession createSession(UserAccount user, HttpServletRequest request, String deviceName) {
        String rawRefreshToken = tokenService.createRefreshToken();
        AuthSession session = new AuthSession();
        session.setUser(user);
        session.setRefreshTokenHash(tokenService.hashToken(rawRefreshToken));
        session.setDeviceName(deviceName);
        session.setIpAddress(clientIp(request));
        session.setUserAgent(userAgent(request));
        session.setExpiresAt(Instant.now().plusSeconds(refreshTokenTtlDays * 24 * 60 * 60));
        authSessionInit(session);
        sessionRepository.save(session);
        return session;
    }

    private void authSessionInit(AuthSession session) {
        session.setCurrentSession(true);
        session.setLastActivityAt(Instant.now());
        session.setCreatedAt(Instant.now());
    }

    private AuthResponse buildAuthResponse(UserAccount user, AuthSession session) {
        String rawAccessToken = tokenService.createAccessToken(user, session.getId());
        String rawRefreshToken = tokenService.createRefreshToken();
        session.setRefreshTokenHash(tokenService.hashToken(rawRefreshToken));
        session.setExpiresAt(Instant.now().plusSeconds(refreshTokenTtlDays * 24 * 60 * 60));
        return new AuthResponse(
                toAuthUserResponse(user, session.getId()),
                rawAccessToken,
                rawRefreshToken,
                accessTokenTtlMinutes * 60
        );
    }

    private AuthUserResponse toAuthUserResponse(UserAccount user, UUID sessionId) {
        List<String> permissions = permissionCodesForRole(user).stream()
                .sorted(String::compareToIgnoreCase)
                .toList();
        boolean requirePasswordChange = requiresPasswordChange(user);
        boolean mfaSetupRequired = requiresMfaSetup(user);
        return new AuthUserResponse(
                user.getId().toString(),
                user.getUsername(),
                user.getFullName(),
                user.getEmail(),
                user.getRoleName(),
                user.getDepartment(),
                user.getAvatar(),
                requirePasswordChange,
                user.isMfaEnabled(),
                user.isMfaEmailFallbackEnabled(),
                user.isMfaRememberDeviceEnabled(),
                user.isEmailNotificationsEnabled(),
                NotificationPreferenceUtils.parsePreferences(objectMapper, user.getNotificationPreferences()),
                mfaSetupRequired,
                systemConfigurationService.isMaintenanceModeEnabled(),
                permissions,
                user.getEmployeeCode(),
                user.getPosition(),
                user.getBusinessUnit(),
                user.getEmploymentType(),
                user.getStartDate() != null ? user.getStartDate().toString() : null,
                user.getNationality(),
                user.getDateOfBirth() != null ? user.getDateOfBirth().toString() : null,
                user.getGender(),
                user.getAddress(),
                user.getManagerName(),
                user.getLanguage(),
                user.getIdNumber(),
                user.getProfessionalLevel(),
                user.getAreaOfExpertise(),
                user.getYearsOfExperience(),
                user.getPreviousEmployer(),
                user.getStatus() != null ? user.getStatus().name() : null,
                user.getLastLoginAt() != null ? DateTimeFormatUtils.formatDateTime(user.getLastLoginAt()) : null,
                DateTimeFormatUtils.formatDateTime(user.getCreatedAt()),
                DateTimeFormatUtils.formatDateTime(user.getUpdatedAt()),
                DateTimeFormatUtils.formatDateTime(user.getPasswordChangedAt()),
                user.getSuspendReason(),
                user.getSuspendedUntil() != null ? user.getSuspendedUntil().toString() : null,
                user.getTerminationReason(),
                user.getTerminationDate() != null ? user.getTerminationDate().toString() : null
        );
    }

    private UserProfileResponse toUserProfileResponse(UserAccount user, UUID sessionId) {
        List<String> permissions = permissionCodesForRole(user).stream()
                .sorted(String::compareToIgnoreCase)
                .toList();
        boolean requirePasswordChange = requiresPasswordChange(user);
        boolean mfaSetupRequired = requiresMfaSetup(user);
        return new UserProfileResponse(
                user.getId().toString(),
                user.getUsername(),
                user.getFullName(),
                user.getEmail(),
                user.getRoleName(),
                user.getDepartment(),
                user.getPhone(),
                user.getAvatar(),
                requirePasswordChange,
                user.isMfaEnabled(),
                user.isMfaEmailFallbackEnabled(),
                user.isMfaRememberDeviceEnabled(),
                user.isEmailNotificationsEnabled(),
                NotificationPreferenceUtils.parsePreferences(objectMapper, user.getNotificationPreferences()),
                mfaSetupRequired,
                systemConfigurationService.isMaintenanceModeEnabled(),
                permissions,
                user.getEmployeeCode(),
                user.getPosition(),
                user.getBusinessUnit(),
                user.getEmploymentType(),
                user.getStartDate() != null ? user.getStartDate().toString() : null,
                user.getNationality(),
                user.getDateOfBirth() != null ? user.getDateOfBirth().toString() : null,
                user.getGender(),
                user.getAddress(),
                user.getManagerName(),
                user.getLanguage(),
                user.getIdNumber(),
                user.getProfessionalLevel(),
                user.getAreaOfExpertise(),
                user.getYearsOfExperience(),
                user.getPreviousEmployer(),
                user.getStatus() != null ? user.getStatus().name() : null,
                user.getLastLoginAt() != null ? DateTimeFormatUtils.formatDateTime(user.getLastLoginAt()) : null,
                DateTimeFormatUtils.formatDateTime(user.getCreatedAt()),
                DateTimeFormatUtils.formatDateTime(user.getUpdatedAt()),
                DateTimeFormatUtils.formatDateTime(user.getPasswordChangedAt()),
                user.getSuspendReason(),
                user.getSuspendedUntil() != null ? user.getSuspendedUntil().toString() : null,
                user.getTerminationReason(),
                user.getTerminationDate() != null ? user.getTerminationDate().toString() : null
        );
    }

    private boolean requiresPasswordChange(UserAccount user) {
        return user != null && (user.isMustChangePassword() || systemConfigurationService.isPasswordExpired(user));
    }

    private boolean requiresMfaSetup(UserAccount user) {
        // MFA setup should not be forced just because email fallback is disabled.
        // Users may choose app, email, both, or neither without being pushed to the setup flow.
        return false;
    }

    private Set<String> permissionCodesForRole(UserAccount user) {
        return permissionEvaluationService.getPermissionCodes(user);
    }

    private boolean equalsIgnoringNull(String left, String right) {
        return java.util.Objects.equals(
                left == null ? null : left.trim(),
                right == null ? null : right.trim()
        );
    }

    private Optional<UserAccount> findActiveUserByIdentifier(String value) {
        if (value == null) {
            return Optional.empty();
        }

        String normalized = value.trim();
        if (normalized.isEmpty()) {
            return Optional.empty();
        }

        return userRepository.findByUsername(normalized)
                .or(() -> userRepository.findByEmail(normalized))
                .filter(user -> user.getStatus() == UserStatus.Active);
    }

    private boolean hasValidTrustedDevice(UserAccount user, HttpServletRequest request) {
        String rawToken = readCookie(request, TRUSTED_DEVICE_COOKIE);
        if (rawToken == null || rawToken.isBlank()) {
            return false;
        }
        Optional<MfaTrustedDevice> trustedDevice = mfaTrustedDeviceRepository.findByTokenHash(tokenService.hashToken(rawToken))
                .filter(device -> device.getUser().getId().equals(user.getId()));
        if (trustedDevice.isEmpty() || !trustedDevice.get().isValid()) {
            return false;
        }
        trustedDevice.get().setLastUsedAt(Instant.now());
        return true;
    }

    private String registerTrustedDevice(UserAccount user, HttpServletRequest request) {
        String rawToken = tokenService.createRefreshToken();
        MfaTrustedDevice trustedDevice = new MfaTrustedDevice();
        trustedDevice.setUser(user);
        trustedDevice.setTokenHash(tokenService.hashToken(rawToken));
        trustedDevice.setDeviceName(resolveDeviceName(request));
        trustedDevice.setIpAddress(clientIp(request));
        trustedDevice.setUserAgent(userAgent(request));
        trustedDevice.setExpiresAt(Instant.now().plusSeconds(TRUSTED_DEVICE_TTL_SECONDS));
        trustedDevice.setLastUsedAt(Instant.now());
        mfaTrustedDeviceRepository.save(trustedDevice);
        return rawToken;
    }

    private void revokeTrustedDevices(UserAccount user, String reason) {
        Instant now = Instant.now();
        mfaTrustedDeviceRepository.findAllByUser_Id(user.getId()).forEach(device -> {
            if (device.getRevokedAt() == null) {
                device.setRevokedAt(now);
            }
        });
        auditService.log("trusted_devices_revoked", user, auditDetails("reason", reason), null, null);
        trailService.logAs(
                user,
                "USER",
                user.getFullName(),
                user.getId(),
                "REVOKE_TRUSTED_DEVICES",
                null,
                null,
                reason
        );
    }

    private String readCookie(HttpServletRequest request, String name) {
        if (request.getCookies() == null) {
            return null;
        }
        for (jakarta.servlet.http.Cookie cookie : request.getCookies()) {
            if (name.equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }

    private String resolveDeviceName(HttpServletRequest request) {
        String userAgent = userAgent(request);
        if (userAgent == null || userAgent.isBlank()) {
            return "Unknown Device";
        }
        return userAgent.length() > 255 ? userAgent.substring(0, 255) : userAgent;
    }

    private String generateOtp() {
        return String.format("%06d", RANDOM.nextInt(1_000_000));
    }

    private String maskEmail(String email) {
        if (email == null || !email.contains("@")) {
            return email;
        }
        String[] parts = email.split("@", 2);
        String name = parts[0];
        String domain = parts[1];
        if (name.length() <= 2) {
            return name.charAt(0) + "***@" + domain;
        }
        return name.charAt(0) + "***" + name.charAt(name.length() - 1) + "@" + domain;
    }

    private String safeAuditText(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
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

    private Map<String, String> buildCommonEmailVariables(UserAccount user, Map<String, String> variables) {
        Map<String, String> merged = new LinkedHashMap<>();
        String fullName = user != null && user.getFullName() != null ? user.getFullName() : "";
        String email = user != null && user.getEmail() != null ? user.getEmail() : "";
        String currentDateTime = DateTimeFormatUtils.formatDateTime(Instant.now());
        String currentDate = currentDateTime != null && currentDateTime.contains(" ") ? currentDateTime.split(" ", 2)[0] : currentDateTime;
        String currentTime = currentDateTime != null && currentDateTime.contains(" ") ? currentDateTime.split(" ", 2)[1] : currentDateTime;
        merged.put("userName", fullName);
        merged.put("fullName", fullName);
        merged.put("displayName", fullName);
        merged.put("userEmail", email);
        merged.put("username", user != null && user.getUsername() != null ? user.getUsername() : "");
        merged.put("employeeCode", user != null && user.getEmployeeCode() != null ? user.getEmployeeCode() : "");
        merged.put("userRole", user != null && user.getRoleName() != null ? user.getRoleName() : "");
        merged.put("userDepartment", user != null && user.getDepartment() != null ? user.getDepartment() : "");
        merged.put("userPosition", user != null && user.getPosition() != null ? user.getPosition() : "");
        merged.put("businessUnit", user != null && user.getBusinessUnit() != null ? user.getBusinessUnit() : "");
        merged.put("systemName", "EQMS");
        merged.put("companyName", "EQMS");
        merged.put("currentDate", currentDate != null ? currentDate : "");
        merged.put("currentTime", currentTime != null ? currentTime : "");
        merged.put("currentDateTime", currentDateTime != null ? currentDateTime : "");
        if (variables != null) {
            variables.forEach((key, value) -> {
                if (key != null && !key.isBlank()) {
                    merged.put(key, value);
                }
            });
        }
        return merged;
    }

    private String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private String userAgent(HttpServletRequest request) {
        return request.getHeader("User-Agent");
    }

    private MfaMethod toMfaMethod(String method) {
        return "email".equals(method) ? MfaMethod.email : MfaMethod.app;
    }
}
