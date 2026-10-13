package com.eqms.service;

import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.HexFormat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** The bytes read through a version alias are returned only when they are the bytes recorded at restore (SDS 11.4.2). */
class MinioObjectAliasVerificationTest {

    private static String sha256(byte[] bytes) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
    }

    @Test
    void theCopyIsReturnedWhenItsSha256IsTheRecordedOne() throws Exception {
        byte[] content = "a controlled document".getBytes();
        Path copy = MinioObjectStorageService.verifiedCopy(new ByteArrayInputStream(content), sha256(content), "docs/a.pdf");
        assertThat(Files.readAllBytes(copy)).isEqualTo(content);
    }

    @Test
    void aCopyWithAnotherSha256IsRefusedAndNotKept() throws Exception {
        byte[] content = "altered".getBytes();
        String recorded = sha256("original".getBytes());
        assertThatThrownBy(() -> MinioObjectStorageService.verifiedCopy(new ByteArrayInputStream(content), recorded, "docs/a.pdf"))
                .isInstanceOf(IOException.class)
                .hasMessageContaining("does not match its recorded SHA-256");
    }

    @Test
    void onlyTheNoSuchVersionAnswerOpensTheAliasTable() {
        assertThat(MinioObjectStorageService.isNoSuchVersion(new IOException("NoSuchVersion"))).isFalse();
        assertThat(MinioObjectStorageService.isNoSuchVersion(new IllegalStateException("boom"))).isFalse();
    }
}
