package com.eqms.security;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.Arrays;

/** A literal IPv4/IPv6 CIDR. Host names and scoped IPv6 addresses are not accepted. */
public final class NetworkCidr {
    private final byte[] network;
    private final int prefixLength;

    private NetworkCidr(byte[] network, int prefixLength) {
        this.network = network;
        this.prefixLength = prefixLength;
    }

    public static NetworkCidr parse(String text) {
        if (text == null || !text.equals(text.trim())) throw new IllegalArgumentException("Invalid network");
        String[] parts = text.split("/", -1);
        if (parts.length != 2 || !parts[1].matches("0|[1-9][0-9]{0,2}")) throw new IllegalArgumentException("Use an IP address and prefix length");
        byte[] address = literal(parts[0]);
        int prefix = Integer.parseInt(parts[1]);
        if (prefix > address.length * 8) throw new IllegalArgumentException("Invalid network prefix");
        byte[] network = Arrays.copyOf(address, address.length);
        for (int bit = prefix; bit < network.length * 8; bit++) network[bit / 8] &= (byte) ~(0x80 >>> (bit % 8));
        return new NetworkCidr(network, prefix);
    }

    public boolean contains(String ip) {
        byte[] address = literal(ip);
        if (address.length != network.length) return false;
        int fullBytes = prefixLength / 8;
        for (int i = 0; i < fullBytes; i++) if (address[i] != network[i]) return false;
        int remaining = prefixLength % 8;
        return remaining == 0 || ((address[fullBytes] ^ network[fullBytes]) & (0xff << (8 - remaining))) == 0;
    }

    private static byte[] literal(String value) {
        if (value == null || value.isEmpty() || value.contains("%")) throw new IllegalArgumentException("Invalid IP address");
        if (value.indexOf(':') < 0) {
            String[] octets = value.split("\\.", -1);
            if (octets.length != 4) throw new IllegalArgumentException("Invalid IPv4 address");
            byte[] bytes = new byte[4];
            for (int i = 0; i < 4; i++) {
                if (!octets[i].matches("0|[1-9][0-9]{0,2}")) throw new IllegalArgumentException("Invalid IPv4 address");
                int n = Integer.parseInt(octets[i]);
                if (n > 255) throw new IllegalArgumentException("Invalid IPv4 address");
                bytes[i] = (byte) n;
            }
            return bytes;
        }
        if (!value.matches("[0-9a-fA-F:.]+")) throw new IllegalArgumentException("Invalid IPv6 address");
        try {
            byte[] bytes = InetAddress.getByName(value).getAddress();
            if (bytes.length != 16) throw new IllegalArgumentException("IPv4-mapped addresses must be configured as IPv4");
            return bytes;
        } catch (UnknownHostException ex) {
            throw new IllegalArgumentException("Invalid IPv6 address", ex);
        }
    }
}
