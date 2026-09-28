package com.eqms.service;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;

/**
 * The "copyNo" placeholder embossed inside the controlled copy's own printed frame must stay a
 * plain 3-digit sequence (e.g. "002") -- the full unique code (e.g. "CC.SOP.0037.002") overflows
 * that fixed-width frame. Every other surface (emails, UI, audit trail) keeps the full code via
 * displayControlledCopyNumber, since only shortControlledCopyNumber's output is ambiguous across
 * documents.
 */
class ControlledCopyShortNumberFormatTest {

    // Mockito bypasses the real constructor entirely, so this doesn't need the service's large
    // dependency graph -- shortControlledCopyNumber/displayControlledCopyNumber are pure string
    // transforms invoked directly via reflection.
    private final ControlledCopyService service = mock(ControlledCopyService.class);

    private String shortNumber(String value) {
        return ReflectionTestUtils.invokeMethod(service, "shortControlledCopyNumber", value);
    }

    @Test
    void extractsTrailingThreeDigitSequence() {
        assertEquals("002", shortNumber("CC.SOP.0037.002"));
    }

    @Test
    void stripsExtMarkerBeforeExtractingSequence() {
        assertEquals("002", shortNumber("CC.SOP.0037.EXT.002"));
    }

    @Test
    void normalizesDashSeparatorsBeforeExtracting() {
        assertEquals("045", shortNumber("CC-SOP-0037-045"));
    }

    @Test
    void fallsBackToFullDisplayValueWhenTrailingSegmentIsNotThreeDigits() {
        assertEquals("CC.SOP.0037", shortNumber("CC.SOP.0037"));
    }

    @Test
    void returnsBlankForBlankInput() {
        assertEquals("", shortNumber(""));
    }
}
