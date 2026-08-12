package com.eqms.dto.document;

import java.util.List;
import java.util.UUID;

public record RevisionUpgradeContinueRequest(
        String reasonForChange,
        List<UUID> relatedDocumentIds
) {}
