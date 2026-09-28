package com.eqms.service;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

class NotificationServiceRenderTemplateTest {

    @Test
    void rendersSingleBraceAndDoubleBracePlaceholders() {
        Map<String, String> vars = Map.of("documentNumber", "SOP.0007", "documentTitle", "Cleaning");

        assertEquals("Revision Ready for Your Review: SOP.0007",
                NotificationService.renderTemplate("Revision Ready for Your Review: {documentNumber}", vars));
        assertEquals("SOP.0007 - Cleaning",
                NotificationService.renderTemplate("{{documentNumber}} - {{documentTitle}}", vars));
    }

    @Test
    void leavesUnknownPlaceholdersUntouchedAndToleratesNullValues() {
        java.util.HashMap<String, String> vars = new java.util.HashMap<>();
        vars.put("documentNumber", null);

        assertEquals("[] {other}", NotificationService.renderTemplate("[{documentNumber}] {other}", vars));
    }
}
