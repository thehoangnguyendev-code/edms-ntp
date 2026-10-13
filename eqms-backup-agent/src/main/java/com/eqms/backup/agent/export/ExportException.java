package com.eqms.backup.agent.export;

/** A refusal with a stable code; the code, not the message, is what screens key on. */
public class ExportException extends RuntimeException {

    public enum Kind { INVALID, CONFLICT, NOT_FOUND, SEPARATION }

    public final Kind kind;
    public final String code;

    public ExportException(Kind kind, String code, String message) {
        super(message);
        this.kind = kind;
        this.code = code;
    }

    public static ExportException invalid(String code, String message) {
        return new ExportException(Kind.INVALID, code, message);
    }

    public static ExportException conflict(String code, String message) {
        return new ExportException(Kind.CONFLICT, code, message);
    }

    public static ExportException notFound(String code, String message) {
        return new ExportException(Kind.NOT_FOUND, code, message);
    }
}
