package com.eqms.util;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Content-based DOCX detection shared by the publishing-template render/inspection services.
 * A DOCX is an OOXML ZIP archive, so a genuine one always starts with the ZIP local-file-header
 * signature (PK\3\4) regardless of what its stored file name says. Checking the file name suffix
 * alone (as each of these services used to do independently) silently disables rendering whenever
 * the stored name lacks ".docx" -- e.g. from a data import, migration, or manual correction -- with
 * no error surfaced anywhere.
 */
public final class DocxSignature {

    private static final byte[] ZIP_LOCAL_FILE_HEADER = {0x50, 0x4B, 0x03, 0x04};

    private DocxSignature() {
    }

    public static boolean isDocx(Path path) {
        if (path == null || !Files.isRegularFile(path)) {
            return false;
        }
        byte[] header = new byte[ZIP_LOCAL_FILE_HEADER.length];
        try (InputStream input = Files.newInputStream(path)) {
            int read = input.readNBytes(header, 0, header.length);
            if (read < header.length) {
                return false;
            }
        } catch (IOException ex) {
            return false;
        }
        for (int i = 0; i < ZIP_LOCAL_FILE_HEADER.length; i++) {
            if (header[i] != ZIP_LOCAL_FILE_HEADER[i]) {
                return false;
            }
        }
        return true;
    }
}
