package com.eqms.exception;

import java.util.UUID;

/**
 * Thrown when a Controlled Copy token is valid but the copy is no longer available
 * (recalled, destroyed, or expired). Maps to HTTP 410 CONTROLLED_COPY_NOT_AVAILABLE.
 *
 * The message spells out the actual reason (Recalled/Lost/Damaged/Destroyed/Expired/Cancelled)
 * instead of a generic "no longer available" -- statusCode/obsoleteReason used to be captured on
 * this exception but never actually reached the client (GlobalExceptionHandler only forwarded
 * getMessage()), so every recipient saw the exact same unexplained message regardless of what
 * actually happened to their copy.
 */
public class ControlledCopyNotAvailableException extends RuntimeException {

    private final UUID controlledCopyId;
    private final String statusCode;
    private final String obsoleteReason;

    public ControlledCopyNotAvailableException(UUID controlledCopyId, String statusCode, String obsoleteReason) {
        super(buildMessage(statusCode, obsoleteReason));
        this.controlledCopyId = controlledCopyId;
        this.statusCode = statusCode;
        this.obsoleteReason = obsoleteReason;
    }

    private static String buildMessage(String statusCode, String obsoleteReason) {
        String reason = obsoleteReason == null ? "" : obsoleteReason.trim().toUpperCase(java.util.Locale.ROOT);
        String status = statusCode == null ? "" : statusCode.trim().toUpperCase(java.util.Locale.ROOT);
        return switch (reason) {
            case "EXPIRED" -> "This controlled copy is no longer available: its expiry date has passed.";
            case "RECALLED" -> "This controlled copy is no longer available: it was recalled.";
            case "NEW_REVISION_PUBLISHED" -> "This controlled copy is no longer available: it was replaced by a newer revision. Use the current version of the document.";
            case "REVISION_OBSOLETED" -> "This controlled copy is no longer available: the revision was made obsolete.";
            case "DOCUMENT_OBSOLETED" -> "This controlled copy is no longer available: the document was made obsolete.";
            case "LOST" -> "This controlled copy is no longer available: it was reported Lost.";
            case "DAMAGED" -> "This controlled copy is no longer available: it was reported Damaged.";
            case "DESTROYED" -> "This controlled copy is no longer available: it was destroyed at end of life.";
            default -> "CLOSED_CANCELLED".equals(status)
                    ? "This controlled copy is no longer available: the request was cancelled."
                    : "This controlled copy is no longer available.";
        };
    }

    public UUID getControlledCopyId() { return controlledCopyId; }
    public String getStatusCode() { return statusCode; }
    public String getObsoleteReason() { return obsoleteReason; }
}
