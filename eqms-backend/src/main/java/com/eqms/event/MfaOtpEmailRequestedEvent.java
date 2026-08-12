package com.eqms.event;

import java.util.Map;

/**
 * Queues the delivery of a login OTP once its challenge has been committed.
 */
public record MfaOtpEmailRequestedEvent(String recipientEmail, Map<String, String> variables) {
}
