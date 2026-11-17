package com.eqms.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import java.util.List;
import org.junit.jupiter.api.Test;

/** AUDIT-DETAIL-2026-11-17: a reason a person typed becomes one change of the entry, so the detail screen shows it next to a status change. */
class AuditChangesTest {
    @Test
    void aSideThatWasNotThereIsNull() {
        AuditTrailChangeResponse change = AuditChanges.of("Reason", null, 7);
        assertEquals("Reason", change.field());
        assertEquals(null, change.oldValue());
        assertEquals("7", change.newValue());
    }

    @Test
    void aBlankReasonMakesNoChange() {
        assertTrue(AuditChanges.reason("Reason", null).isEmpty());
        assertTrue(AuditChanges.reason("Reason", "   ").isEmpty());
        assertEquals("Because", AuditChanges.reason("Reason", "  Because ").get(0).newValue());
    }

    @Test
    void theReasonFollowsTheOtherChanges() {
        List<AuditTrailChangeResponse> list = AuditChanges.with("Reason", "Because", AuditChanges.of("Code", null, "A"));
        assertEquals(List.of("Code", "Reason"), list.stream().map(AuditTrailChangeResponse::field).toList());
        assertEquals(1, AuditChanges.with("Reason", " ", AuditChanges.of("Code", null, "A")).size());
    }
}
