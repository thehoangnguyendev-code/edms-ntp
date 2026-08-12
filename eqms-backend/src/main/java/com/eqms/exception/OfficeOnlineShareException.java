package com.eqms.exception;

/**
 * A deterministic, client-safe rejection for Microsoft Graph Office Online sharing operations
 * (grant edit access, create review link). Distinguishes a user simply not being provisioned in
 * Microsoft Entra yet (fixable by an admin via User Management -- External Identity, then the
 * user retries) from a genuine Graph/network failure, instead of surfacing the raw Graph error
 * JSON to the end user.
 */
public class OfficeOnlineShareException extends RuntimeException {

    private final String code;

    public OfficeOnlineShareException(String code, String message) {
        super(message);
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
