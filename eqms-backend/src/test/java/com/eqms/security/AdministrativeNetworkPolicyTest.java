package com.eqms.security;

import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

class AdministrativeNetworkPolicyTest {
    private final UUID emergency = UUID.randomUUID();
    private final AdministrativeNetworkPolicy policy = new AdministrativeNetworkPolicy(true,
            List.of(NetworkCidr.parse("192.168.1.0/24")), List.of(NetworkCidr.parse("10.0.0.0/8")), emergency);

    @Test void rejectsUnsafeEnabledPolicy() {
        assertThrows(IllegalArgumentException.class, () -> new AdministrativeNetworkPolicy(true, List.of(), List.of(), emergency));
        assertThrows(IllegalArgumentException.class, () -> new AdministrativeNetworkPolicy(true, List.of(NetworkCidr.parse("10.0.0.0/8")), List.of(), null));
    }
    @Test void enforcesOnlyAdministrativeOperationsAndTrustsOnlyConfiguredProxies() {
        assertEquals(AdministrativeNetworkPolicy.Decision.ALLOWED, policy.evaluate(false, UUID.randomUUID(), true, "203.0.113.1", null));
        assertEquals(AdministrativeNetworkPolicy.Decision.DENIED, policy.evaluate(true, UUID.randomUUID(), true, "203.0.113.1", "192.168.1.1"));
        assertEquals(AdministrativeNetworkPolicy.Decision.ALLOWED, policy.evaluate(true, UUID.randomUUID(), true, "10.0.0.1", "192.168.1.2"));
        assertEquals(AdministrativeNetworkPolicy.Decision.DENIED, policy.evaluate(true, UUID.randomUUID(), true, "10.0.0.1", "203.0.113.1"));
    }
    @Test void emergencyExemptionRequiresTheDesignatedActiveAccount() {
        assertEquals(AdministrativeNetworkPolicy.Decision.EMERGENCY_BYPASS, policy.evaluate(true, emergency, true, "203.0.113.1", null));
        assertEquals(AdministrativeNetworkPolicy.Decision.DENIED, policy.evaluate(true, emergency, false, "203.0.113.1", null));
        assertEquals(AdministrativeNetworkPolicy.Decision.DENIED, policy.evaluate(true, UUID.randomUUID(), true, "203.0.113.1", null));
    }
}
