package com.eqms;

import com.eqms.auth.CurrentUserService;
import com.eqms.auth.TokenService;
import com.eqms.dto.user.StatusActionRequest;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.*;
import com.eqms.service.*;
import com.eqms.service.authorization.AuthorizationDecision;
import com.eqms.service.authorization.AuthorizationEngineService;
import com.eqms.service.authorization.AuthorizationRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.access.AccessDeniedException;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.*;

/**
 * Phase 4 GMP gap fix + cutover rule 5 (SECURITY_AUTHORIZATION_HYBRID_REFACTOR_PLAN.md, 2026-08-11):
 * SUSPEND/TERMINATE/DELETE must never target the caller's own account (self-escalation) and must
 * never remove the last remaining Active holder of {@code settings.user.edit} (self-lockout).
 * {@link AuthorizationEngineService} is now the sole decision authority for these 3 actions --
 * {@link UserManagementService#requireUserActionAllowed} maps its reason codes to the same
 * user-facing messages/exception types the old direct-guard checks used, so these tests exercise
 * that mapping via a mocked engine rather than the guard methods directly. The guard methods
 * themselves ({@code isSelfTargetingBlocked}/{@code checkLastActiveAdminGuard}) are still the real
 * logic -- they're just invoked through {@link UserResourceAdapter} inside the engine now instead
 * of being called directly here; see {@code UserResourceAdapterTest} for coverage of the guard
 * logic itself.
 */
@ExtendWith(MockitoExtension.class)
class UserManagementServiceSelfEscalationGuardTest {

    @Mock private UserAccountRepository userRepository;
    @Mock private UserEducationRepository educationRepository;
    @Mock private UserCertificationRepository certificationRepository;
    @Mock private BusinessUnitRepository businessUnitRepository;
    @Mock private DepartmentRepository departmentRepository;
    @Mock private PositionRepository positionRepository;
    @Mock private UserLanguageRepository userLanguageRepository;
    @Mock private RoleDefinitionRepository roleRepository;
    @Mock private PermissionRepository permissionRepository;
    @Mock private RolePermissionRepository rolePermissionRepository;
    @Mock private PermissionEvaluationService permissionEvaluationService;
    @Mock private DocumentWorkflowSettingRepository documentWorkflowSettingRepository;
    @Mock private DocumentWorkflowPoolMemberRepository documentWorkflowPoolMemberRepository;
    @Mock private AuthSessionRepository sessionRepository;
    @Mock private AuthAuditService auditService;
    @Mock private CurrentUserService currentUserService;
    @Mock private TokenService tokenService;
    @Mock private org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;
    @Mock private AuditTrailService auditTrailService;
    @Mock private SystemConfigurationService systemConfigurationService;
    @Mock private ExternalIdentityProvisioningService externalIdentityProvisioningService;
    @Mock private FileStorageService fileStorageService;
    @Mock private AuthorizationEngineService authorizationEngineService;
    @Mock private NotificationDispatcher notificationDispatcher;

    @InjectMocks
    private UserManagementService userManagementService;

    private UUID targetId;
    private UserAccount target;
    private UUID otherAdminId;
    private UserAccount otherAdmin;

    @BeforeEach
    void setUp() {
        targetId = UUID.randomUUID();
        target = new UserAccount();
        target.setId(targetId);
        target.setUsername("target");
        target.setFullName("Target User");
        target.setStatus(UserStatus.Active);
        lenient().when(userRepository.findById(targetId)).thenReturn(Optional.of(target));

        otherAdminId = UUID.randomUUID();
        otherAdmin = new UserAccount();
        otherAdmin.setId(otherAdminId);
        otherAdmin.setUsername("other-admin");
        otherAdmin.setStatus(UserStatus.Active);
    }

    private MockHttpServletRequest httpRequest() {
        return new MockHttpServletRequest();
    }

    private StatusActionRequest statusRequest(String reason, String date) {
        return new StatusActionRequest(reason, date, "sig-token");
    }

    /** Signature verification must pass for whichever user is acting in a given test. */
    private void stubValidSignatureFor(UserAccount actingUser) {
        TokenService.ParsedAccessToken signatureClaims = new TokenService.ParsedAccessToken(
                "signature",
                new com.eqms.auth.AuthenticatedUser(actingUser.getId(), null, actingUser.getUsername(), null, java.util.Set.of()));
        lenient().when(tokenService.parseSignatureToken("sig-token")).thenReturn(Optional.of(signatureClaims));
    }

    private void stubEngineDecision(AuthorizationDecision decision) {
        when(authorizationEngineService.authorize(any(AuthorizationRequest.class))).thenReturn(decision);
    }

    @Test
    void suspendUser_engineDeniesOutOfScope_isBlockedWithOwnAccountMessage() {
        when(currentUserService.requireCurrentUser()).thenReturn(target);
        stubValidSignatureFor(target);
        stubEngineDecision(AuthorizationDecision.deny("OUT_OF_SCOPE"));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                userManagementService.suspendUser(targetId, statusRequest("reason", null), httpRequest()));
        assertTrue(ex.getMessage().toLowerCase().contains("own account"));
        assertEquals(UserStatus.Active, target.getStatus(), "status must not change once blocked");
    }

    @Test
    void terminateUser_engineDeniesOutOfScope_isBlocked() {
        when(currentUserService.requireCurrentUser()).thenReturn(target);
        stubValidSignatureFor(target);
        stubEngineDecision(AuthorizationDecision.deny("OUT_OF_SCOPE"));

        assertThrows(IllegalArgumentException.class, () ->
                userManagementService.terminateUser(targetId, statusRequest("reason", "2026-01-01"), httpRequest()));
        assertEquals(UserStatus.Active, target.getStatus());
    }

    @Test
    void deleteUser_engineDeniesOutOfScope_isBlocked() {
        when(currentUserService.requireCurrentUser()).thenReturn(target);
        stubValidSignatureFor(target);
        stubEngineDecision(AuthorizationDecision.deny("OUT_OF_SCOPE"));

        assertThrows(IllegalArgumentException.class, () -> userManagementService.deleteUser(targetId, "sig-token", httpRequest()));
        verify(userRepository, never()).delete(any(UserAccount.class));
    }

    @Test
    void suspendUser_engineDeniesLastActiveAdmin_isBlockedWithLastAdminMessage() {
        when(currentUserService.requireCurrentUser()).thenReturn(otherAdmin);
        stubValidSignatureFor(otherAdmin);
        stubEngineDecision(AuthorizationDecision.deny("LAST_ACTIVE_ADMIN_PROTECTED"));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                userManagementService.suspendUser(targetId, statusRequest("reason", null), httpRequest()));
        assertTrue(ex.getMessage().toLowerCase().contains("last active administrator"));
        assertEquals(UserStatus.Active, target.getStatus());
    }

    @Test
    void suspendUser_engineDeniesMissingPermission_throwsAccessDenied() {
        when(currentUserService.requireCurrentUser()).thenReturn(otherAdmin);
        stubValidSignatureFor(otherAdmin);
        stubEngineDecision(AuthorizationDecision.deny("MISSING_PERMISSION"));

        assertThrows(AccessDeniedException.class, () ->
                userManagementService.suspendUser(targetId, statusRequest("reason", null), httpRequest()));
        assertEquals(UserStatus.Active, target.getStatus());
    }

    @Test
    void suspendUser_engineThrows_failsClosedWithAccessDenied() {
        when(currentUserService.requireCurrentUser()).thenReturn(otherAdmin);
        stubValidSignatureFor(otherAdmin);
        when(authorizationEngineService.authorize(any(AuthorizationRequest.class))).thenThrow(new RuntimeException("boom"));

        assertThrows(AccessDeniedException.class, () ->
                userManagementService.suspendUser(targetId, statusRequest("reason", null), httpRequest()));
        assertEquals(UserStatus.Active, target.getStatus());
    }

    @Test
    void suspendUser_engineAllows_succeeds() {
        when(currentUserService.requireCurrentUser()).thenReturn(otherAdmin);
        stubValidSignatureFor(otherAdmin);
        stubEngineDecision(AuthorizationDecision.allow("settings.user.edit", List.of(), List.of(), 1L, "Active", java.util.Map.of()));
        when(sessionRepository.findAllByUserIdAndRevokedAtIsNullOrderByCreatedAtDesc(targetId)).thenReturn(List.of());

        userManagementService.suspendUser(targetId, statusRequest("reason", null), httpRequest());

        assertEquals(UserStatus.Suspended, target.getStatus());
    }

    @Test
    void suspendUser_requestSentToEngineCarriesResourceTypeIdAndAction() {
        when(currentUserService.requireCurrentUser()).thenReturn(otherAdmin);
        stubValidSignatureFor(otherAdmin);
        stubEngineDecision(AuthorizationDecision.allow("settings.user.edit", List.of(), List.of(), 1L, "Active", java.util.Map.of()));
        when(sessionRepository.findAllByUserIdAndRevokedAtIsNullOrderByCreatedAtDesc(targetId)).thenReturn(List.of());

        userManagementService.suspendUser(targetId, statusRequest("reason", null), httpRequest());

        verify(authorizationEngineService).authorize(argThat(req ->
                "USER".equals(req.resourceType()) && targetId.equals(req.resourceId()) && "SUSPEND".equals(req.actionCode())));
    }

    // isSelfTargetingBlocked/checkLastActiveAdminGuard are package-visible on UserManagementService
    // (package com.eqms.service) -- see UserManagementServiceGuardMethodsTest for direct coverage.
}
