package com.eqms.util;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SourceChecksumTest {
    private static final byte[] CONTENT = "abc".getBytes(StandardCharsets.UTF_8);
    private static final String SHA256 = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
    private static final String MD5 = "900150983cd24fb0d6963f7d28e17f72";

    @Test
    void sha256RecordsAreCompared() {
        assertTrue(SourceChecksum.matches(SHA256, CONTENT));
        assertTrue(SourceChecksum.matches(SHA256.toUpperCase(), CONTENT));
        assertFalse(SourceChecksum.matches(SHA256, "abd".getBytes(StandardCharsets.UTF_8)));
    }

    @Test
    void olderMd5RecordsAreComparedAsMd5() {
        assertTrue(SourceChecksum.matches(MD5, CONTENT));
        assertFalse(SourceChecksum.matches(MD5, "abd".getBytes(StandardCharsets.UTF_8)));
    }

    @Test
    void nothingRecordedPassesAndAnUnknownShapeDoesNot() {
        assertTrue(SourceChecksum.matches(null, CONTENT));
        assertTrue(SourceChecksum.matches(" ", CONTENT));
        assertFalse(SourceChecksum.matches("abc123", CONTENT));
    }
}
