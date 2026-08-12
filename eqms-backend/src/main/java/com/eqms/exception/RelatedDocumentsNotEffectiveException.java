package com.eqms.exception;

import java.util.List;

public class RelatedDocumentsNotEffectiveException extends RuntimeException {
    private final List<ApiErrorResponse.ErrorDetail> details;

    public RelatedDocumentsNotEffectiveException(String message, List<ApiErrorResponse.ErrorDetail> details) {
        super(message);
        this.details = details;
    }

    public List<ApiErrorResponse.ErrorDetail> getDetails() {
        return details;
    }
}
