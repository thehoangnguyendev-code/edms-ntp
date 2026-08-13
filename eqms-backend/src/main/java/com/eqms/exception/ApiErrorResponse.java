package com.eqms.exception;

import java.util.List;

public record ApiErrorResponse(
        ErrorBody error
) {
    public record ErrorBody(
            String code,
            String message,
            List<ErrorDetail> details
    ) {
    }

    public record ErrorDetail(
            String field,
            String message
    ) {
    }
}
