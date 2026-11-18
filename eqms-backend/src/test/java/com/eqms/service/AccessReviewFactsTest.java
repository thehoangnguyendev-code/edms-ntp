package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.entity.AccessReviewItem;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.AccessReviewCampaignRepository;
import com.eqms.repository.AccessReviewItemRepository;
import com.eqms.repository.UserAccessProfileRepository;
import com.eqms.repository.UserAccountRepository;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * SECURITY-AUTHORIZATION-REVIEW D3 and D5 (owner, 2026-11-18): the snapshot of an Access Review item carries the last sign-in, the days without one and whether that passes the
 * threshold, the state of MFA, the end of a time-limited account and the SoD rules the person breaks. Inactive is only a flag: nothing here suspends anyone.
 */
class AccessReviewFactsTest {
    private final SodConstraintService sod = mock(SodConstraintService.class);
    private final AccessReviewService service = new AccessReviewService(mock(AccessReviewCampaignRepository.class), mock(AccessReviewItemRepository.class), mock(UserAccountRepository.class),
            mock(UserAccessProfileRepository.class), mock(EffectivePermissionService.class), mock(PermissionEvaluationService.class), mock(CurrentUserService.class),
            mock(AuditTrailService.class), mock(SecurityChangeSignatureService.class), mock(ElectronicSignatureService.class));

    private static UserAccount user(Instant lastLogin, Instant created) {
        UserAccount u = new UserAccount();
        u.setId(UUID.randomUUID());
        u.setStatus(UserStatus.Active);
        u.setLastLoginAt(lastLogin);
        u.setCreatedAt(created);
        return u;
    }

    private static EffectivePermissionService.EffectivePermissionResult effective(boolean superAdmin, String... codes) {
        return new EffectivePermissionService.EffectivePermissionResult(UUID.randomUUID(), Set.of(codes), List.of(), List.of(), superAdmin, false);
    }

    private AccessReviewItem capture(UserAccount user, EffectivePermissionService.EffectivePermissionResult effective, int threshold, boolean mfaGlobal, Map<UUID, Instant> limited) {
        AccessReviewItem item = new AccessReviewItem();
        service.captureFacts(item, user, effective, threshold, mfaGlobal, limited);
        return item;
    }

    private static Instant daysAgo(int days) { return Instant.now().minus(Duration.ofDays(days)).minusSeconds(60); }

    @Test
    void anAccountThatSignedInRecentlyIsNotFlaggedAndOneBeyondTheThresholdIs() {
        AccessReviewItem recent = capture(user(daysAgo(3), daysAgo(500)), effective(false), 90, false, Map.of());
        AccessReviewItem stale = capture(user(daysAgo(120), daysAgo(500)), effective(false), 90, false, Map.of());

        assertThat(recent.getInactiveDays()).isEqualTo(3);
        assertThat(recent.getInactiveFlag()).isFalse();
        assertThat(stale.getInactiveDays()).isEqualTo(120);
        assertThat(stale.getInactiveFlag()).isTrue();
        assertThat(stale.getLastLoginAt()).isNotNull();
    }

    @Test
    void theDayTheAccountWasCreatedCountsWhenThePersonNeverSignedIn() {
        AccessReviewItem never = capture(user(null, daysAgo(200)), effective(false), 90, false, Map.of());

        assertThat(never.getLastLoginAt()).isNull();
        assertThat(never.getInactiveDays()).isEqualTo(200);
        assertThat(never.getInactiveFlag()).isTrue();
    }

    @Test
    void aThresholdOfZeroSwitchesTheFlagOffButStillShowsTheDays() {
        AccessReviewItem item = capture(user(daysAgo(400), daysAgo(500)), effective(false), 0, false, Map.of());

        assertThat(item.getInactiveFlag()).isFalse();
        assertThat(item.getInactiveDays()).isEqualTo(400);
    }

    @Test
    void theThresholdIsInclusive() {
        assertThat(capture(user(daysAgo(90), daysAgo(500)), effective(false), 90, false, Map.of()).getInactiveFlag()).isTrue();
        assertThat(capture(user(daysAgo(89), daysAgo(500)), effective(false), 90, false, Map.of()).getInactiveFlag()).isFalse();
    }

    @Test
    void mfaIsEnrolledRequiredButNotEnrolledOrNotEnrolled() {
        UserAccount enrolled = user(daysAgo(1), daysAgo(9));
        enrolled.setMfaEnabled(true);
        UserAccount requiredByAdmin = user(daysAgo(1), daysAgo(9));
        requiredByAdmin.setMfaRequiredByAdmin(true);
        UserAccount plain = user(daysAgo(1), daysAgo(9));

        assertThat(capture(enrolled, effective(false), 90, true, Map.of()).getMfaState()).isEqualTo("ENROLLED");
        assertThat(capture(requiredByAdmin, effective(false), 90, false, Map.of()).getMfaState()).isEqualTo("REQUIRED_NOT_ENROLLED");
        assertThat(capture(plain, effective(false), 90, true, Map.of()).getMfaState()).isEqualTo("REQUIRED_NOT_ENROLLED");
        assertThat(capture(plain, effective(false), 90, false, Map.of()).getMfaState()).isEqualTo("NOT_ENROLLED");
    }

    @Test
    void theEndOfATimeLimitedAccountIsCarriedFromTheActiveGrant() {
        UserAccount limited = user(daysAgo(1), daysAgo(9));
        Instant end = Instant.now().plus(Duration.ofDays(5));

        assertThat(capture(limited, effective(false), 90, false, Map.of(limited.getId(), end)).getTimeLimitedUntil()).isEqualTo(end);
        assertThat(capture(user(daysAgo(1), daysAgo(9)), effective(false), 90, false, Map.of()).getTimeLimitedUntil()).isNull();
    }

    @Test
    void theSodRulesABrokenCountIsTakenFromThePermissionsHeldAndLeftEmptyForASuperAdmin() {
        ReflectionTestUtils.setField(service, "sodConstraintService", sod);
        when(sod.countActiveViolations(Set.of("a.b.c", "d.e.f"))).thenReturn(2);

        assertThat(capture(user(daysAgo(1), daysAgo(9)), effective(false, "a.b.c", "d.e.f"), 90, false, Map.of()).getOpenSodViolations()).isEqualTo(2);
        assertThat(capture(user(daysAgo(1), daysAgo(9)), effective(true), 90, false, Map.of()).getOpenSodViolations()).isNull();
    }

    @Test
    void withoutTheSodServiceTheCountIsLeftEmptyInsteadOfGuessed() {
        assertThat(capture(user(daysAgo(1), daysAgo(9)), effective(false, "a.b.c", "d.e.f"), 90, false, Map.of()).getOpenSodViolations()).isNull();
    }
}
