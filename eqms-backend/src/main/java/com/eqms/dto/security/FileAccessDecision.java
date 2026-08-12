package com.eqms.dto.security;

import com.eqms.enums.FileAccessAction;
import com.eqms.enums.FileObjectType;

import java.util.UUID;

public record FileAccessDecision(
        boolean allowed,
        String reasonCode,
        String message,
        String permissionCode,
        FileAccessAction action,
        FileObjectType objectType,
        UUID objectId,
        boolean auditRequired
) {

    public static FileAccessDecision allowed(
            FileAccessAction action, FileObjectType objectType, UUID objectId, boolean auditRequired) {
        return new FileAccessDecision(true, null, null, null, action, objectType, objectId, auditRequired);
    }

    public static FileAccessDecision denied(
            String reasonCode, String message, String permissionCode,
            FileAccessAction action, FileObjectType objectType, UUID objectId) {
        return new FileAccessDecision(false, reasonCode, message, permissionCode, action, objectType, objectId, false);
    }
}
