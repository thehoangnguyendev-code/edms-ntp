package com.eqms.exception;

/**
 * #16: an external integration failure (Microsoft Graph/Office Online today) whose full raw
 * detail -- the upstream HTTP response body -- must never reach an API client verbatim. Prior to
 * this, every such failure was a plain {@code IllegalStateException("<context>: " + response.body())},
 * and {@code GlobalExceptionHandler}'s generic IllegalStateException handler returns
 * {@code exception.getMessage()} to the client unmodified, so the raw upstream response (internal
 * Graph error codes/request IDs, occasionally more) leaked straight into the API error response.
 * Carries two distinct strings on purpose: {@link #getSafeMessage()} is what the client sees,
 * {@link #getRawDetail()} is logged server-side only (see the message passed to the superclass,
 * used for stack traces/log correlation).
 */
public class ExternalIntegrationException extends RuntimeException {

    private final String safeMessage;
    private final String rawDetail;

    public ExternalIntegrationException(String safeMessage, String rawDetail) {
        super(safeMessage + " | raw: " + rawDetail);
        this.safeMessage = safeMessage;
        this.rawDetail = rawDetail;
    }

    public String getSafeMessage() {
        return safeMessage;
    }

    public String getRawDetail() {
        return rawDetail;
    }
}
