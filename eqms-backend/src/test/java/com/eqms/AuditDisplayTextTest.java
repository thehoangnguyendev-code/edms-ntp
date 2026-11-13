package com.eqms;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.eqms.util.AuditDisplayText;
import org.junit.jupiter.api.Test;

class AuditDisplayTextTest {
    private static final String ID = "f0fd24a1-45ab-494b-a518-dff5d1b87ca9";

    @Test
    void hidesIdsWithoutTouchingNames() {
        assertEquals("Assigned System Admin Two", AuditDisplayText.hideIds("Assigned System Admin Two (" + ID + ")"));
        assertEquals("Document Name: Baseline Edit Test", AuditDisplayText.hideIds("Document Name: Baseline Edit Test " + ID));
        assertEquals("Author: —", AuditDisplayText.hideIds("Author: " + ID));
        assertEquals("—", AuditDisplayText.hideIds(ID));
        assertEquals("Revision 2.0.0 activated", AuditDisplayText.hideIds("Revision 2.0.0 activated"));
        assertEquals(null, AuditDisplayText.hideIds(null));
    }
}
