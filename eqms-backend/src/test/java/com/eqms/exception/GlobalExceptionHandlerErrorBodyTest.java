package com.eqms.exception;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.context.request.async.AsyncRequestNotUsableException;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;

/** An unexpected error always answers JSON, even where an export or event stream chose another content type. */
class GlobalExceptionHandlerErrorBodyTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void unexpectedErrorIsExplicitlyJson() {
        ResponseEntity<ApiErrorResponse> response = handler.handleUnexpected(new IllegalStateException("boom"));

        assertEquals(500, response.getStatusCode().value());
        assertEquals(MediaType.APPLICATION_JSON, response.getHeaders().getContentType());
        assertEquals("INTERNAL_ERROR", response.getBody().error().code());
    }

    @Test
    void aClosedConnectionIsQuietlyIgnored() {
        assertDoesNotThrow(() -> handler.handleClientGone(new AsyncRequestNotUsableException("Response not usable after response errors")));
    }
}
