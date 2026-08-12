package com.eqms.dto.document;

public record KnowledgeBaseDepartmentResponse(
        String departmentId,
        String departmentCode,
        String departmentName,
        int documentCount
) {
}
