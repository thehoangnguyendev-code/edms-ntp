package com.eqms.dto.document;

import java.util.List;

public record KnowledgeBaseResponse(
        int totalDocuments,
        List<KnowledgeBaseFolderResponse> folders
) {
}
