package com.eqms.controller;

import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import java.util.Map;

/** Scoped to reporting: domain scope denials are HTTP 403, not generic server errors. */
@Order(Ordered.HIGHEST_PRECEDENCE)
@RestControllerAdvice(assignableTypes={ReportTemplateController.class,ReportPlatformController.class,ReportConfigurationController.class,ReportLayoutController.class})
public class ReportAccessExceptionHandler {
    @ExceptionHandler(SecurityException.class)
    public ResponseEntity<?> denied(SecurityException exception) {
        return ResponseEntity.status(403).body(Map.of("error",Map.of("code","REPORT_SCOPE_DENIED","message","Current report permissions or metadata scope do not permit this action.")));
    }
}
