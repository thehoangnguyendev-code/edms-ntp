package com.eqms.controller;

import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** A refused person gets 403 and a stable code, never a server error. */
class ObjectNumberAccessExceptionHandlerTest {

    @Test
    @SuppressWarnings("unchecked")
    void securityExceptionIsA403WithAStableCode() {
        ResponseEntity<?> response = new ObjectNumberAccessExceptionHandler().denied(new SecurityException("OBJECT_NUMBER_SCOPE_DENIED"));

        assertEquals(403, response.getStatusCode().value());
        Map<String, Object> error = (Map<String, Object>) ((Map<String, Object>) response.getBody()).get("error");
        assertEquals("OBJECT_NUMBER_SCOPE_DENIED", error.get("code"));
    }
}
