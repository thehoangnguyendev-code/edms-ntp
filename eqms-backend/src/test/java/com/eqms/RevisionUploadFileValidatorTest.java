package com.eqms;

import com.eqms.exception.RevisionUploadValidationException;
import com.eqms.service.ClamAvScanService;
import com.eqms.service.RevisionUploadFileValidator;
import com.eqms.service.SystemConfigurationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RevisionUploadFileValidatorTest {

    @Mock
    private SystemConfigurationService systemConfigurationService;

    @Mock
    private ClamAvScanService clamAvScanService;

    private RevisionUploadFileValidator validator;

    @BeforeEach
    void setUp() {
        when(systemConfigurationService.getDocumentMaxFileSizeMb()).thenReturn(25);
        validator = new RevisionUploadFileValidator(systemConfigurationService, clamAvScanService);
    }

    @Test
    void acceptsStructurallyValidDocxAndIgnoresClientDeclaredMimeType() throws IOException {
        when(clamAvScanService.isEnabled()).thenReturn(false);
        when(clamAvScanService.scan(org.mockito.ArgumentMatchers.any(byte[].class)))
                .thenReturn(ClamAvScanService.ScanResult.ofClean());
        MockMultipartFile file = new MockMultipartFile(
                "file", "revision.docx", "text/plain", minimalDocx()
        );

        RevisionUploadFileValidator.ValidatedRevisionFile result = validator.validate(file);

        assertEquals(RevisionUploadFileValidator.DOCX_MIME_TYPE, result.detectedContentType());
        assertTrue(result.sha256().matches("[0-9a-f]{64}"));
    }

    @Test
    void rejectsNonDocxExtensionBeforeTrustingContent() {
        MockMultipartFile file = new MockMultipartFile("file", "revision.pdf", "application/pdf", minimalZipBytes());

        RevisionUploadValidationException exception = assertThrows(
                RevisionUploadValidationException.class,
                () -> validator.validate(file)
        );

        assertEquals("UNSUPPORTED_REVISION_FILE_TYPE", exception.getCode());
    }

    @Test
    void rejectsRenamedNonZipFile() {
        MockMultipartFile file = new MockMultipartFile("file", "revision.docx", "application/octet-stream", "not a docx".getBytes());

        RevisionUploadValidationException exception = assertThrows(
                RevisionUploadValidationException.class,
                () -> validator.validate(file)
        );

        assertEquals("INVALID_DOCX_SIGNATURE", exception.getCode());
    }

    @Test
    void rejectsMalwareAfterDocxStructureIsValidated() throws IOException {
        when(clamAvScanService.isEnabled()).thenReturn(true);
        when(clamAvScanService.scan(org.mockito.ArgumentMatchers.any(byte[].class)))
                .thenReturn(ClamAvScanService.ScanResult.ofInfected("Eicar-Test-Signature"));
        MockMultipartFile file = new MockMultipartFile("file", "revision.docx", "application/octet-stream", minimalDocx());

        RevisionUploadValidationException exception = assertThrows(
                RevisionUploadValidationException.class,
                () -> validator.validate(file)
        );

        assertEquals("MALWARE_DETECTED", exception.getCode());
    }

    @Test
    void rejectsMacroPayloadRenamedAsDocx() throws IOException {
        MockMultipartFile file = new MockMultipartFile(
                "file", "renamed.docx", "application/octet-stream", docxWithMacroPayload()
        );

        RevisionUploadValidationException exception = assertThrows(
                RevisionUploadValidationException.class,
                () -> validator.validate(file)
        );

        assertEquals("UNSAFE_DOCX_CONTENT", exception.getCode());
    }

    private byte[] minimalDocx() throws IOException {
        try (ByteArrayOutputStream output = new ByteArrayOutputStream();
             ZipOutputStream zip = new ZipOutputStream(output)) {
            writeEntry(zip, "[Content_Types].xml", """
                    <Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">
                      <Override PartName=\"/word/document.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/>
                    </Types>
                    """);
            writeEntry(zip, "word/document.xml", "<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"/>");
            zip.finish();
            return output.toByteArray();
        }
    }

    private byte[] docxWithMacroPayload() throws IOException {
        try (ByteArrayOutputStream output = new ByteArrayOutputStream();
             ZipOutputStream zip = new ZipOutputStream(output)) {
            writeEntry(zip, "[Content_Types].xml", """
                    <Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">
                      <Override PartName=\"/word/document.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/>
                    </Types>
                    """);
            writeEntry(zip, "word/document.xml", "<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"/>");
            writeEntry(zip, "word/vbaProject.bin", "macro-payload");
            zip.finish();
            return output.toByteArray();
        }
    }

    private byte[] minimalZipBytes() {
        try {
            return minimalDocx();
        } catch (IOException exception) {
            throw new AssertionError(exception);
        }
    }

    private void writeEntry(ZipOutputStream zip, String name, String content) throws IOException {
        zip.putNextEntry(new ZipEntry(name));
        zip.write(content.getBytes());
        zip.closeEntry();
    }
}
