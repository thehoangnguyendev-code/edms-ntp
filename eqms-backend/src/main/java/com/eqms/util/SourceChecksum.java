package com.eqms.util;

import org.springframework.util.StringUtils;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

/**
 * Whether a stored revision file is the one recorded for the revision. Records are SHA-256 (64 hexadecimal characters); a few written by an earlier version hold the MD5 of
 * the object (32 characters, the storage ETag), which is compared as MD5 rather than reported as a changed file. A record of any other shape matches nothing.
 */
public final class SourceChecksum {
    private SourceChecksum() {
    }

    /** True when there is nothing recorded to compare with, or the content matches the record. */
    public static boolean matches(String recorded, byte[] content) {
        if (!StringUtils.hasText(recorded)) {
            return true;
        }
        String value = recorded.trim();
        String algorithm = value.length() == 64 ? "SHA-256" : value.length() == 32 ? "MD5" : null;
        if (algorithm == null) {
            return false;
        }
        try {
            return value.equalsIgnoreCase(HexFormat.of().formatHex(MessageDigest.getInstance(algorithm).digest(content)));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }
}
