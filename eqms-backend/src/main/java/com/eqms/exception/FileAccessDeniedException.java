package com.eqms.exception;

import com.eqms.enums.FileAccessAction;
import com.eqms.enums.FileObjectType;

import java.util.UUID;

/**
 * Thrown by SecureFileAccessService when a file access request is denied.
 * Maps to HTTP 403 FILE_ACCESS_DENIED in GlobalExceptionHandler.
 */
public class FileAccessDeniedException extends RuntimeException {

    private final String reasonCode;
    private final String permissionCode;
    private final FileAccessAction action;
    private final FileObjectType objectType;
    private final UUID objectId;

    public FileAccessDeniedException(
            String reasonCode,
            String message,
            String permissionCode,
            FileAccessAction action,
            FileObjectType objectType,
            UUID objectId
    ) {
        super(message);
        this.reasonCode = reasonCode;
        this.permissionCode = permissionCode;
        this.action = action;
        this.objectType = objectType;
        this.objectId = objectId;
    }

    public FileAccessDeniedException(String reasonCode, String message) {
        this(reasonCode, message, null, null, null, null);
    }

    public String getReasonCode() { return reasonCode; }
    public String getPermissionCode() { return permissionCode; }
    public FileAccessAction getAction() { return action; }
    public FileObjectType getObjectType() { return objectType; }
    public UUID getObjectId() { return objectId; }
}
