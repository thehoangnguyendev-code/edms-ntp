package com.eqms.dto.document;

public record ControlledCopyPreviewCloseRequest(
        String token,
        Long timeSpentMs
) {
}
