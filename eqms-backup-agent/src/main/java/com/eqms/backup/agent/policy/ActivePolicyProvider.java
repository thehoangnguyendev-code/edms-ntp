package com.eqms.backup.agent.policy;

import java.util.Optional;

/** The seam between a running backup and the policy store, so a backup can be tested without one. */
public interface ActivePolicyProvider {

    Optional<PolicyView> active();
}
