package com.eqms.security;

import java.util.List;

/** Resolve forwarding headers only across an explicit chain of trusted proxies. */
public final class NetworkClientAddress {
    private NetworkClientAddress() {}

    public static String resolve(String remoteAddress, String forwardedFor, List<NetworkCidr> trustedProxies) {
        if (remoteAddress == null || remoteAddress.isBlank()) throw new IllegalArgumentException("Missing remote address");
        validate(remoteAddress);
        if (forwardedFor == null || forwardedFor.isBlank() || !trusted(remoteAddress, trustedProxies)) return remoteAddress;
        String[] chain = forwardedFor.split(",", -1);
        if (chain.length > 20) return remoteAddress;
        for (String item : chain) {
            try { validate(item.trim()); } catch (IllegalArgumentException ex) { return remoteAddress; }
        }
        String current = remoteAddress;
        for (int i = chain.length - 1; i >= 0 && trusted(current, trustedProxies); i--) current = chain[i].trim();
        return current;
    }
    private static boolean trusted(String ip, List<NetworkCidr> proxies) {
        return proxies != null && proxies.stream().anyMatch(cidr -> cidr.contains(ip));
    }
    private static void validate(String ip) {
        // A full-width CIDR exercises strict literal parsing without DNS resolution.
        NetworkCidr.parse(ip + (ip.indexOf(':') >= 0 ? "/128" : "/32"));
    }
}
