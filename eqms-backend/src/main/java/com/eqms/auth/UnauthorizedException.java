package com.eqms.auth;

public class UnauthorizedException extends RuntimeException {
    private final String code;

    public UnauthorizedException(String message) {
        this(message, null);
    }

    /** {@code code}: a stable machine value the browser can act on; null keeps the generic UNAUTHORIZED. */
    public UnauthorizedException(String message, String code) {
        super(message);
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
