package com.eqms.event;

import java.util.Map;

/**
 * Queues a template email for delivery after the enclosing transaction commits, off the
 * request thread — used for latency-sensitive auth emails (password reset links, MFA setup
 * verification codes) that would otherwise block the HTTP response on the SMTP round trip.
 */
public record AsyncEmailRequestedEvent(String recipientEmail, String subject, Map<String, String> variables) {
}
