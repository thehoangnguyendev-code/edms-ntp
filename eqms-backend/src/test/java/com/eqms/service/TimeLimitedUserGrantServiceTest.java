package com.eqms.service;

import com.eqms.auth.AuthenticatedUser;
import com.eqms.auth.CurrentUserService;
import com.eqms.auth.TokenService;
import com.eqms.dto.user.UpdateTimeLimitedUserGrantRequest;
import com.eqms.dto.user.CreateTimeLimitedUserGrantRequest;
import com.eqms.entity.TimeLimitedUserGrant;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.TimeLimitedUserGrantRepository;
import com.eqms.repository.UserAccountRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Optional;
import java.util.Set;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Contract/invariant coverage for signed time-limited access amendments. */
@ExtendWith(MockitoExtension.class)
class TimeLimitedUserGrantServiceTest {

    @Mock private TimeLimitedUserGrantRepository grantRepository;
    @Mock private UserAccountRepository userRepository;
    @Mock private CurrentUserService currentUserService;
    @Mock private TokenService tokenService;
    @Mock private ElectronicSignatureService electronicSignatureService;
    @Mock private AuthAuditService auditService;
    @Mock private AuditTrailService auditTrailService;
    @Mock private UserManagementService userManagementService;
    @Mock private NotificationDispatcher notificationDispatcher;

    @InjectMocks private TimeLimitedUserGrantService service;

    private UUID grantId;
    private UserAccount actor;
    private UserAccount target;
    private TimeLimitedUserGrant grant;

    @BeforeEach
    void setUp() {
        grantId = UUID.randomUUID();
        actor = new UserAccount();
        actor.setId(UUID.randomUUID());
        actor.setUsername("administrator");
        target = new UserAccount();
        target.setId(UUID.randomUUID());
        target.setFullName("Taylor User");
        target.setUsername("tuser");
        target.setEmail("taylor@example.test");
        target.setStatus(UserStatus.Active);
        grant = new TimeLimitedUserGrant();
        ReflectionTestUtils.setField(grant, "id", grantId);
        grant.setUser(target);
        grant.setStartAt(Instant.now().minusSeconds(3_600));
        grant.setEndAt(Instant.now().plusSeconds(3_600));
        grant.setNotifyEmailOnExpiry(false);
        grant.setStatus(TimeLimitedUserGrant.STATUS_ACTIVE);

        lenient().when(currentUserService.requireCurrentUser()).thenReturn(actor);
        lenient().when(tokenService.parseSignatureToken("signature-token")).thenReturn(Optional.of(
                new TokenService.ParsedAccessToken("signature", new AuthenticatedUser(
                        actor.getId(), UUID.randomUUID(), actor.getUsername(), null, Set.of()))));
        lenient().when(grantRepository.findById(grantId)).thenReturn(Optional.of(grant));
        lenient().when(grantRepository.save(any(TimeLimitedUserGrant.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void updateGrant_amendsActiveWindow_resetsOldNotification_andWritesAudit() {
        Instant newStart = Instant.now().minusSeconds(60);
        Instant newEnd = Instant.now().plusSeconds(7_200);
        grant.setNotifiedAt(Instant.now().minusSeconds(10));

        var response = service.updateGrant(grantId,
                new UpdateTimeLimitedUserGrantRequest(newStart, newEnd, true, "Extension approved", "signature-token"),
                new MockHttpServletRequest());

        assertEquals(newStart, grant.getStartAt());
        assertEquals(newEnd, grant.getEndAt());
        assertTrue(grant.isNotifyEmailOnExpiry());
        assertNull(grant.getNotifiedAt(), "notification evidence for the old end time cannot suppress the amended window");
        assertEquals(newEnd, response.endAt());
        verify(auditService).log(eq("time_limited_user_grant_updated"), eq(target), anyMap(), any(), any());
        verify(auditTrailService).logAs(eq(actor), eq("USER"), eq("Taylor User"), eq(target.getId()),
                eq("TIME_LIMITED_USER_GRANT_UPDATED"), eq(TimeLimitedUserGrant.STATUS_ACTIVE),
                eq(TimeLimitedUserGrant.STATUS_ACTIVE), anyString(), anyList(), any());
    }

    @Test
    void updateGrant_rejectsEndBeforeStart_beforeSigningOrPersisting() {
        Instant start = Instant.now();
        Instant end = start.minusSeconds(1);

        assertThrows(IllegalArgumentException.class, () -> service.updateGrant(grantId,
                new UpdateTimeLimitedUserGrantRequest(start, end, false, null, "signature-token"), null));

        verifyNoInteractions(currentUserService, tokenService, electronicSignatureService, auditService, auditTrailService);
        verify(grantRepository, never()).findById(any());
    }

    @Test
    void updateGrant_rejectsNonActiveGrant_afterVerifyingActorSignature() {
        grant.setStatus(TimeLimitedUserGrant.STATUS_CANCELLED);

        ResponseStatusException error = assertThrows(ResponseStatusException.class, () -> service.updateGrant(grantId,
                new UpdateTimeLimitedUserGrantRequest(Instant.now().minusSeconds(60), Instant.now().plusSeconds(60), false, null, "signature-token"), null));

        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());

        verifyNoInteractions(electronicSignatureService, auditService, auditTrailService);
        verify(grantRepository, never()).save(any());
    }

    @Test
    void createGrants_rejectsUserWithAnExistingActiveGrant_beforeSigning() {
        when(userRepository.findAllById(List.of(target.getId()))).thenReturn(List.of(target));
        when(grantRepository.existsByUser_IdAndStatus(target.getId(), TimeLimitedUserGrant.STATUS_ACTIVE)).thenReturn(true);

        ResponseStatusException error = assertThrows(ResponseStatusException.class, () -> service.createGrants(
                new CreateTimeLimitedUserGrantRequest(List.of(target.getId()), Instant.now(), Instant.now().plusSeconds(60),
                        false, null, "signature-token"), null));

        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());

        verifyNoInteractions(electronicSignatureService, auditService, auditTrailService);
        verify(grantRepository, never()).save(any());
    }

    @Test
    void applyWindowState_doesNotClaimOrReinstateAManuallySuspendedUser() {
        target.setStatus(UserStatus.Suspended);
        target.setTimeLimitedGrantId(null);
        grant.setStartAt(Instant.now().plusSeconds(3_600));

        service.applyWindowState(grant, target);

        assertNull(target.getTimeLimitedGrantId());
        verify(userRepository, never()).save(target);
        verify(userManagementService, never()).changeUserStatus(any(), any());
    }
}
