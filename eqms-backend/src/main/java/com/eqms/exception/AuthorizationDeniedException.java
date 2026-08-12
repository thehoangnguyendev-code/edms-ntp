package com.eqms.exception;

import java.util.UUID;

public class AuthorizationDeniedException extends RuntimeException {

    private final String permissionCode;
    private final String objectType;
    private final UUID objectId;
    private final String reasonCode;

    public AuthorizationDeniedException(String permissionCode, String objectType, UUID objectId, String reasonCode, String message) {
        super(message);
        this.permissionCode = permissionCode;
        this.objectType = objectType;
        this.objectId = objectId;
        this.reasonCode = reasonCode;
    }

    public AuthorizationDeniedException(String permissionCode) {
        this(permissionCode, null, null, "MISSING_PERMISSION",
                "You do not have permission to perform this action.");
    }

    public String getPermissionCode() { return permissionCode; }
    public String getObjectType() { return objectType; }
    public UUID getObjectId() { return objectId; }
    public String getReasonCode() { return reasonCode; }
}
