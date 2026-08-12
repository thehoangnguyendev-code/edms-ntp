package com.eqms.exception;

import java.util.UUID;

/**
 * Thrown when a Controlled Copy token is valid but the copy is no longer available
 * (recalled, destroyed, or expired). Maps to HTTP 410 CONTROLLED_COPY_NOT_AVAILABLE.
 */
public class ControlledCopyNotAvailableException extends RuntimeException {

    private final UUID controlledCopyId;
    private final String statusCode;
    private final String obsoleteReason;

    public ControlledCopyNotAvailableException(UUID controlledCopyId, String statusCode, String obsoleteReason) {
        super("This controlled copy is no longer available.");
        this.controlledCopyId = controlledCopyId;
        this.statusCode = statusCode;
        this.obsoleteReason = obsoleteReason;
    }

    public UUID getControlledCopyId() { return controlledCopyId; }
    public String getStatusCode() { return statusCode; }
    public String getObsoleteReason() { return obsoleteReason; }
}
