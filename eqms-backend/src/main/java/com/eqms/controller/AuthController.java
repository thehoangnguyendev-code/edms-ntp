package com.eqms.controller;

import com.eqms.dto.auth.LoginChallengeResponse;
import com.eqms.dto.auth.*;
import com.eqms.service.AuthService;
import com.eqms.service.SystemConfigurationService;
import com.eqms.service.UserLocalizationPreferenceService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.ResponseCookie;
import org.springframework.http.HttpHeaders;
import java.util.Map;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.beans.factory.annotation.Value;

import java.util.List;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private final AuthService authService;
    private final SystemConfigurationService systemConfigurationService;
    private final UserLocalizationPreferenceService userLocalizationPreferenceService;
    private final boolean secureCookies;

    public AuthController(AuthService authService, SystemConfigurationService systemConfigurationService,
                          UserLocalizationPreferenceService userLocalizationPreferenceService,
                          @Value("${app.security.cookies-secure:false}") boolean secureCookies) {
        this.authService = authService;
        this.systemConfigurationService = systemConfigurationService;
        this.userLocalizationPreferenceService = userLocalizationPreferenceService;
        this.secureCookies = secureCookies;
    }

    @GetMapping("/password-policy")
    public ResponseEntity<PasswordPolicyResponse> getPasswordPolicy() {
        return ResponseEntity.ok(systemConfigurationService.getPasswordPolicy());
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request, HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        Object result = authService.login(request, httpRequest);
        if (result instanceof LoginChallengeResponse challenge) {
            return ResponseEntity.status(HttpStatus.ACCEPTED).body(challenge);
        }
        if (result instanceof AuthResponse authResponse) {
            setTokenCookies(httpResponse, authResponse.accessToken(), authResponse.refreshToken(), authResponse.expiresIn());
        }
        return ResponseEntity.ok(result);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@RequestBody(required = false) LogoutRequest request, HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        authService.logout(request, httpRequest);
        clearTokenCookies(httpResponse);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/reauthenticate")
    public ResponseEntity<AuthResponse> reauthenticate(@Valid @RequestBody ReauthenticateRequest request, HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        AuthResponse authResponse = authService.reauthenticate(request, httpRequest);
        setTokenCookies(httpResponse, authResponse.accessToken(), authResponse.refreshToken(), authResponse.expiresIn());
        return ResponseEntity.ok(authResponse);
    }

    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(@RequestBody(required = false) RefreshRequest request, HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        AuthResponse authResponse = authService.refresh(request, httpRequest);
        setTokenCookies(httpResponse, authResponse.accessToken(), authResponse.refreshToken(), authResponse.expiresIn());
        return ResponseEntity.ok(authResponse);
    }

    @PostMapping("/session/heartbeat")
    public ResponseEntity<Void> heartbeat(HttpServletRequest httpRequest) {
        authService.touchSession(httpRequest);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me")
    public ResponseEntity<com.eqms.dto.user.UserManagementResponse> me() {
        return ResponseEntity.ok(authService.me());
    }

    @GetMapping("/me/localization-settings")
    public ResponseEntity<LocalizationPreferenceResponse> getLocalizationSettings() {
        return ResponseEntity.ok(userLocalizationPreferenceService.getMine());
    }

    @PutMapping("/me/localization-settings")
    public ResponseEntity<LocalizationPreferenceResponse> updateLocalizationSettings(
            @Valid @RequestBody UpdateLocalizationPreferenceRequest request) {
        return ResponseEntity.ok(userLocalizationPreferenceService.updateMine(request));
    }

    @PutMapping("/me/profile")
    public ResponseEntity<UserProfileResponse> updateProfile(@RequestBody UpdateProfileRequest request) {
        return ResponseEntity.ok(authService.updateProfile(request));
    }

    @PutMapping("/me/notification-settings")
    public ResponseEntity<com.eqms.dto.auth.AuthUserResponse> updateNotificationSettings(@RequestBody UpdateNotificationSettingsRequest request) {
        return ResponseEntity.ok(authService.updateNotificationSettings(request));
    }

    @PostMapping("/me/change-password")
    public ResponseEntity<Void> changePassword(@Valid @RequestBody ChangePasswordRequest request) {
        authService.changePassword(request);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<Void> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request, HttpServletRequest httpRequest) {
        authService.forgotPassword(request, httpRequest);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/reset-password")
    public ResponseEntity<Void> resetPassword(@Valid @RequestBody ResetPasswordRequest request, HttpServletRequest httpRequest) {
        authService.resetPassword(request, httpRequest);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/reset-password/validate-token")
    public ResponseEntity<ResetPasswordValidationResponse> validateToken(@org.springframework.web.bind.annotation.RequestParam String token) {
        return ResponseEntity.ok(authService.validateResetToken(token));
    }

    @PostMapping("/mfa/verify")
    public ResponseEntity<AuthResponse> verifyMfa(@Valid @RequestBody VerifyMfaRequest request, HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        MfaVerificationOutcome result = authService.verifyMfa(request, httpRequest);
        AuthResponse authResponse = result.authResponse();
        setTokenCookies(httpResponse, authResponse.accessToken(), authResponse.refreshToken(), authResponse.expiresIn());
        if (result.trustedDeviceToken() != null && !result.trustedDeviceToken().isBlank()) {
            setTrustedDeviceCookie(httpResponse, result.trustedDeviceToken());
        }
        return ResponseEntity.ok(authResponse);
    }

    @PostMapping("/mfa/setup")
    public ResponseEntity<SetupMfaResponse> setupMfa(@RequestBody(required = false) SetupMfaRequest request) {
        return ResponseEntity.ok(authService.setupMfa(request));
    }

    @PostMapping("/mfa/enable")
    public ResponseEntity<Void> enableMfa(@Valid @RequestBody EnableMfaRequest request) {
        authService.enableMfa(request);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/mfa/disable")
    public ResponseEntity<Void> disableMfa(@Valid @RequestBody DisableMfaRequest request) {
        authService.disableMfa(request);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/mfa/settings")
    public ResponseEntity<com.eqms.dto.user.UserManagementResponse> updateMfaSettings(@Valid @RequestBody UpdateMfaSettingsRequest request) {
        authService.updateMfaSettings(request);
        return ResponseEntity.ok(authService.me());
    }

    @PostMapping("/mfa/send-email-otp")
    public ResponseEntity<SendEmailOtpResponse> sendEmailOtp(@Valid @RequestBody SendEmailOtpRequest request) {
        return ResponseEntity.ok(authService.sendEmailOtp(request));
    }

    @GetMapping("/sessions")
    public ResponseEntity<List<SessionResponse>> sessions() {
        return ResponseEntity.ok(authService.getSessions());
    }

    @DeleteMapping("/sessions/{sessionId}")
    public ResponseEntity<Void> revokeSession(@PathVariable String sessionId) {
        authService.revokeSession(sessionId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/sessions")
    public ResponseEntity<Void> revokeOtherSessions() {
        authService.revokeOtherSessions();
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/verify-signature")
    public ResponseEntity<VerifySignatureResponse> verifySignature(@Valid @RequestBody VerifySignatureRequest request) {
        return ResponseEntity.ok(authService.verifySignature(request));
    }

    private void setTokenCookies(HttpServletResponse response, String accessToken, String refreshToken, long accessTokenMaxAgeSeconds) {
        // Keep the access token out of cookies to avoid oversized request headers.
        // The frontend already sends it via the Authorization header from localStorage.
        ResponseCookie clearAccessCookie = ResponseCookie.from("accessToken", "")
                .httpOnly(true)
                .secure(secureCookies)
                .path("/")
                .sameSite("Lax")
                .maxAge(0)
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, clearAccessCookie.toString());

        if (refreshToken != null) {
            ResponseCookie refreshCookie = ResponseCookie.from("refreshToken", refreshToken)
                    .httpOnly(true)
                    .secure(secureCookies)
                    .path("/")
                    .sameSite("Lax")
                    .maxAge(30 * 24 * 60 * 60)
                    .build();
            response.addHeader(HttpHeaders.SET_COOKIE, refreshCookie.toString());
        }
    }

    private void clearTokenCookies(HttpServletResponse response) {
        ResponseCookie accessCookie = ResponseCookie.from("accessToken", "")
                .httpOnly(true)
                .secure(secureCookies)
                .path("/")
                .sameSite("Lax")
                .maxAge(0)
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, accessCookie.toString());

        ResponseCookie refreshCookie = ResponseCookie.from("refreshToken", "")
                .httpOnly(true)
                .secure(secureCookies)
                .path("/")
                .sameSite("Lax")
                .maxAge(0)
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, refreshCookie.toString());
    }

    private void setTrustedDeviceCookie(HttpServletResponse response, String trustedDeviceToken) {
        ResponseCookie trustedDeviceCookie = ResponseCookie.from(AuthService.TRUSTED_DEVICE_COOKIE, trustedDeviceToken)
                .httpOnly(true)
                .secure(secureCookies)
                .path("/")
                .sameSite("Lax")
                .maxAge(8 * 60 * 60)
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, trustedDeviceCookie.toString());
    }
}
