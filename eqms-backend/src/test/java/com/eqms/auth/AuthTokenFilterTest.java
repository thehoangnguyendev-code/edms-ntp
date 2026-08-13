package com.eqms.auth;

import com.eqms.entity.AuthSession;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.AuthSessionRepository;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.AuditTrailService;
import com.eqms.service.PermissionEvaluationService;
import com.eqms.service.SystemConfigurationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.Instant;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Q7 — {@code AuthTokenFilter} is the primary enforcement point: only a user whose account
 * status is Active may be granted a {@code SecurityContext}, regardless of whether their
 * session/token is otherwise valid.
 */
@ExtendWith(MockitoExtension.class)
class AuthTokenFilterTest {

    @Mock private TokenService tokenService;
    @Mock private AuthSessionRepository sessionRepository;
    @Mock private UserAccountRepository userRepository;
    @Mock private PermissionEvaluationService permissionEvaluationService;
    @Mock private SystemConfigurationService systemConfigurationService;
    @Mock private AuditTrailService auditTrailService;

    private AuthTokenFilter filter;
    private UUID userId;
    private UUID sessionId;
    private AuthSession session;

    @BeforeEach
    void setUp() {
        filter = new AuthTokenFilter(
                tokenService, sessionRepository, userRepository,
                permissionEvaluationService, systemConfigurationService,
                auditTrailService, new ObjectMapper()
        );

        userId = UUID.randomUUID();
        sessionId = UUID.randomUUID();

        session = new AuthSession();
        session.setId(sessionId);
        session.setStatus(AuthSession.SessionStatus.ACTIVE);
        session.setCreatedAt(Instant.now());
        session.setLastActivityAt(Instant.now());
        session.setExpiresAt(Instant.now().plusSeconds(3600));
        session.setCurrentSession(true);

        when(sessionRepository.findById(sessionId)).thenReturn(Optional.of(session));
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    private UserAccount user(UserStatus status) {
        UserAccount u = new UserAccount();
        u.setId(userId);
        u.setUsername("jdoe");
        u.setFullName("Jane Doe");
        u.setStatus(status);
        return u;
    }

    private MockHttpServletRequest requestWithBearerToken() {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/documents");
        request.addHeader("Authorization", "Bearer faketoken");
        return request;
    }

    private void stubParsedToken() {
        stubParsedToken("DCO");
    }

    private void stubParsedToken(String role) {
        AuthenticatedUser principal = new AuthenticatedUser(userId, sessionId, "jdoe", role, Set.of());
        when(tokenService.parseAccessToken("faketoken"))
                .thenReturn(Optional.of(new TokenService.ParsedAccessToken("access", principal)));
    }

    private void stubActiveUserPastStatusGate() {
        when(userRepository.findById(userId)).thenReturn(Optional.of(user(UserStatus.Active)));
        when(systemConfigurationService.getSessionTimeoutMinutes()).thenReturn(30);
        when(systemConfigurationService.isPasswordExpired(any())).thenReturn(false);
    }

    private MockHttpServletResponse runFilter(MockHttpServletRequest request) throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, (req, res) -> { });
        return response;
    }

    // ── Non-Active statuses are denied before any permission/password check ────────────────

    @Test
    void suspendedUser_isDenied401_andNeverGrantedSecurityContext() throws Exception {
        stubParsedToken();
        when(userRepository.findById(userId)).thenReturn(Optional.of(user(UserStatus.Suspended)));
        when(systemConfigurationService.getSessionTimeoutMinutes()).thenReturn(30);

        MockHttpServletResponse response = runFilter(requestWithBearerToken());

        assertEquals(401, response.getStatus());
        assertTrue(response.getContentAsString().contains("ACCOUNT_SUSPENDED"));
        assertNull(SecurityContextHolder.getContext().getAuthentication());
        verifyNoInteractions(permissionEvaluationService);
        verify(auditTrailService).logSafely(eq("SESSION"), any(), eq(userId), eq("ACCESS_DENIED_INACTIVE_ACCOUNT"), any(), any(), any());
    }

    @Test
    void pendingUser_isDenied401WithPendingCode() throws Exception {
        stubParsedToken();
        when(userRepository.findById(userId)).thenReturn(Optional.of(user(UserStatus.Pending)));
        when(systemConfigurationService.getSessionTimeoutMinutes()).thenReturn(30);

        MockHttpServletResponse response = runFilter(requestWithBearerToken());

        assertEquals(401, response.getStatus());
        assertTrue(response.getContentAsString().contains("ACCOUNT_PENDING_ACTIVATION"));
    }

    @Test
    void inactiveUser_isDenied401WithInactiveCode() throws Exception {
        stubParsedToken();
        when(userRepository.findById(userId)).thenReturn(Optional.of(user(UserStatus.Inactive)));
        when(systemConfigurationService.getSessionTimeoutMinutes()).thenReturn(30);

        MockHttpServletResponse response = runFilter(requestWithBearerToken());

        assertEquals(401, response.getStatus());
        assertTrue(response.getContentAsString().contains("ACCOUNT_INACTIVE"));
    }

    @Test
    void terminatedUser_isDenied401WithTerminatedCode() throws Exception {
        stubParsedToken();
        when(userRepository.findById(userId)).thenReturn(Optional.of(user(UserStatus.Terminated)));
        when(systemConfigurationService.getSessionTimeoutMinutes()).thenReturn(30);

        MockHttpServletResponse response = runFilter(requestWithBearerToken());

        assertEquals(401, response.getStatus());
        assertTrue(response.getContentAsString().contains("ACCOUNT_TERMINATED"));
    }

    @Test
    void deletedUser_sessionValidButUserGone_isDenied401() throws Exception {
        stubParsedToken();
        when(userRepository.findById(userId)).thenReturn(Optional.empty());
        when(systemConfigurationService.getSessionTimeoutMinutes()).thenReturn(30);

        MockHttpServletResponse response = runFilter(requestWithBearerToken());

        assertEquals(401, response.getStatus());
        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }

    // ── Active user is unaffected ───────────────────────────────────────────────────────────

    @Test
    void activeUser_isGrantedSecurityContext() throws Exception {
        stubParsedToken();
        stubActiveUserPastStatusGate();
        when(systemConfigurationService.isMaintenanceModeEnabled()).thenReturn(false);
        when(permissionEvaluationService.getPermissionCodes(any())).thenReturn(Set.of("documents.module.view"));
        when(tokenService.toAuthorities(any())).thenReturn(java.util.List.of());

        MockHttpServletResponse response = runFilter(requestWithBearerToken());

        assertEquals(200, response.getStatus());
        assertNotNull(SecurityContextHolder.getContext().getAuthentication());
    }

    // ── F-02: maintenance-mode bypass is permission-based, never a display role name ──────────

    @Test
    void maintenanceMode_userWithBypassPermission_isLetThrough() throws Exception {
        stubParsedToken("Read-Only User");
        stubActiveUserPastStatusGate();
        when(systemConfigurationService.isMaintenanceModeEnabled()).thenReturn(true);
        when(permissionEvaluationService.hasPermission(any(), eq("security.maintenance.bypass"))).thenReturn(true);
        when(permissionEvaluationService.getPermissionCodes(any())).thenReturn(Set.of("security.maintenance.bypass"));
        when(tokenService.toAuthorities(any())).thenReturn(java.util.List.of());

        MockHttpServletResponse response = runFilter(requestWithBearerToken());

        assertEquals(200, response.getStatus());
    }

    @Test
    void maintenanceMode_systemSuperAdmin_isLetThrough() throws Exception {
        stubParsedToken("Read-Only User");
        stubActiveUserPastStatusGate();
        when(systemConfigurationService.isMaintenanceModeEnabled()).thenReturn(true);
        when(permissionEvaluationService.hasPermission(any(), eq("security.maintenance.bypass"))).thenReturn(false);
        when(permissionEvaluationService.isSuperAdmin(any())).thenReturn(true);
        when(permissionEvaluationService.getPermissionCodes(any())).thenReturn(Set.of());
        when(tokenService.toAuthorities(any())).thenReturn(java.util.List.of());

        MockHttpServletResponse response = runFilter(requestWithBearerToken());

        assertEquals(200, response.getStatus());
    }

    /**
     * Regression guard for F-02: a legacy display role name of "ADMIN"/"SUPERADMIN" with no
     * actual {@code security.maintenance.bypass} permission grant must NOT bypass maintenance
     * mode. The old {@code isMaintenanceExemptRole} role-name check was removed for exactly
     * this reason.
     */
    @Test
    void maintenanceMode_roleNameAdminWithoutPermission_isBlocked() throws Exception {
        stubParsedToken("ADMIN");
        stubActiveUserPastStatusGate();
        when(systemConfigurationService.isMaintenanceModeEnabled()).thenReturn(true);
        when(permissionEvaluationService.hasPermission(any(), eq("security.maintenance.bypass"))).thenReturn(false);
        when(permissionEvaluationService.isSuperAdmin(any())).thenReturn(false);

        MockHttpServletResponse response = runFilter(requestWithBearerToken());

        assertEquals(503, response.getStatus());
        assertTrue(response.getContentAsString().contains("MAINTENANCE_MODE"));
        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }

    @Test
    void maintenanceMode_ordinaryUserWithoutBypass_isBlocked() throws Exception {
        stubParsedToken("Read-Only User");
        stubActiveUserPastStatusGate();
        when(systemConfigurationService.isMaintenanceModeEnabled()).thenReturn(true);
        when(permissionEvaluationService.hasPermission(any(), eq("security.maintenance.bypass"))).thenReturn(false);
        when(permissionEvaluationService.isSuperAdmin(any())).thenReturn(false);

        MockHttpServletResponse response = runFilter(requestWithBearerToken());

        assertEquals(503, response.getStatus());
    }

    @Test
    void maintenanceMode_authEndpointPrefix_isNeverBlocked() throws Exception {
        stubParsedToken("Read-Only User");
        stubActiveUserPastStatusGate();
        when(systemConfigurationService.isMaintenanceModeEnabled()).thenReturn(true);
        when(permissionEvaluationService.getPermissionCodes(any())).thenReturn(Set.of());
        when(tokenService.toAuthorities(any())).thenReturn(java.util.List.of());

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/auth/me");
        request.addHeader("Authorization", "Bearer faketoken");

        MockHttpServletResponse response = runFilter(request);

        // /api/auth/** must never be maintenance-blocked, independent of bypass permission —
        // getRequestURI() includes the server.servlet.context-path ("/api"), so the filter's
        // prefix check must match against "/api/auth/", not "/auth/".
        assertEquals(200, response.getStatus());
        verify(permissionEvaluationService, never()).hasPermission(any(), eq("security.maintenance.bypass"));
    }
}
