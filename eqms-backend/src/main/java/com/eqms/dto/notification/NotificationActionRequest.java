package com.eqms.dto.notification;

import java.util.List;
import java.util.UUID;

public record NotificationActionRequest(
        List<UUID> ids
) {
}
