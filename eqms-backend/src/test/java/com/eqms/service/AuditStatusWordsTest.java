package com.eqms.service;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

/** STATUS-CONSISTENCY-2026-11-14: the old words of an Uncontrolled Copy are shown as the three statuses of the system; nothing else is touched. */
class AuditStatusWordsTest {
    @Test
    void theOldWordsOfAnUncontrolledCopyAreShownAsTheStatusesOfTheSystem() {
        for (String old : new String[]{"Requested", "Approved", "Generated", "REQUESTED"}) assertEquals("Ready for Distribution", AuditStatusWords.display("Uncontrolled Copy", old));
        for (String old : new String[]{"Rejected", "Cancelled", "Expired", "EXPIRED"}) assertEquals("Closed - Cancelled", AuditStatusWords.display("UNCONTROLLED_COPY", old));
        assertEquals("Distributed", AuditStatusWords.display("Uncontrolled Copy", "Distributed"));
        assertEquals("Ready for Distribution", AuditStatusWords.display("UncontrolledCopyRecord", "Ready for Distribution"));
    }

    @Test
    void otherRecordsAndEmptyValuesAreNotChanged() {
        assertEquals("Approved", AuditStatusWords.display("Report Template", "Approved"));
        assertEquals("Expired", AuditStatusWords.display("Controlled Copy", "Expired"));
        assertNull(AuditStatusWords.display("Uncontrolled Copy", null));
        assertEquals("Requested", AuditStatusWords.display(null, "Requested"));
    }
}
