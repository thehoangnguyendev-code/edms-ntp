package com.eqms.exception;

/**
 * A deterministic, client-safe rejection for a revision source-file upload.
 * The code is persisted in the audit trail and returned by the API so callers
 * can distinguish a malformed DOCX from a size or malware rejection.
 */
public class RevisionUploadValidationException extends RuntimeException {

    private final String code;

    public RevisionUploadValidationException(String code, String message) {
        super(message);
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
