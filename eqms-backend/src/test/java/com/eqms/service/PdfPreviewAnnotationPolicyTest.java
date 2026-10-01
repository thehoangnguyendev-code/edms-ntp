package com.eqms.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.jupiter.api.Assertions.*;

class PdfPreviewAnnotationPolicyTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private final SystemConfigurationService service = new SystemConfigurationService(
            null, null, mapper, null, null, null, null, null,
            "http://localhost:9000", "bucket", "key", "secret", "documents", "controlled-copies",
            "templates", "training", "audit", "temp", 5);

    @Test
    void acceptsBothBooleanValuesAndLegacyMissingPolicy() throws Exception {
        for (String json : new String[] {"{}", "{\"pdfPreview\":{\"allowAnnotations\":true}}",
                "{\"pdfPreview\":{\"allowAnnotations\":false}}"}) {
            var documents = mapper.readTree(json);
            assertDoesNotThrow(() -> ReflectionTestUtils.invokeMethod(service, "validateDocumentsConfig", documents));
        }
    }

    @Test
    void rejectsNonBooleanAnnotationPolicy() throws Exception {
        for (String value : new String[] {"\"true\"", "1", "[]", "{}"}) {
            var documents = mapper.readTree("{\"pdfPreview\":{\"allowAnnotations\":" + value + "}}");
            var error = assertThrows(IllegalArgumentException.class,
                    () -> ReflectionTestUtils.invokeMethod(service, "validateDocumentsConfig", documents));
            assertEquals("allowAnnotations must be true or false", error.getMessage());
        }
    }

    @Test
    void annotationChangesTriggerExistingGlobalPreviewInvalidation() throws Exception {
        var before = mapper.readTree("{\"pdfPreview\":{\"allowAnnotations\":false}}");
        var after = mapper.readTree("{\"pdfPreview\":{\"allowAnnotations\":true}}");
        assertTrue(SystemConfigurationService.hasDocumentsPreviewChange(before, after));
        assertTrue(SystemConfigurationService.hasDocumentsPreviewChange(after, before));
        assertFalse(SystemConfigurationService.hasDocumentsPreviewChange(before, before.deepCopy()));
    }
}
