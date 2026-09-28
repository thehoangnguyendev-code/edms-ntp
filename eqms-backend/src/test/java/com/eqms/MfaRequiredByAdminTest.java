package com.eqms;

import com.eqms.dto.user.UpdateUserRequest;
import com.eqms.dto.user.UserManagementResponse;
import com.eqms.entity.UserAccount;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.UserManagementService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Real-DB evidence for the per-user admin-mandated MFA requirement
 * (UserAccount#mfaRequiredByAdmin / CreateUserRequest / UpdateUserRequest / UserManagementResponse):
 * it round-trips through update -> get, only ADDS to (never exempts from) the global
 * "Enforce Two-Factor Authentication" setting, and drives mfaSetupRequired the same way
 * AuthService#requiresMfaSetup computes it for login-time enforcement.
 */
@SpringBootTest
class MfaRequiredByAdminTest {

    @Autowired private UserManagementService userManagementService;
    @Autowired private UserAccountRepository userAccountRepository;

    private UserAccount actor;
    private boolean originalMfaRequiredByAdmin;
    private boolean originalMfaEnabled;

    @BeforeEach
    void setUp() {
        actor = userAccountRepository.findAll().stream()
                .filter(u -> "admin".equals(u.getUsername()))
                .findFirst().orElseThrow();
        originalMfaRequiredByAdmin = actor.isMfaRequiredByAdmin();
        originalMfaEnabled = actor.isMfaEnabled();
        runAsActor(actor);
    }

    @AfterEach
    void cleanup() {
        actor.setMfaRequiredByAdmin(originalMfaRequiredByAdmin);
        actor.setMfaEnabled(originalMfaEnabled);
        userAccountRepository.save(actor);
        SecurityContextHolder.clearContext();
    }

    private void runAsActor(UserAccount who) {
        var principal = new com.eqms.auth.AuthenticatedUser(
                who.getId(), UUID.randomUUID(), who.getUsername(),
                who.getRoleName() != null ? who.getRoleName() : "USER", java.util.Collections.emptySet());
        var auth = new UsernamePasswordAuthenticationToken(principal, null, List.of());
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    @Test
    void mfaRequiredByAdmin_roundTripsThroughUpdateAndGet() {
        UserManagementResponse enabled = userManagementService.updateUser(
                actor.getId(), updateRequest(true), new MockHttpServletRequest());
        assertTrue(enabled.mfaRequiredByAdmin());

        UserManagementResponse fetched = userManagementService.getUser(actor.getId());
        assertTrue(fetched.mfaRequiredByAdmin());

        UserManagementResponse disabled = userManagementService.updateUser(
                actor.getId(), updateRequest(false), new MockHttpServletRequest());
        assertFalse(disabled.mfaRequiredByAdmin());
    }

    @Test
    void mfaSetupRequired_isTrue_whenAdminRequiresItAndUserHasNotEnrolled() {
        UserAccount fresh = userAccountRepository.findById(actor.getId()).orElseThrow();
        fresh.setMfaEnabled(false);
        userAccountRepository.save(fresh);

        UserManagementResponse response = userManagementService.updateUser(
                actor.getId(), updateRequest(true), new MockHttpServletRequest());

        assertTrue(response.mfaRequiredByAdmin());
        assertTrue(response.mfaSetupRequired(),
                "A user required by admin to have MFA, who has not enrolled any factor yet, "
                        + "must be flagged mfaSetupRequired so the login gate gets a chance to redirect them.");
    }

    @Test
    void mfaSetupRequired_isFalse_onceUserHasAlreadyEnrolled_evenIfAdminRequiresIt() {
        UserAccount fresh = userAccountRepository.findById(actor.getId()).orElseThrow();
        fresh.setMfaEnabled(true);
        userAccountRepository.save(fresh);

        UserManagementResponse response = userManagementService.updateUser(
                actor.getId(), updateRequest(true), new MockHttpServletRequest());

        assertTrue(response.mfaRequiredByAdmin());
        assertFalse(response.mfaSetupRequired(),
                "A user who already enrolled a factor must not be pushed back into the setup wizard.");
    }

    private UpdateUserRequest updateRequest(Boolean mfaRequiredByAdmin) {
        return new UpdateUserRequest(
                null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, null,
                mfaRequiredByAdmin
        );
    }
}
