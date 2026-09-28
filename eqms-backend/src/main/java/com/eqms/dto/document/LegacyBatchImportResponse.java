package com.eqms.dto.document;

import java.util.List;
import java.util.UUID;

/** Result of a Legacy Batch Import: every revision created, oldest first, last one Effective. */
public record LegacyBatchImportResponse(
        UUID documentId,
        List<RevisionDetailResponse> revisions
) {
}
