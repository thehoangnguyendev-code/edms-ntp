package com.eqms.dto.audittrail;

public record AuditTrailUserResponse(
        String id,
        String fullName,
        String employeeCode,
        String role,
        String position,
        String department,
        String avatar
) {
}
