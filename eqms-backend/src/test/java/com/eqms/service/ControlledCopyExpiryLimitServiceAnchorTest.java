package com.eqms.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.eqms.entity.ControlledCopyExpiryLimit;
import com.eqms.repository.ControlledCopyExpiryLimitRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * The Controlled Copy expiry limit is a duration ("valid for N days after it is distributed"),
 * not a fixed clock instant. resolveExpiryFrom() must add that duration to the caller-supplied
 * anchor -- at Distribute time this anchor is the real distribution moment, not the moment the
 * copy was requested -- so a copy waiting in Ready for Distribution can never turn out to already
 * be expired by the time someone gets to distribute it.
 */
class ControlledCopyExpiryLimitServiceAnchorTest {

    private ControlledCopyExpiryLimitRepository repository;
    private ControlledCopyExpiryLimitService service;

    @BeforeEach
    void setUp() {
        repository = mock(ControlledCopyExpiryLimitRepository.class);
        service = new ControlledCopyExpiryLimitService(repository, null, null, null, null, null, null);
    }

    private ControlledCopyExpiryLimit globalDefault(int value, String unit) {
        ControlledCopyExpiryLimit limit = new ControlledCopyExpiryLimit();
        limit.setDurationValue(value);
        limit.setDurationUnit(unit);
        limit.setActive(true);
        return limit;
    }

    @Test
    void anchorsTheDurationToTheGivenInstantRatherThanNow() {
        when(repository.findAllByActiveTrue()).thenReturn(List.of(globalDefault(3, "DAYS")));

        Instant requestedLongAgo = Instant.now().minus(30, ChronoUnit.DAYS);
        Instant distributedNow = Instant.now();

        Instant fromRequestTime = service.resolveExpiryFrom(null, null, requestedLongAgo);
        Instant fromDistributionTime = service.resolveExpiryFrom(null, null, distributedNow);

        // Same policy, different anchors: the two must differ by exactly the gap between the
        // anchors, proving the duration is added to the anchor and not to "now".
        assertEquals(requestedLongAgo.plus(3, ChronoUnit.DAYS), fromRequestTime);
        assertEquals(distributedNow.plus(3, ChronoUnit.DAYS), fromDistributionTime);
    }

    @Test
    void aCopyDistributedLateStillGetsTheFullDurationFromDistribution() {
        // Regression for the reported bug: a copy that sat in Ready for Distribution for 10 days
        // under a 3-day policy would already be expired at request-time+3days: it must instead be
        // valid for a fresh 3 days counted from the moment it is actually distributed.
        when(repository.findAllByActiveTrue()).thenReturn(List.of(globalDefault(3, "DAYS")));

        Instant distributedAt = Instant.now().plus(10, ChronoUnit.DAYS);
        Instant recomputedExpiry = service.resolveExpiryFrom(null, null, distributedAt);

        assertEquals(distributedAt.plus(3, ChronoUnit.DAYS), recomputedExpiry);
        assertEquals(true, recomputedExpiry.isAfter(distributedAt));
    }
}
