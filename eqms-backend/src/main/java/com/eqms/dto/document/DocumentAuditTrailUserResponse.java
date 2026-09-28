package com.eqms.dto.document;

import java.util.List;

public record DocumentAuditTrailUserResponse(
        String id,
        String fullName,
        String employeeCode,
        String role,
        String position,
        String department,
        /** Point-in-time Access Profile snapshot as of this event -- see AuditLog#accessProfileNames.
         *  Empty (not null) when no snapshot was captured. */
        List<String> accessProfileNames
) {
}
