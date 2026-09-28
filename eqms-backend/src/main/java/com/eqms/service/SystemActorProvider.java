package com.eqms.service;

import com.eqms.entity.UserAccount;
import com.eqms.repository.UserAccountRepository;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * Single, project-wide source of the reserved SYSTEM actor (see migration V413). Every automated
 * or background action -- scheduled jobs, async reconciliation, background failure-recovery --
 * must attribute its audit trail entry (and any domain "acted-by" FK) to this account instead of
 * a real human ("admin"). It is a non-login account and carries no permissions, so it can never
 * be a source of authorization.
 */
@Service
public class SystemActorProvider {

    /** Fixed, reserved id inserted by V413 -- recognisable in raw data and stable across environments. */
    public static final UUID SYSTEM_ACTOR_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    private final UserAccountRepository userAccountRepository;
    private volatile UserAccount cached;

    public SystemActorProvider(UserAccountRepository userAccountRepository) {
        this.userAccountRepository = userAccountRepository;
    }

    /**
     * The reserved SYSTEM {@link UserAccount}. Never null: if the row is missing the deployment is
     * mis-migrated and an automated action must fail loudly rather than write an actor-less (or
     * human-attributed) audit entry.
     */
    public UserAccount get() {
        UserAccount local = cached;
        if (local != null) {
            return local;
        }
        local = userAccountRepository.findById(SYSTEM_ACTOR_ID)
                .orElseThrow(() -> new IllegalStateException(
                        "Reserved SYSTEM actor account (" + SYSTEM_ACTOR_ID + ", migration V413) is missing"));
        cached = local;
        return local;
    }
}
