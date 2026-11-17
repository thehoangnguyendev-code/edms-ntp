package com.eqms.util;

import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import java.util.ArrayList;
import java.util.List;

/**
 * Small builders of the field changes an Audit Trail entry carries (AUDIT-DETAIL-2026-11-17). A detail screen shows the change list; the system's own
 * description is shown only when there is none, so a reason or a note the person typed has to be one of the changes to be seen next to a status change.
 */
public final class AuditChanges {
    private AuditChanges() {
    }

    /** One change; a null side is a value that was not there. */
    public static AuditTrailChangeResponse of(String field, Object before, Object after) {
        return new AuditTrailChangeResponse(field, before == null ? null : String.valueOf(before), after == null ? null : String.valueOf(after));
    }

    /** The reason or note a person wrote, as one change; nothing when it is blank. */
    public static List<AuditTrailChangeResponse> reason(String field, String text) {
        return text == null || text.isBlank() ? List.of() : List.of(of(field, null, text.trim()));
    }

    /** The given changes plus a reason or note when there is one. */
    public static List<AuditTrailChangeResponse> with(String reasonField, String text, AuditTrailChangeResponse... changes) {
        List<AuditTrailChangeResponse> list = new ArrayList<>(List.of(changes));
        list.addAll(reason(reasonField, text));
        return list;
    }
}
