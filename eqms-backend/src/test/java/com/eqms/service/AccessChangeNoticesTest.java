package com.eqms.service;

import com.eqms.entity.RoleDefinition;
import com.eqms.entity.TimeLimitedUserGrant;
import com.eqms.entity.UserAccount;
import com.eqms.repository.RoleDefinitionRepository;
import com.eqms.repository.TimeLimitedUserGrantRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** The person is told when an Access Profile is assigned or removed, and once, a few days before a time-limited window ends. */
class AccessChangeNoticesTest {

    private final NotificationDispatcher dispatcher = Mockito.mock(NotificationDispatcher.class);
    private final UserAccount person = Mockito.mock(UserAccount.class);

    /** The service with a mock for every collaborator; only the profile lookup and the dispatcher matter here. */
    private AccessProfileService accessProfileService(RoleDefinitionRepository roles) throws ReflectiveOperationException {
        var constructor = AccessProfileService.class.getConstructors()[0];
        Class<?>[] types = constructor.getParameterTypes();
        Object[] args = new Object[types.length];
        for (int i = 0; i < types.length; i++) {
            if (types[i] == RoleDefinitionRepository.class) args[i] = roles;
            else if (types[i] == NotificationDispatcher.class) args[i] = dispatcher;
            else args[i] = Mockito.mock(types[i]);
        }
        return (AccessProfileService) constructor.newInstance(args);
    }

    @Test
    @SuppressWarnings("unchecked")
    void assigningAProfileTellsThePersonWhichProfile() throws Exception {
        UUID profileId = UUID.randomUUID();
        RoleDefinitionRepository roles = Mockito.mock(RoleDefinitionRepository.class);
        RoleDefinition profile = Mockito.mock(RoleDefinition.class);
        when(profile.getName()).thenReturn("Document Reviewer");
        when(roles.findById(profileId)).thenReturn(Optional.of(profile));

        accessProfileService(roles).notifyAccessChanged(person, profileId, "assigned");

        ArgumentCaptor<Map<String, String>> variables = ArgumentCaptor.forClass(Map.class);
        verify(dispatcher).dispatchIndependently(eq("user.access_profile_changed"), eq(List.of(person)), variables.capture());
        assertThat(variables.getValue()).containsEntry("profileName", "Document Reviewer").containsEntry("changeType", "assigned");
    }

    @Test
    void aFailureOfTheNoticeNeverUndoesTheChange() throws Exception {
        RoleDefinitionRepository roles = Mockito.mock(RoleDefinitionRepository.class);
        when(roles.findById(any())).thenReturn(Optional.empty());
        when(dispatcher.dispatchIndependently(any(String.class), anyList(), anyMap())).thenThrow(new IllegalStateException("mail down"));

        accessProfileService(roles).notifyAccessChanged(person, UUID.randomUUID(), "removed");
    }

    private TimeLimitedUserGrantScheduler scheduler() {
        return new TimeLimitedUserGrantScheduler(Mockito.mock(TimeLimitedUserGrantRepository.class), null, null, null, dispatcher);
    }

    private TimeLimitedUserGrant grant(Instant start, Instant end) {
        TimeLimitedUserGrant grant = new TimeLimitedUserGrant();
        grant.setStatus(TimeLimitedUserGrant.STATUS_ACTIVE);
        grant.setStartAt(start);
        grant.setEndAt(end);
        return grant;
    }

    @Test
    void windowEndingInTwoDaysIsWarnedOnceAndRemembered() {
        TimeLimitedUserGrant grant = grant(Instant.now().minus(Duration.ofDays(5)), Instant.now().plus(Duration.ofDays(2)));
        when(dispatcher.dispatch(eq("user.time_limited_access_expiring"), anyList(), anyMap()))
                .thenReturn(new NotificationDispatcher.Outcome(null, true, false, true, false));
        TimeLimitedUserGrantScheduler scheduler = scheduler();

        scheduler.warnBeforeEnd(grant, person);
        scheduler.warnBeforeEnd(grant, person);

        assertThat(grant.getExpiryWarnedAt()).isNotNull();
        verify(dispatcher, Mockito.times(1)).dispatch(eq("user.time_limited_access_expiring"), anyList(), anyMap());
    }

    @Test
    void windowEndingInTenDaysIsNotWarnedYet() {
        TimeLimitedUserGrant grant = grant(Instant.now().minus(Duration.ofDays(5)), Instant.now().plus(Duration.ofDays(10)));

        scheduler().warnBeforeEnd(grant, person);

        verify(dispatcher, never()).dispatch(any(String.class), anyList(), anyMap());
        assertThat(grant.getExpiryWarnedAt()).isNull();
    }

    @Test
    void aWarningThatCouldNotBeSentIsNotRememberedSoItIsTriedAgain() {
        TimeLimitedUserGrant grant = grant(Instant.now().minus(Duration.ofDays(5)), Instant.now().plus(Duration.ofDays(1)));
        when(dispatcher.dispatch(eq("user.time_limited_access_expiring"), anyList(), anyMap()))
                .thenReturn(new NotificationDispatcher.Outcome("NO_RECIPIENT", false, false, false, false));

        scheduler().warnBeforeEnd(grant, person);

        assertThat(grant.getExpiryWarnedAt()).isNull();
    }
}
