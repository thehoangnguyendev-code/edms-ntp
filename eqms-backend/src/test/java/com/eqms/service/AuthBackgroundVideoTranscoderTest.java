package com.eqms.service;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertEquals;

class AuthBackgroundVideoTranscoderTest {
    private final AuthBackgroundVideoTranscoder transcoder = new AuthBackgroundVideoTranscoder();

    @Test void rejectsEmptyAndNonVideoInput() {
        assertThrows(IllegalArgumentException.class, () -> transcoder.transcode(new MockMultipartFile("video", new byte[0])));
        assertThrows(IllegalArgumentException.class, () -> transcoder.transcode(new MockMultipartFile("video", "example.mp4", "video/mp4", "not a video".getBytes())));
    }

    @Test void detectsOnlySupportedContainerSignatures() {
        assertEquals("mov", AuthBackgroundVideoTranscoder.detectFormat(new byte[]{0, 0, 0, 24, 'f', 't', 'y', 'p', 'i', 's', 'o', 'm'}));
        assertEquals("matroska", AuthBackgroundVideoTranscoder.detectFormat(new byte[]{0x1a, 0x45, (byte) 0xdf, (byte) 0xa3, 0, 0, 0, 0, 0, 0, 0, 0}));
        assertEquals("avi", AuthBackgroundVideoTranscoder.detectFormat(new byte[]{'R', 'I', 'F', 'F', 0, 0, 0, 0, 'A', 'V', 'I', ' '}));
        assertEquals("flv", AuthBackgroundVideoTranscoder.detectFormat(new byte[]{'F', 'L', 'V', 1, 0, 0, 0, 0, 9, 0, 0, 0}));
        assertEquals("ogg", AuthBackgroundVideoTranscoder.detectFormat(new byte[]{'O', 'g', 'g', 'S', 0, 2, 0, 0, 0, 0, 0, 0}));
        assertEquals("asf", AuthBackgroundVideoTranscoder.detectFormat(new byte[]{0x30, 0x26, (byte) 0xb2, 0x75, (byte) 0x8e, 0x66, (byte) 0xcf, 0x11, 0, 0, 0, 0}));
        assertEquals("mpeg", AuthBackgroundVideoTranscoder.detectFormat(new byte[]{0, 0, 1, (byte) 0xba, 0x44, 0, 0, 0, 0, 0, 0, 0}));
        assertEquals("mpegts", AuthBackgroundVideoTranscoder.detectFormat(new byte[]{0x47, 0x40, 0, 0x10, 0, 0, 0, 0, 0, 0, 0, 0}));
        assertThrows(IllegalArgumentException.class, () -> AuthBackgroundVideoTranscoder.detectFormat(new byte[]{'R', 'I', 'F', 'F', 0, 0, 0, 0, 'W', 'A', 'V', 'E'}));
    }
}
