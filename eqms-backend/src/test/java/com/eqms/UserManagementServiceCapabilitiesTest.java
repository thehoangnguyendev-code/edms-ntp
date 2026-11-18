package com.eqms;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.user.UserActionCapabilitiesResponse;
import com.eqms.dto.user.UserManagementResponse;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.EmergencyAccountChangeGuard;
import com.eqms.service.PermissionEvaluationService;
import com.eqms.service.UserManagementService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atMostOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The row menu of User Management opens with its items already decided: the list carries what the signed-in user may do with each account, so
 * the menu needs no request of its own. The decision is the same one that GET /users/{id}/capabilities gives, and each permission is read once for the page.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class UserManagementServiceCapabilitiesTest {
    @Mock private UserAccountRepository userRepository;
    @Mock private PermissionEvaluationService permissionEvaluationService;
    @Mock private CurrentUserService currentUserService;
    @Mock private com.eqms.repository.AuthSessionRepository sessionRepository;
    @Mock private com.eqms.repository.UserAccessProfileRepository userAccessProfileRepository;
    @Mock private com.eqms.service.SystemConfigurationService systemConfigurationService;
    @Mock private com.eqms.service.NotificationDispatcher notificationDispatcher;
    @Mock private org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;
    @Mock private com.eqms.service.AuthAuditService auditService;
    @Mock private com.eqms.service.AuditTrailService auditTrailService;
    @Mock private com.eqms.auth.TokenService tokenService;
    @Mock private com.eqms.service.ElectronicSignatureService electronicSignatureService;
    @Mock private com.eqms.repository.MfaFactorRepository mfaFactorRepository;
    @Mock private com.eqms.repository.MfaTrustedDeviceRepository mfaTrustedDeviceRepository;
    @InjectMocks private UserManagementService service;

    private UserAccount actor;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(service, "emergencyAccountChangeGuard", mock(EmergencyAccountChangeGuard.class));
        actor = new UserAccount();
        actor.setId(UUID.randomUUID());
        actor.setUsername("admin");
        actor.setStatus(UserStatus.Active);
        when(currentUserService.requireCurrentUser()).thenReturn(actor);
    }

    private UserAccount account(boolean locked) {
        UserAccount user = new UserAccount();
        user.setId(UUID.randomUUID());
        user.setUsername("u" + user.getId().toString().substring(0, 4));
        user.setFullName("Person");
        user.setStatus(UserStatus.Active);
        if (locked) user.setLockedUntil(Instant.now().plusSeconds(600));
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        return user;
    }

    @Test
    void theCapabilitiesFollowThePermissionsOfTheSignedInUserAndTheLockOfTheAccount() {
        when(permissionEvaluationService.hasPermission(eq(actor), anyString())).thenReturn(false);
        when(permissionEvaluationService.hasPermission(actor, "settings.user.view")).thenReturn(true);
        when(permissionEvaluationService.hasPermission(actor, "settings.user.edit")).thenReturn(true);
        UserAccount locked = account(true);
        UserAccount free = account(false);

        UserActionCapabilitiesResponse forLocked = service.getUserCapabilities(locked.getId());
        UserActionCapabilitiesResponse forFree = service.getUserCapabilities(free.getId());

        assertThat(forLocked.actions().get("view").allowed()).isTrue();
        assertThat(forLocked.actions().get("suspend").allowed()).isTrue();
        assertThat(forLocked.actions().get("resetPassword").allowed()).isFalse();
        assertThat(forLocked.actions().get("resetPassword").reason()).contains("permission");
        assertThat(forLocked.actions().get("unlock").allowed()).isTrue();
        assertThat(forFree.actions().get("unlock").allowed()).isFalse();
        assertThat(forFree.actions().get("unlock").reason()).isEqualTo("Account is not currently locked.");
        assertThat(forFree.actions()).containsKeys("view", "edit", "resetPassword", "suspend", "terminate", "reinstate", "forceLogout", "unlock");
    }

    @Test
    void resettingYourOwnPasswordIsNotOfferedAndIsRefused() {
        when(permissionEvaluationService.hasPermission(eq(actor), anyString())).thenReturn(true);
        when(userRepository.findById(actor.getId())).thenReturn(Optional.of(actor));

        var reset = service.getUserCapabilities(actor.getId()).actions().get("resetPassword");

        assertThat(reset.allowed()).isFalse();
        assertThat(reset.reason()).contains("Preferences > Security");
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> service.resetPassword(actor.getId(), null, null))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("cannot reset your own password");
        assertThat(actor.getPasswordHash()).isNull();
    }

    /** Owner request 2026-11-17: the e-mail to the person carries the new temporary password, in its own e-mail only event, not in the general "Password changed" notice. */
    @Test
    void resettingAnotherPersonsPasswordEmailsThemTheTemporaryPasswordInItsOwnEvent() {
        UserAccount user = account(false);
        user.setEmail("person@example.local");
        when(passwordEncoder.encode(anyString())).thenReturn("hash");
        when(systemConfigurationService.requireConfiguration()).thenReturn(new com.eqms.entity.SystemConfiguration());
        var http = mock(jakarta.servlet.http.HttpServletRequest.class);
        when(http.getHeader("Origin")).thenReturn("http://localhost:3000");
        var request = new com.eqms.dto.user.UserResetPasswordRequest(false, "Temp#Passw0rd-123");

        var response = service.resetPassword(user.getId(), request, http);

        org.mockito.ArgumentCaptor<java.util.Map<String, String>> variables = org.mockito.ArgumentCaptor.forClass(java.util.Map.class);
        verify(notificationDispatcher).dispatch(eq("security.account_password_reset"), eq(List.of(user)), variables.capture());
        assertThat(variables.getValue()).containsEntry("tempPassword", "Temp#Passw0rd-123").containsEntry("username", user.getUsername())
                .containsEntry("loginLink", "http://localhost:3000/login");
        assertThat(response.password()).isEqualTo("Temp#Passw0rd-123");
        // the general notice is still sent, and it never carries a password
        verify(notificationDispatcher).dispatch("security.password_changed", List.of(user), java.util.Map.of());
        assertThat(user.isMustChangePassword()).isTrue();
    }

    @Test
    void aPermissionIsReadOnceNoMatterHowManyActionsUseIt() {
        when(permissionEvaluationService.hasPermission(eq(actor), anyString())).thenReturn(true);
        UserAccount user = account(false);

        service.getUserCapabilities(user.getId());

        // suspend, terminate, reinstate, edit and unlock all rest on settings.user.edit.
        verify(permissionEvaluationService, atMostOnce()).hasPermission(actor, "settings.user.edit");
    }

    @Test
    void theUserListCarriesTheCapabilitiesOfEveryRowAndTheModelOfTheDetailScreensDoesNot() {
        when(permissionEvaluationService.hasPermission(eq(actor), anyString())).thenReturn(true);
        UserAccount first = account(true);
        UserAccount second = account(false);
        when(userRepository.findAll(any(Specification.class), any(Pageable.class))).thenReturn(new PageImpl<>(List.of(first, second)));

        List<UserManagementResponse> rows = service.getUsers(1, 10, null, null, null, null, null, null, null, null, null, null, null, null, null, "employeeCode", "asc", false).data();

        assertThat(rows).hasSize(2);
        assertThat(rows.get(0).capabilities()).isNotNull();
        assertThat(rows.get(0).capabilities().userId()).isEqualTo(first.getId().toString());
        assertThat(rows.get(0).capabilities().actions().get("unlock").allowed()).isTrue();
        assertThat(rows.get(1).capabilities().actions().get("unlock").allowed()).isFalse();
        // the same permission is not asked again for the second row
        verify(permissionEvaluationService, atMostOnce()).hasPermission(actor, "settings.user.edit");

        UserManagementResponse detail = service.toResponse(first, false);
        assertThat(detail.capabilities()).isNull();
    }

    // ---- SECURITY-AUTHORIZATION-REVIEW D4: an administrator resets the MFA of another person (lost device)

    private void signedBy(UserAccount signer, String token) {
        when(tokenService.parseSignatureToken(token)).thenReturn(Optional.of(new com.eqms.auth.TokenService.ParsedAccessToken("signature",
                new com.eqms.auth.AuthenticatedUser(signer.getId(), UUID.randomUUID(), signer.getUsername(), "ADMIN", Set.of()))));
    }

    private UserAccount enrolled() {
        UserAccount user = account(false);
        user.setMfaEnabled(true);
        user.setUsername("lost.phone");
        return user;
    }

    @Test
    void resetMfaIsOfferedOnlyForSomeoneElseWhoHasMfaAndToSomeoneWhoMayResetPasswords() {
        when(permissionEvaluationService.hasPermission(eq(actor), anyString())).thenReturn(true);
        UserAccount withMfa = enrolled();
        UserAccount without = account(false);
        when(userRepository.findById(actor.getId())).thenReturn(Optional.of(actor));

        assertThat(service.getUserCapabilities(withMfa.getId()).actions().get("resetMfa").allowed()).isTrue();
        var noMfa = service.getUserCapabilities(without.getId()).actions().get("resetMfa");
        assertThat(noMfa.allowed()).isFalse();
        assertThat(noMfa.reason()).contains("no multi-factor");
        var self = service.getUserCapabilities(actor.getId()).actions().get("resetMfa");
        assertThat(self.allowed()).isFalse();

        when(permissionEvaluationService.hasPermission(eq(actor), anyString())).thenReturn(false);
        assertThat(service.getUserCapabilities(withMfa.getId()).actions().get("resetMfa").allowed()).isFalse();
    }

    @Test
    void resetMfaSwitchesOffTheAuthenticatorAndTheTrustedDevicesSignsTheSessionsOutTellsThePersonAndAuditsWithTheSignature() {
        ReflectionTestUtils.setField(service, "mfaFactorRepository", mfaFactorRepository);
        ReflectionTestUtils.setField(service, "mfaTrustedDeviceRepository", mfaTrustedDeviceRepository);
        ReflectionTestUtils.setField(service, "electronicSignatureService", electronicSignatureService);
        UserAccount user = enrolled();
        signedBy(actor, "sig");
        com.eqms.entity.MfaFactor factor = new com.eqms.entity.MfaFactor();
        factor.setEnabled(true);
        com.eqms.entity.MfaTrustedDevice device = new com.eqms.entity.MfaTrustedDevice();
        com.eqms.entity.AuthSession session = new com.eqms.entity.AuthSession();
        session.setStatus(com.eqms.entity.AuthSession.SessionStatus.ACTIVE);
        when(mfaFactorRepository.findAllByUserId(user.getId())).thenReturn(List.of(factor));
        when(mfaTrustedDeviceRepository.findAllByUser_Id(user.getId())).thenReturn(List.of(device));
        when(sessionRepository.findAllByUserIdAndRevokedAtIsNullOrderByCreatedAtDesc(user.getId())).thenReturn(List.of(session));
        var signature = new com.eqms.entity.ElectronicSignature();
        when(electronicSignatureService.createEntitySignature(any(), any(), any(), any(), any(), any(), any(), any(), any(), any())).thenReturn(signature);

        service.resetMfa(user.getId(), new com.eqms.dto.user.ResetMfaRequest("Phone lost on a trip", "sig"), null);

        assertThat(user.isMfaEnabled()).isFalse();
        assertThat(factor.isEnabled()).isFalse();
        assertThat(device.getRevokedAt()).isNotNull();
        assertThat(session.getRevokedAt()).isNotNull();
        verify(electronicSignatureService).createEntitySignature(eq("UserAccount"), eq(user.getId()), any(), eq(actor), eq("sig"), eq("USER_MFA_RESET"), eq("Phone lost on a trip"), any(), any(), any());
        org.mockito.ArgumentCaptor<List<com.eqms.dto.audittrail.AuditTrailChangeResponse>> changes = org.mockito.ArgumentCaptor.forClass(List.class);
        verify(auditTrailService).logAs(eq(actor), eq("USER"), any(), eq(user.getId()), eq("USER_MFA_RESET"), any(), any(), any(), changes.capture(), any());
        assertThat(changes.getValue()).extracting(c -> c.field()).contains("Multi-Factor Authentication", "Reason");
        verify(auditService).log(eq("user_mfa_reset"), eq(user), any(), any(), any());
        verify(notificationDispatcher).dispatchIndependently(eq("security.account_mfa_reset"), eq(List.of(user)), any());
    }

    @Test
    void resetMfaRefusesYourOwnAccountAWithoutReasonAnUnsignedOrForeignSignatureAndSomeoneWithNoMfaAndChangesNothing() {
        ReflectionTestUtils.setField(service, "mfaFactorRepository", mfaFactorRepository);
        ReflectionTestUtils.setField(service, "electronicSignatureService", electronicSignatureService);
        UserAccount user = enrolled();
        UserAccount stranger = account(false);
        signedBy(actor, "sig");
        signedBy(stranger, "foreign");
        when(userRepository.findById(actor.getId())).thenReturn(Optional.of(actor));
        UserAccount noMfa = account(false);

        assertThatThrownBy(() -> service.resetMfa(actor.getId(), new com.eqms.dto.user.ResetMfaRequest("why", "sig"), null)).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("your own");
        assertThatThrownBy(() -> service.resetMfa(user.getId(), new com.eqms.dto.user.ResetMfaRequest("  ", "sig"), null)).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("Reason");
        assertThatThrownBy(() -> service.resetMfa(user.getId(), new com.eqms.dto.user.ResetMfaRequest("why", null), null)).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("Signature");
        assertThatThrownBy(() -> service.resetMfa(user.getId(), new com.eqms.dto.user.ResetMfaRequest("why", "foreign"), null)).isInstanceOf(RuntimeException.class).hasMessageContaining("does not belong");
        assertThatThrownBy(() -> service.resetMfa(noMfa.getId(), new com.eqms.dto.user.ResetMfaRequest("why", "sig"), null)).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("nothing to reset");

        assertThat(user.isMfaEnabled()).isTrue();
        verify(electronicSignatureService, org.mockito.Mockito.never()).createEntitySignature(any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
        verify(auditTrailService, org.mockito.Mockito.never()).logAs(any(), any(), any(), any(), eq("USER_MFA_RESET"), any(), any(), any(), any(), any());
        verify(notificationDispatcher, org.mockito.Mockito.never()).dispatchIndependently(eq("security.account_mfa_reset"), any(), any());
    }

    // ---- SECURITY-AUTHORIZATION-REVIEW D5: an Active account without a sign-in is flagged, never suspended

    @Test
    void anActiveAccountWithoutASignInForTheThresholdIsFlaggedAndOtherAccountsAreNot() {
        when(systemConfigurationService.inactiveAccountDays()).thenReturn(90);
        UserAccount stale = account(false);
        stale.setLastLoginAt(Instant.now().minusSeconds(100L * 86400));
        UserAccount recent = account(false);
        recent.setLastLoginAt(Instant.now().minusSeconds(86400));
        UserAccount never = account(false);
        never.setCreatedAt(Instant.now().minusSeconds(200L * 86400));
        UserAccount suspended = account(false);
        suspended.setStatus(UserStatus.Suspended);
        suspended.setLastLoginAt(Instant.now().minusSeconds(400L * 86400));

        assertThat(service.toResponse(stale, false).inactive()).isTrue();
        assertThat(service.toResponse(stale, false).inactiveDays()).isEqualTo(100);
        assertThat(service.toResponse(recent, false).inactive()).isFalse();
        assertThat(service.toResponse(never, false).inactive()).isTrue();
        assertThat(service.toResponse(never, false).inactiveDays()).isEqualTo(200);
        assertThat(service.toResponse(suspended, false).inactive()).isFalse();
        assertThat(service.toResponse(suspended, false).inactiveDays()).isNull();
        assertThat(stale.getStatus()).isEqualTo(UserStatus.Active); // flagged only
    }

    @Test
    void aThresholdOfZeroSwitchesTheFlagOffButTheDaysAreStillShown() {
        when(systemConfigurationService.inactiveAccountDays()).thenReturn(0);
        UserAccount stale = account(false);
        stale.setLastLoginAt(Instant.now().minusSeconds(400L * 86400));

        assertThat(service.toResponse(stale, false).inactive()).isFalse();
        assertThat(service.toResponse(stale, false).inactiveDays()).isEqualTo(400);
    }
}
