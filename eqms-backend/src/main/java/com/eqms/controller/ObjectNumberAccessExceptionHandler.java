package com.eqms.controller;

import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.List;
import java.util.Map;

/**
 * Object Numbering refuses a person without the permission with a plain {@link SecurityException};
 * with no handler that was HTTP 500. It is a refusal, so it answers 403 with a stable code
 * (DEC-AUTHZ-2026-11-21-15). Same pattern as {@link ReportAccessExceptionHandler}.
 */
@Order(Ordered.HIGHEST_PRECEDENCE)
@RestControllerAdvice(assignableTypes = {ObjectNumberingController.class})
public class ObjectNumberAccessExceptionHandler {

    @ExceptionHandler(SecurityException.class)
    public ResponseEntity<?> denied(SecurityException exception) {
        return ResponseEntity.status(403).body(Map.of("error", Map.of(
                "code", "OBJECT_NUMBER_SCOPE_DENIED",
                "message", "Current permissions do not permit this action.",
                "details", List.of())));
    }
}
