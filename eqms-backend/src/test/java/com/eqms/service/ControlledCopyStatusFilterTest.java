package com.eqms.service;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

/** STATUS-CONTRACT-2026-11-14: a client asks for a Controlled Copy status by its code, never by the words shown for it. */
class ControlledCopyStatusFilterTest {
    @Test
    void theFourCodesAreAcceptedInAnyCase() {
        assertEquals("READY_FOR_DISTRIBUTION", ControlledCopyService.requireControlledCopyStatusCode("READY_FOR_DISTRIBUTION"));
        assertEquals("DISTRIBUTED", ControlledCopyService.requireControlledCopyStatusCode(" distributed "));
        assertEquals("OBSOLETED", ControlledCopyService.requireControlledCopyStatusCode("OBSOLETED"));
        assertEquals("CLOSED_CANCELLED", ControlledCopyService.requireControlledCopyStatusCode("closed_cancelled"));
    }

    @Test
    void theWordsForPeopleAndTheOldOutcomesAreRefused() {
        for (String words : new String[]{"Ready for Distribution", "Closed - Cancelled", "Distributed copies", "RECALLED", "LOST", "DAMAGED", "DESTROYED", "OBSOLETE", "", "  ", "x' or 1=1 --"}) {
            var refused = assertThrows(IllegalArgumentException.class, () -> ControlledCopyService.requireControlledCopyStatusCode(words), words);
            assertEquals("CONTROLLED_COPY_STATUS_INVALID", refused.getMessage());
        }
        assertThrows(IllegalArgumentException.class, () -> ControlledCopyService.requireControlledCopyStatusCode(null));
    }
}
