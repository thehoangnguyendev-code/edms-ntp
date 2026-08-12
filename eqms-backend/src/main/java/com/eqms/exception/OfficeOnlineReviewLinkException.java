package com.eqms.exception;

/**
 * A safe, client-facing failure while issuing a named Word Online review link.
 *
 * <p>The underlying Microsoft Graph response can contain tenant and sharing
 * details, so it is logged server-side and never returned to the browser.</p>
 */
public class OfficeOnlineReviewLinkException extends RuntimeException {

    private final String errorCode;
    private final int httpStatus;

    public OfficeOnlineReviewLinkException(String errorCode, int httpStatus, String message) {
        super(message);
        this.errorCode = errorCode;
        this.httpStatus = httpStatus;
    }

    public OfficeOnlineReviewLinkException(String errorCode, int httpStatus, String message, Throwable cause) {
        super(message, cause);
        this.errorCode = errorCode;
        this.httpStatus = httpStatus;
    }

    public String getErrorCode() {
        return errorCode;
    }

    public int getHttpStatus() {
        return httpStatus;
    }
}
