package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.auth.TokenService;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.*;
import com.eqms.service.authorization.AuthorizationEngineService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.dto.user.UpdateUserRequest;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Direct coverage for {@link UserManagementService}'s package-visible GMP guard methods
 * (SECURITY_AUTHORIZATION_HYBRID_REFACTOR_PLAN.md Phase 4) -- {@code isSelfTargetingBlocked} and
 * {@code checkLastActiveAdminGuard}. These are the real logic {@link UserResourceAdapter} wires
 * into {@code isWithinObjectScope}/{@code checkPrecondition} for the engine, and post-cutover
 * (2026-08-11) they're only reachable via the engine at the {@code UserManagementService} call
 * sites -- see {@code UserManagementServiceSelfEscalationGuardTest} in package {@code com.eqms}
 * for that mocked-engine, message-mapping coverage.
 */
@ExtendWith(MockitoExtension.class)
class UserManagementServiceGuardMethodsTest {

    @Mock private UserAccountRepository userRepository;
    @Mock private UserEducationRepository educationRepository;
    @Mock private UserCertificationRepository certificationRepository;
    @Mock private BusinessUnitRepository businessUnitRepository;
    @Mock private DepartmentRepository departmentRepository;
    @Mock private PositionRepository positionRepository;
    @Mock private UserLanguageRepository userLanguageRepository;
    @Mock private RoleDefinitionRepository roleRepository;
    @Mock private PermissionRepository permissionRepository;
    @Mock private PermissionEvaluationService permissionEvaluationService;
    @Mock private DocumentWorkflowSettingRepository documentWorkflowSettingRepository;
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
    @Mock private com.eqms.repository.UserAccessProfileRepository userAccessProfileRepository;
    @Mock private com.eqms.service.SodConstraintService sodConstraintService;

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
        target.setStatus(UserStatus.Active);

        otherAdminId = UUID.randomUUID();
        otherAdmin = new UserAccount();
        otherAdmin.setId(otherAdminId);
        otherAdmin.setStatus(UserStatus.Active);
    }

    @Test
    void isSelfTargetingBlocked_guardedActionsOnly() {
        assertTrue(userManagementService.isSelfTargetingBlocked(targetId, targetId, "SUSPEND"));
        assertTrue(userManagementService.isSelfTargetingBlocked(targetId, targetId, "TERMINATE"));
        assertTrue(userManagementService.isSelfTargetingBlocked(targetId, targetId, "DELETE"));
        assertFalse(userManagementService.isSelfTargetingBlocked(targetId, targetId, "UPDATE"));
        assertFalse(userManagementService.isSelfTargetingBlocked(targetId, otherAdminId, "SUSPEND"));
    }

    @Test
    void checkLastActiveAdminGuard_targetIsLastActiveAdmin_returnsProtectedReason() {
        when(userRepository.findById(targetId)).thenReturn(Optional.of(target));
        when(permissionEvaluationService.hasPermission(target, "settings.user.edit")).thenReturn(true);
        when(userRepository.findAll()).thenReturn(List.of(target, otherAdmin));
        when(permissionEvaluationService.hasPermission(otherAdmin, "settings.user.edit")).thenReturn(false);

        Optional<String> reason = userManagementService.checkLastActiveAdminGuard(targetId, "SUSPEND");

        assertTrue(reason.isPresent());
        assertEquals("LAST_ACTIVE_ADMIN_PROTECTED", reason.get());
    }

    @Test
    void checkLastActiveAdminGuard_anotherActiveAdminRemains_returnsEmpty() {
        when(userRepository.findById(targetId)).thenReturn(Optional.of(target));
        when(permissionEvaluationService.hasPermission(target, "settings.user.edit")).thenReturn(true);
        when(userRepository.findAll()).thenReturn(List.of(target, otherAdmin));
        when(permissionEvaluationService.hasPermission(otherAdmin, "settings.user.edit")).thenReturn(true);

        assertTrue(userManagementService.checkLastActiveAdminGuard(targetId, "SUSPEND").isEmpty());
    }

    @Test
    void checkLastActiveAdminGuard_targetWithoutAdminPermission_returnsEmptyWithoutQueryingAll() {
        when(userRepository.findById(targetId)).thenReturn(Optional.of(target));
        when(permissionEvaluationService.hasPermission(target, "settings.user.edit")).thenReturn(false);

        assertTrue(userManagementService.checkLastActiveAdminGuard(targetId, "SUSPEND").isEmpty());
        verify(userRepository, never()).findAll();
    }

    @Test
    void checkLastActiveAdminGuard_notAGuardedAction_returnsEmptyWithoutLookup() {
        assertTrue(userManagementService.checkLastActiveAdminGuard(targetId, "UPDATE").isEmpty());
        verify(userRepository, never()).findById(any());
    }

    /**
     * Regression: the raw base64 avatar payload must never be written into the audit trail --
     * only a redacted marker. Covers the Admin-edits-another-user path
     * (UserManagementService.detectUserChanges); AuthService.updateProfile (self-service) has the
     * equivalent redaction inline, covered separately.
     */
    @Test
    @SuppressWarnings("unchecked")
    void detectUserChanges_avatarChanged_logsRedactedMarker_notRawBase64() {
        target.setAvatar("data:image/png;base64," + "A".repeat(50_000));
        UpdateUserRequest request = new UpdateUserRequest(
                null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null,
                "data:image/png;base64," + "B".repeat(50_000), null, null);

        List<AuditTrailChangeResponse> changes = (List<AuditTrailChangeResponse>)
                ReflectionTestUtils.invokeMethod(userManagementService, "detectUserChanges", target, request);

        assertEquals(1, changes.size());
        AuditTrailChangeResponse change = changes.get(0);
        assertEquals("avatar", change.field());
        assertEquals("(previous image)", change.oldValue());
        assertEquals("(new image)", change.newValue());
    }

    @Test
    @SuppressWarnings("unchecked")
    void detectUserChanges_avatarUnchanged_noEntryLogged() {
        String same = "data:image/png;base64," + "A".repeat(50_000);
        target.setAvatar(same);
        UpdateUserRequest request = new UpdateUserRequest(
                null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, same, null, null);

        List<AuditTrailChangeResponse> changes = (List<AuditTrailChangeResponse>)
                ReflectionTestUtils.invokeMethod(userManagementService, "detectUserChanges", target, request);

        assertTrue(changes.isEmpty());
    }
}
