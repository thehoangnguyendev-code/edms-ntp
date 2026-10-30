package com.eqms.security;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class NetworkCidrTest {
    @Test void matchesIpv4AndIpv6NetworksAndBoundaries() {
        var ipv4 = NetworkCidr.parse("192.168.7.123/24");
        assertTrue(ipv4.contains("192.168.7.0"));
        assertTrue(ipv4.contains("192.168.7.255"));
        assertFalse(ipv4.contains("192.168.8.1"));
        assertTrue(NetworkCidr.parse("2001:db8::/32").contains("2001:db8:abcd::1"));
        assertFalse(NetworkCidr.parse("2001:db8::/32").contains("2001:db9::1"));
        assertFalse(ipv4.contains("2001:db8::1"));
        assertTrue(NetworkCidr.parse("0.0.0.0/0").contains("8.8.8.8"));
    }
    @Test void rejectsAmbiguousOrNonLiteralValues() {
        for (String value : new String[]{"localhost/24", "192.168.01.1/24", "1.2.3.4/33", "::1/129", "fe80::1%eth0/64", "1.2.3.4", "1.2.3.4/-1"}) {
            assertThrows(IllegalArgumentException.class, () -> NetworkCidr.parse(value), value);
        }
    }
}
