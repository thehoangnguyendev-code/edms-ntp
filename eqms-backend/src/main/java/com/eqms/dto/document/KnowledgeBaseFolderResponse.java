package com.eqms.dto.document;

import java.util.List;

public record KnowledgeBaseFolderResponse(
        String departmentId,
        String departmentCode,
        String departmentName,
        int documentCount,
        List<KnowledgeBaseDocumentResponse> documents
) {
}
