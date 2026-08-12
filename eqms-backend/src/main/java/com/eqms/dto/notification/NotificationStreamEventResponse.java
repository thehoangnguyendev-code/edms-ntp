package com.eqms.dto.notification;

public record NotificationStreamEventResponse(
        String event,
        String timestamp
) {
}
