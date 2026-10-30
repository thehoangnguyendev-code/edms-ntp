package com.eqms.security;

import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

class NetworkClientAddressTest {
    private final List<NetworkCidr> trusted = List.of(NetworkCidr.parse("10.0.0.0/8"));
    @Test void ignoresHeadersFromUntrustedPeers() {
        assertEquals("192.0.2.10", NetworkClientAddress.resolve("192.0.2.10", "10.0.0.4", trusted));
    }
    @Test void walksOnlyTheTrustedChainFromTheRight() {
        assertEquals("192.0.2.10", NetworkClientAddress.resolve("10.0.0.2", "203.0.113.1, 192.0.2.10, 10.0.0.3", trusted));
        assertEquals("10.0.0.2", NetworkClientAddress.resolve("10.0.0.2", "invalid,10.0.0.3", trusted));
    }
}
