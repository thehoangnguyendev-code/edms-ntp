package com.eqms.dto.controlledcopyrecall;

import java.time.Instant;

/** The controlled copy a scan was matched to, as shown on the review screen. */
public record RecallItemCopyResponse(
        String id,
        String number,
        String documentNumber,
        String documentTitle,
        String revisionNumber,
        String recipientName,
        String status,
        Instant distributedAt,
        Instant recalledAt
) {
}
