package com.eqms.controller.training;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

/** A refused request in Training answers 403 with a stable code and nothing about the object (it does not say whether it exists). */
@RestControllerAdvice(basePackages = "com.eqms.controller.training")
public class TrainingExceptionHandler {
    @ExceptionHandler(SecurityException.class)
    public ResponseEntity<?> denied(SecurityException exception) {
        return ResponseEntity.status(403).body(Map.of("error", Map.of("code", "TRAINING_SCOPE_DENIED",
                "message", "Current permissions or scope do not permit this action.")));
    }
}
