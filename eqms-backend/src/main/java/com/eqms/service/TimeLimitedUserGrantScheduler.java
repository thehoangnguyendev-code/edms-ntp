package com.eqms.service;

import com.eqms.entity.TimeLimitedUserGrant;
import com.eqms.entity.UserAccount;
import com.eqms.repository.TimeLimitedUserGrantRepository;
import com.eqms.repository.UserAccountRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.util.List;
import java.util.UUID;

/**
 * Nightly enforcement pass for "Time-Limited User" grants -- mirrors
 * {@link ControlledCopyExpiryScheduler}'s pattern: a distributed lock so only one app instance
 * runs the job, IDs read in one read-only transaction, then each grant processed in its own
 * transaction so one bad row can't roll back the whole night's batch.
 */
@Service
public class TimeLimitedUserGrantScheduler {

    private static final Logger log = LoggerFactory.getLogger(TimeLimitedUserGrantScheduler.class);

    private final TimeLimitedUserGrantRepository grantRepository;
    private final UserAccountRepository userRepository;
    private final TimeLimitedUserGrantService grantService;
    private final DistributedSchedulerLockService schedulerLockService;

    public TimeLimitedUserGrantScheduler(
            TimeLimitedUserGrantRepository grantRepository,
            UserAccountRepository userRepository,
            TimeLimitedUserGrantService grantService,
            DistributedSchedulerLockService schedulerLockService
    ) {
        this.grantRepository = grantRepository;
        this.userRepository = userRepository;
        this.grantService = grantService;
        this.schedulerLockService = schedulerLockService;
    }

    /** Runs every 15 minutes (dates only, but a near-immediate effect at the exact start/end date
     *  boundary is preferable to a once-a-day-only sweep for an account-access control). */
    @Scheduled(cron = "0 */15 * * * *")
    public void runEnforcementPass() {
        try (var lease = schedulerLockService.tryAcquire("time-limited-user-grant", Duration.ofMinutes(10))) {
            if (!lease.acquired()) {
                log.debug("Time-limited user grant enforcement pass skipped -- lease not acquired.");
                return;
            }
            processActiveGrants();
        }
    }

    private void processActiveGrants() {
        for (UUID grantId : listActiveGrantIds()) {
            try {
                processOneGrant(grantId);
            } catch (Exception ex) {
                log.error("Failed to process time-limited user grant {}: {}", grantId, ex.getMessage(), ex);
            }
        }
    }

    @Transactional(readOnly = true)
    protected List<UUID> listActiveGrantIds() {
        return grantRepository.findByStatus(TimeLimitedUserGrant.STATUS_ACTIVE).stream()
                .map(TimeLimitedUserGrant::getId)
                .toList();
    }

    @Transactional
    protected void processOneGrant(UUID grantId) {
        TimeLimitedUserGrant grant = grantRepository.findById(grantId).orElse(null);
        if (grant == null || !TimeLimitedUserGrant.STATUS_ACTIVE.equals(grant.getStatus())) {
            return;
        }
        UserAccount user = userRepository.findById(grant.getUser().getId()).orElse(null);
        if (user == null) {
            return;
        }
        grantService.applyWindowState(grant, user);
    }
}
