package com.eqms.controller;

import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import java.util.Map;

/** Scoped to reporting: domain scope denials are HTTP 403, not generic server errors. */
@Order(Ordered.HIGHEST_PRECEDENCE)
@RestControllerAdvice(assignableTypes={ReportTemplateController.class,ReportPlatformController.class,ReportConfigurationController.class,ReportLayoutController.class,ReportNameFormatController.class,ReportPropertiesController.class,ReportTypeController.class,ReportOverviewController.class})
public class ReportAccessExceptionHandler {
    @ExceptionHandler(SecurityException.class)
    public ResponseEntity<?> denied(SecurityException exception) {
        // One refusal says why: the person is not the kind of approver this template needs (REPORT-GMP-APPROVER-2026-11-13). Every other refusal stays general.
        if ("REPORT_GMP_APPROVER_REQUIRED".equals(exception.getMessage()))
            return ResponseEntity.status(403).body(Map.of("error",Map.of("code","REPORT_GMP_APPROVER_REQUIRED","message","This template is for GMP decisions: only a person who may approve a report for GMP use can approve or return it.")));
        return ResponseEntity.status(403).body(Map.of("error",Map.of("code","REPORT_SCOPE_DENIED","message","Current report permissions or metadata scope do not permit this action.")));
    }
}
