package com.eqms;

import com.eqms.auth.CurrentUserService;
import com.eqms.auth.TokenService;
import com.eqms.dto.user.StatusActionRequest;
import com.eqms.dto.user.ForceLogoutRequest;
import com.eqms.entity.AuthSession;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.*;
import com.eqms.service.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Q7 — every transition away from Active must revoke all outstanding sessions and evict the
 * cached permission set immediately, via {@code UserManagementService}'s central
 * {@code changeUserStatus} chokepoint. Without this, a suspended/terminated user's existing
 * session or cached permissions would remain valid until they expired naturally.
 */
@ExtendWith(MockitoExtension.class)
class UserManagementServiceStatusTransitionTest {

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
    @Mock private com.eqms.service.authorization.AuthorizationEngineService authorizationEngineService;
    @Mock private NotificationDispatcher notificationDispatcher;
    @Mock private ElectronicSignatureService electronicSignatureService;
    @Mock private com.eqms.repository.RevisionWorkflowParticipantRepository revisionWorkflowParticipantRepository;
    @Mock private com.eqms.repository.UserAccessProfileRepository userAccessProfileRepository;
    @Mock private com.eqms.service.SodConstraintService sodConstraintService;

    @InjectMocks
    private UserManagementService userManagementService;

    private UUID userId;
    private UserAccount user;
    private UserAccount actor;

    @BeforeEach
    void setUp() {
        // electronicSignatureService is an @Autowired field (not a constructor arg), so
        // @InjectMocks does not populate it — set it explicitly.
        org.springframework.test.util.ReflectionTestUtils.setField(
                userManagementService, "electronicSignatureService", electronicSignatureService);
        org.springframework.test.util.ReflectionTestUtils.setField(
                userManagementService, "revisionWorkflowParticipantRepository", revisionWorkflowParticipantRepository);

        userId = UUID.randomUUID();
        user = new UserAccount();
        user.setId(userId);
        user.setUsername("jdoe");
        user.setFullName("Jane Doe");
        user.setStatus(UserStatus.Active);
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));

        // Guard methods added for the GMP self-escalation / last-active-admin fixes require a
        // distinct acting user; these tests exercise an admin acting on someone else's account.
        actor = new UserAccount();
        actor.setId(UUID.randomUUID());
        actor.setUsername("admin");
        actor.setStatus(UserStatus.Active);
        when(currentUserService.requireCurrentUser()).thenReturn(actor);

        // Signature verification is a required precondition for suspend/terminate; stub it as
        // valid for the acting user so these tests can focus on the status-transition behavior.
        com.eqms.auth.TokenService.ParsedAccessToken signatureClaims =
                new com.eqms.auth.TokenService.ParsedAccessToken(
                        "signature",
                        new com.eqms.auth.AuthenticatedUser(actor.getId(), null, actor.getUsername(), null, java.util.Set.of()));
        lenient().when(tokenService.parseSignatureToken("sig-token")).thenReturn(Optional.of(signatureClaims));

        // These tests exercise the status-transition side effects, not authorization itself --
        // stub the engine (the sole decision authority post cutover-rule-5) to allow.
        lenient().when(authorizationEngineService.authorize(any(com.eqms.service.authorization.AuthorizationRequest.class)))
                .thenReturn(com.eqms.service.authorization.AuthorizationDecision.allow(
                        "settings.user.edit", List.of(), List.of(), 1L, "Active", java.util.Map.of()));
    }

    private StatusActionRequest statusRequest(String reason, String date) {
        return new StatusActionRequest(reason, date, "sig-token");
    }

    private AuthSession activeSession() {
        AuthSession session = new AuthSession();
        session.setId(UUID.randomUUID());
        session.setUser(user);
        session.setStatus(AuthSession.SessionStatus.ACTIVE);
        session.setCreatedAt(Instant.now());
        session.setCurrentSession(true);
        return session;
    }

    @Test
    void suspendUser_recordsAuditOnRevisionsWaitingOnTheSuspendedAssignee() {
        com.eqms.entity.DocumentRevisionRecord revision = new com.eqms.entity.DocumentRevisionRecord();
        revision.setId(UUID.randomUUID());
        revision.setRevisionName("SOP.1_1.0.0");
        com.eqms.entity.RevisionStatusDefinition pendingReview = new com.eqms.entity.RevisionStatusDefinition();
        pendingReview.setCode("PENDING_REVIEW");
        revision.setStatus(pendingReview);
        com.eqms.entity.RevisionWorkflowParticipant pending = new com.eqms.entity.RevisionWorkflowParticipant();
        pending.setRevision(revision);
        pending.setUser(user);
        pending.setParticipantType("REVIEWER");
        pending.setActionStatus("PENDING");
        when(revisionWorkflowParticipantRepository.findAllByUser_IdAndActionStatusAndRevision_Status_CodeIn(
                eq(userId), eq("PENDING"), any())).thenReturn(List.of(pending));

        userManagementService.suspendUser(userId, statusRequest("Under investigation", null), httpRequest());

        verify(auditTrailService).logAs(
                eq(actor), eq("REVISION"), eq("SOP.1_1.0.0"), eq(revision.getId()),
                eq("WORKFLOW_ASSIGNEE_UNAVAILABLE"), eq("PENDING_REVIEW"), eq("PENDING_REVIEW"), any(String.class));
        assertEquals(UserStatus.Suspended, user.getStatus(), "the suspension itself must never be blocked");
    }

    @Test
    void suspendUser_recordsNothingOnRevisionsWhenAssigneeHasNoPendingWork() {
        userManagementService.suspendUser(userId, statusRequest("Under investigation", null), httpRequest());

        verify(auditTrailService, never()).logAs(
                any(), eq("REVISION"), any(), any(), eq("WORKFLOW_ASSIGNEE_UNAVAILABLE"), any(), any(), any(String.class));
    }

    @Test
    void suspendUser_revokesAllSessions_andEvictsPermissionCache() {
        AuthSession session = activeSession();
        user.setTimeLimitedGrantId(UUID.randomUUID());
        when(sessionRepository.findAllByUserIdAndRevokedAtIsNullOrderByCreatedAtDesc(userId))
                .thenReturn(List.of(session));

        userManagementService.suspendUser(userId, statusRequest("Under investigation", null), httpRequest());

        assertEquals(UserStatus.Suspended, user.getStatus());
        assertNotNull(session.getRevokedAt());
        assertEquals(AuthSession.SessionStatus.REVOKED, session.getStatus());
        assertFalse(session.isCurrentSession());
        assertNull(user.getTimeLimitedGrantId(), "a manual suspension must supersede scheduler ownership");
        verify(permissionEvaluationService).evictUserPermissionCache(userId);
    }

    @Test
    void terminateUser_revokesAllSessions_andEvictsPermissionCache() {
        AuthSession session = activeSession();
        user.setTimeLimitedGrantId(UUID.randomUUID());
        when(sessionRepository.findAllByUserIdAndRevokedAtIsNullOrderByCreatedAtDesc(userId))
                .thenReturn(List.of(session));

        userManagementService.terminateUser(userId, statusRequest("Resigned", "2026-01-01"), httpRequest());

        assertEquals(UserStatus.Terminated, user.getStatus());
        assertNotNull(session.getRevokedAt());
        assertNull(user.getTimeLimitedGrantId(), "a termination must supersede scheduler ownership");
        verify(permissionEvaluationService).evictUserPermissionCache(userId);
    }

    @Test
    void forceLogout_revokesSessionsAndWritesAuditWithoutElectronicSignature() {
        AuthSession session = activeSession();
        when(sessionRepository.findAllByUserIdAndRevokedAtIsNullOrderByCreatedAtDesc(userId))
                .thenReturn(List.of(session));

        userManagementService.forceLogout(userId,
                new ForceLogoutRequest("Administrator confirmed immediate logout"), httpRequest());

        assertNotNull(session.getRevokedAt());
        assertEquals(AuthSession.SessionStatus.REVOKED, session.getStatus());
        assertFalse(session.isCurrentSession());
        verify(auditService).log(eq("user_force_logout"), eq(user), anyMap(), any(), any());
        verify(auditTrailService).logAs(
                eq(actor), eq("USER"), eq("Jane Doe"), eq(userId), eq("USER_FORCE_LOGOUT"),
                eq("Active"), eq("REVOKED"), anyString(), isNull(), isNull());
        verifyNoInteractions(tokenService, electronicSignatureService);
    }

    @Test
    void deleteUser_revokesAllSessions_andEvictsPermissionCache() {
        AuthSession session = activeSession();
        when(sessionRepository.findAllByUserIdAndRevokedAtIsNullOrderByCreatedAtDesc(userId))
                .thenReturn(List.of(session));

        userManagementService.deleteUser(userId, "sig-token", httpRequest());

        assertNotNull(session.getRevokedAt());
        verify(permissionEvaluationService).evictUserPermissionCache(userId);
        verify(userRepository).delete(user);
    }

    @Test
    void suspendUser_writesAuditTrailWithOldAndNewStatus() {
        when(sessionRepository.findAllByUserIdAndRevokedAtIsNullOrderByCreatedAtDesc(userId))
                .thenReturn(List.of());

        userManagementService.suspendUser(userId, statusRequest("Policy violation", null), httpRequest());

        verify(auditTrailService).logAs(
                eq(actor), eq("USER"), eq("Jane Doe"), eq(userId), eq("USER_SUSPENDED"),
                eq("Active"), eq("Suspended"), anyString(), anyList(), any()
        );
    }

    @Test
    void suspendUser_fromAlreadyNonActiveStatus_doesNotDoubleRevoke() {
        // Suspending an already-Suspended user (e.g. reason update) must not attempt to
        // re-revoke sessions that were already revoked at the first suspension.
        user.setStatus(UserStatus.Suspended);

        userManagementService.suspendUser(userId, statusRequest("Extended", null), httpRequest());

        verify(sessionRepository, never()).findAllByUserIdAndRevokedAtIsNullOrderByCreatedAtDesc(any());
    }

    private MockHttpServletRequest httpRequest() {
        return new MockHttpServletRequest();
    }
}
