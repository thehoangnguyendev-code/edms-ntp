package com.eqms.dto.user;

import java.time.Instant;
import java.util.UUID;

/** One row in the SoD Violation Review history list (V505) -- lightweight, no results payload. */
public record SodViolationScanSummaryResponse(
        UUID id,
        Instant scannedAt,
        String scannedByName,
        int violationCount
) {
}
