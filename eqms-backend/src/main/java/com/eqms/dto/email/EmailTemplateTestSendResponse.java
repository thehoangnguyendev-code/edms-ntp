package com.eqms.dto.email;

import java.time.Instant;
import java.util.UUID;

public record EmailTemplateTestSendResponse(
        boolean success,
        String message,
        UUID templateId,
        String templateName,
        String sentTo,
        Instant sentAt
) {
}
