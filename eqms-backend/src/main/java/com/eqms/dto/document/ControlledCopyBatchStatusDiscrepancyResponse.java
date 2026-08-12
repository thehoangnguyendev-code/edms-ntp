package com.eqms.dto.document;

import java.time.Instant;
import java.util.UUID;

public record ControlledCopyBatchStatusDiscrepancyResponse(
        UUID id,
        UUID batchId,
        String batchNumber,
        String documentNumber,
        String documentTitle,
        String expectedStatusCode,
        String actualStatusCode,
        Instant detectedAt,
        Instant lastCheckedAt
) {
}
