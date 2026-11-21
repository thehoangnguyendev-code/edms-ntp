package com.eqms.service;

import com.eqms.entity.TimeLimitedUserGrant;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.TimeLimitedUserGrantRepository;
import com.eqms.repository.UserAccountRepository;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;

/** The scheduler suspends and reinstates accounts by itself; that is an access-control change and it is written to the Audit Trail with the system as the actor. */
class AutomaticAccessChangesAreAuditedTest {

    private final AuditTrailService audit = Mockito.mock(AuditTrailService.class);
    private final UserManagementService users = Mockito.mock(UserManagementService.class);
    private final TimeLimitedUserGrantService service = new TimeLimitedUserGrantService(
            Mockito.mock(TimeLimitedUserGrantRepository.class), Mockito.mock(UserAccountRepository.class), null, null, null, null, audit, users,
            Mockito.mock(NotificationDispatcher.class));

    private UserAccount person(UserStatus status, UUID id) {
        UserAccount user = new UserAccount();
        user.setId(id);
        user.setFullName("Tran Thi B");
        user.setUsername("tran.b");
        user.setStatus(status);
        return user;
    }

    private TimeLimitedUserGrant grant(Instant start, Instant end) {
        TimeLimitedUserGrant grant = new TimeLimitedUserGrant();
        org.springframework.test.util.ReflectionTestUtils.setField(grant, "id", UUID.randomUUID());
        grant.setStatus(TimeLimitedUserGrant.STATUS_ACTIVE);
        grant.setStartAt(start);
        grant.setEndAt(end);
        return grant;
    }

    @Test
    void anEndedWindowSuspendsTheAccountAndSaysSoInTheAuditTrail() {
        UUID id = UUID.randomUUID();
        UserAccount user = person(UserStatus.Active, id);

        service.applyWindowState(grant(Instant.now().minus(Duration.ofDays(3)), Instant.now().minus(Duration.ofMinutes(1))), user);

        verify(audit).logSystem(eq("USER"), eq("Tran Thi B"), eq(id), eq("USER_SUSPENDED"), eq("Active"), eq("Suspended"), contains("window ended"));
    }

    @Test
    void anOpenedWindowReinstatesTheAccountThatThisGrantSuspendedAndSaysSo() {
        UUID id = UUID.randomUUID();
        UserAccount user = person(UserStatus.Suspended, id);
        TimeLimitedUserGrant grant = grant(Instant.now().minus(Duration.ofMinutes(5)), Instant.now().plus(Duration.ofDays(2)));
        user.setTimeLimitedGrantId(grant.getId());

        service.applyWindowState(grant, user);

        verify(audit).logSystem(eq("USER"), eq("Tran Thi B"), eq(id), eq("USER_REINSTATED"), eq("Suspended"), eq("Active"), contains("window opened"));
    }

    @Test
    void anAccountSuspendedByAPersonIsNotTouchedAndNothingIsRecorded() {
        UserAccount user = person(UserStatus.Suspended, UUID.randomUUID());

        service.applyWindowState(grant(Instant.now().minus(Duration.ofMinutes(5)), Instant.now().plus(Duration.ofDays(2))), user);

        Mockito.verify(audit, Mockito.never()).logSystem(Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any());
    }
}
