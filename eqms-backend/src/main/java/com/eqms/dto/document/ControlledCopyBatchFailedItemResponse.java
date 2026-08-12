package com.eqms.dto.document;

public record ControlledCopyBatchFailedItemResponse(
        String controlledCopyId,
        String controlledCopyNumber,
        String recipientName,
        String lastErrorMessage
) {
}
