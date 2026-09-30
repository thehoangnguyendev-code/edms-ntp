package com.eqms.dto.user;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Full detail of one historical SoD violation scan run (V505), including its results snapshot. */
public record SodViolationScanDetailResponse(
        UUID id,
        Instant scannedAt,
        String scannedByName,
        int violationCount,
        List<SodViolationResponse> results
) {
}
