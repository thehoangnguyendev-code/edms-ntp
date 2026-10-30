package com.eqms.security;

import java.util.List;
import java.util.UUID;

/** Pure policy decision. Callers must authenticate and audit denials and emergency use. */
public record AdministrativeNetworkPolicy(boolean enabled, List<NetworkCidr> allowedNetworks,
                                          List<NetworkCidr> trustedProxies, UUID emergencyUserId) {
    public enum Decision { ALLOWED, DENIED, EMERGENCY_BYPASS }

    public AdministrativeNetworkPolicy {
        allowedNetworks = allowedNetworks == null ? List.of() : List.copyOf(allowedNetworks);
        trustedProxies = trustedProxies == null ? List.of() : List.copyOf(trustedProxies);
        if (enabled && (allowedNetworks.isEmpty() || emergencyUserId == null)) {
            throw new IllegalArgumentException("Enabled network policy requires an allowlist and an emergency account");
        }
    }

    public Decision evaluate(boolean administrativeOperation, UUID userId, boolean userActive,
                             String remoteAddress, String forwardedFor) {
        if (!enabled || !administrativeOperation) return Decision.ALLOWED;
        if (userActive && emergencyUserId.equals(userId)) return Decision.EMERGENCY_BYPASS;
        try {
            String client = NetworkClientAddress.resolve(remoteAddress, forwardedFor, trustedProxies);
            return allowedNetworks.stream().anyMatch(network -> network.contains(client)) ? Decision.ALLOWED : Decision.DENIED;
        } catch (IllegalArgumentException ex) {
            return Decision.DENIED;
        }
    }
}
