package com.eqms.dto.notification;

public record ControlledCopyBatchProgressEventResponse(
        String event,
        String timestamp,
        String batchId,
        int processed,
        int total,
        int failed,
        String status
) {
}
