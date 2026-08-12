package com.eqms.dto.notification;

import java.util.UUID;

public record NotificationRelatedItemResponse(
        UUID id,
        String type,
        String documentNumber,
        String title
) {
}
