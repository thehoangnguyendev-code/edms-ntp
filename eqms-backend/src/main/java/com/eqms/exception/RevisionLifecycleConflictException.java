package com.eqms.exception;

/**
 * A recoverable Revision-lifecycle precondition failure (wrong workflow state, participant action
 * already completed, Cancel attempted outside Draft) that must be surfaced as HTTP 409 with a
 * stable, machine-readable code -- never a generic 500.
 */
public class RevisionLifecycleConflictException extends RuntimeException {

    private final String code;

    public RevisionLifecycleConflictException(String code, String message) {
        super(message);
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
