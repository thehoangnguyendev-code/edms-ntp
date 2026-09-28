package com.eqms.dto.audittrail;

import java.util.List;

public record AuditTrailUserResponse(
        String id,
        String fullName,
        String employeeCode,
        String role,
        String position,
        String department,
        String avatar,
        /** Point-in-time Access Profile snapshot as of this event -- see AuditLog#accessProfileNames.
         *  Empty (not null) when no snapshot was captured (rows predating this field, or the actor
         *  held no Access Profile at the time). */
        List<String> accessProfileNames
) {
}
