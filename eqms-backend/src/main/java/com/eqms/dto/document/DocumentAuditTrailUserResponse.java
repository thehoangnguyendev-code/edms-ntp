package com.eqms.dto.document;

public record DocumentAuditTrailUserResponse(
        String id,
        String fullName,
        String employeeCode,
        String role,
        String position,
        String department
) {
}
