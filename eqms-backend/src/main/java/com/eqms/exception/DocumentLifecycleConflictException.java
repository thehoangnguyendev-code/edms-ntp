package com.eqms.exception;

/**
 * A recoverable Document-master lifecycle precondition failure (Cancel/Obsolete) that must be
 * surfaced as HTTP 409 with a stable, machine-readable code -- never a generic 500. See
 * docs/to-be-sds/01-document-lifecycle.md TBR-DOC-008/010.
 */
public class DocumentLifecycleConflictException extends RuntimeException {

    private final String code;

    public DocumentLifecycleConflictException(String code, String message) {
        super(message);
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
