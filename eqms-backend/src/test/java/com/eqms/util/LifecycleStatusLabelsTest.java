package com.eqms.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * Locks in the label helper's fallback behavior: any status/objectType/action code NOT
 * explicitly listed in its lookup maps must still degrade to a readable title-cased label,
 * never the raw code -- this is what closed the "READY_FOR_DISTRIBUTION"/"DISTRIBUTED" gap
 * that slipped through before the fallback existed.
 */
class LifecycleStatusLabelsTest {

    @Test
    void label_knownCodes() {
        assertEquals("Draft", LifecycleStatusLabels.label("DRAFT"));
        assertEquals("Ready for Publishing", LifecycleStatusLabels.label("READY_FOR_PUBLISHING"));
        assertEquals("Ready for Distribution", LifecycleStatusLabels.label("READY_FOR_DISTRIBUTION"));
        assertEquals("Distributed", LifecycleStatusLabels.label("DISTRIBUTED"));
        assertEquals("Closed / Cancelled", LifecycleStatusLabels.label("CLOSED_CANCELLED"));
    }

    @Test
    void label_unknownCode_fallsBackToTitleCase_neverRawCode() {
        assertEquals("Some Future Status", LifecycleStatusLabels.label("SOME_FUTURE_STATUS"));
    }

    @Test
    void label_nullOrBlank_returnsNull() {
        assertNull(LifecycleStatusLabels.label(null));
        assertNull(LifecycleStatusLabels.label(" "));
    }

    @Test
    void objectTypeLabel_knownAndUnknownCodes() {
        assertEquals("Revision", LifecycleStatusLabels.objectTypeLabel("DOCUMENT_REVISION"));
        assertEquals("Revision", LifecycleStatusLabels.objectTypeLabel("REVISION"));
        assertEquals("Document", LifecycleStatusLabels.objectTypeLabel("DOCUMENT"));
        assertEquals("Controlled Copy", LifecycleStatusLabels.objectTypeLabel("CONTROLLED_COPY"));
        assertEquals("Controlled Copy Batch", LifecycleStatusLabels.objectTypeLabel("CONTROLLED_COPY_BATCH"));
        assertEquals("Some New Object", LifecycleStatusLabels.objectTypeLabel("SOME_NEW_OBJECT"));
    }

    @Test
    void actionLabel_titleCasesActionCodes() {
        assertEquals("Reject Review", LifecycleStatusLabels.actionLabel("REJECT_REVIEW"));
        assertEquals("Print Copy", LifecycleStatusLabels.actionLabel("PRINT_COPY"));
        assertEquals("Distribute Batch", LifecycleStatusLabels.actionLabel("DISTRIBUTE_BATCH"));
    }
}
