package com.eqms.exception;

import com.eqms.auth.UnauthorizedException;
import com.eqms.exception.RevisionWorkspaceBatchValidationException;
import com.eqms.exception.RevisionWorkspaceValidationIssue;
import jakarta.persistence.EntityNotFoundException;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.server.ResponseStatusException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.UUID;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiErrorResponse> handleValidation(MethodArgumentNotValidException exception) {
        List<ApiErrorResponse.ErrorDetail> details = exception.getBindingResult()
                .getFieldErrors()
                .stream()
                .map(this::toDetail)
                .toList();

        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
                .body(new ApiErrorResponse(
                        new ApiErrorResponse.ErrorBody(
                                "VALIDATION_ERROR",
                                "Dữ liệu không hợp lệ",
                                details
                        )
                ));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiErrorResponse> handleUnreadableMessage(HttpMessageNotReadableException exception) {
        return ResponseEntity.badRequest()
                .body(new ApiErrorResponse(
                        new ApiErrorResponse.ErrorBody(
                                "BAD_REQUEST",
                                "Request body is not valid JSON or does not match the API contract",
                                List.of()
                        )
                ));
    }

    @ExceptionHandler(UnauthorizedException.class)
    public ResponseEntity<ApiErrorResponse> handleUnauthorized(UnauthorizedException exception) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ApiErrorResponse(
                        new ApiErrorResponse.ErrorBody(
                                "UNAUTHORIZED",
                                exception.getMessage() == null ? "Authentication required" : exception.getMessage(),
                                List.of()
                        )
                ));
    }

    @ExceptionHandler({EntityNotFoundException.class, ResponseStatusException.class})
    public ResponseEntity<ApiErrorResponse> handleNotFound(RuntimeException exception) {
        HttpStatus status = exception instanceof ResponseStatusException responseStatusException
                ? HttpStatus.valueOf(responseStatusException.getStatusCode().value())
                : HttpStatus.NOT_FOUND;

        return ResponseEntity.status(status)
                .body(new ApiErrorResponse(
                        new ApiErrorResponse.ErrorBody(
                                "RESOURCE_NOT_FOUND",
                                exception.getMessage() == null ? "Resource not found" : exception.getMessage(),
                                List.of()
                        )
                ));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiErrorResponse> handleBadRequest(IllegalArgumentException exception) {
        return ResponseEntity.badRequest()
                .body(new ApiErrorResponse(
                        new ApiErrorResponse.ErrorBody(
                                "BAD_REQUEST",
                                exception.getMessage(),
                                List.of()
                        )
                ));
    }

    @ExceptionHandler(RevisionUploadValidationException.class)
    public ResponseEntity<ApiErrorResponse> handleRevisionUploadValidation(RevisionUploadValidationException exception) {
        return ResponseEntity.badRequest()
                .body(new ApiErrorResponse(
                        new ApiErrorResponse.ErrorBody(
                                exception.getCode(),
                                exception.getMessage(),
                                List.of()
                        )
                ));
    }

    @ExceptionHandler(OfficeOnlineShareException.class)
    public ResponseEntity<ApiErrorResponse> handleOfficeOnlineShare(OfficeOnlineShareException exception) {
        return ResponseEntity.badRequest()
                .body(new ApiErrorResponse(
                        new ApiErrorResponse.ErrorBody(
                                exception.getCode(),
                                exception.getMessage(),
                                List.of()
                        )
                ));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ApiErrorResponse> handleIllegalState(IllegalStateException exception) {
        log.error("IllegalStateException while processing request", exception);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ApiErrorResponse(
                        new ApiErrorResponse.ErrorBody(
                                "INTERNAL_ERROR",
                                exception.getMessage() == null ? "Unexpected server error" : exception.getMessage(),
                                List.of()
                        )
                ));
    }

    @ExceptionHandler(com.eqms.service.ClamAvScanService.VirusScanUnavailableException.class)
    public ResponseEntity<ApiErrorResponse> handleVirusScanUnavailable(com.eqms.service.ClamAvScanService.VirusScanUnavailableException exception) {
        log.warn("Virus scan service unavailable", exception);
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(new ApiErrorResponse(
                        new ApiErrorResponse.ErrorBody(
                                "VIRUS_SCAN_UNAVAILABLE",
                                exception.getMessage(),
                                List.of()
                        )
                ));
    }

    @ExceptionHandler(RevisionWorkspaceBatchValidationException.class)
    public ResponseEntity<ApiErrorResponse> handleRevisionWorkspaceBatchValidation(RevisionWorkspaceBatchValidationException exception) {
        List<ApiErrorResponse.ErrorDetail> details = exception.getIssues().stream()
                .map(this::toDetail)
                .toList();

        return ResponseEntity.unprocessableEntity()
                .body(new ApiErrorResponse(
                        new ApiErrorResponse.ErrorBody(
                                "WORKSPACE_BATCH_VALIDATION_ERROR",
                                "Revision workspace batch validation failed",
                                details
                        )
                ));
    }

    @ExceptionHandler(RelatedDocumentsNotEffectiveException.class)
    public ResponseEntity<ApiErrorResponse> handleRelatedDocumentsNotEffective(RelatedDocumentsNotEffectiveException exception) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiErrorResponse(
                        new ApiErrorResponse.ErrorBody(
                                "RELATED_DOCUMENTS_NOT_EFFECTIVE",
                                exception.getMessage(),
                                exception.getDetails()
                        )
                ));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiErrorResponse> handleDataIntegrity(DataIntegrityViolationException exception) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ApiErrorResponse(
                        new ApiErrorResponse.ErrorBody(
                                "DATA_INTEGRITY_ERROR",
                                resolveDataIntegrityMessage(exception),
                                List.of()
                        )
                ));
    }

    @ExceptionHandler({MissingServletRequestPartException.class, MultipartException.class})
    public ResponseEntity<ApiErrorResponse> handleMultipart(Exception exception) {
        return ResponseEntity.badRequest()
                .body(new ApiErrorResponse(
                        new ApiErrorResponse.ErrorBody(
                                "BAD_REQUEST",
                                exception.getMessage() == null || exception.getMessage().isBlank()
                                        ? "File is required"
                                        : exception.getMessage(),
                                List.of()
                        )
                ));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiErrorResponse> handleMaxUpload(MaxUploadSizeExceededException exception) {
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                .body(new ApiErrorResponse(
                        new ApiErrorResponse.ErrorBody(
                                "PAYLOAD_TOO_LARGE",
                                "Uploaded file is too large",
                                List.of()
                        )
                ));
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiErrorResponse> handleConstraintViolation(ConstraintViolationException exception) {
        List<ApiErrorResponse.ErrorDetail> details = exception.getConstraintViolations().stream()
                .map(this::toDetail)
                .toList();

        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
                .body(new ApiErrorResponse(
                        new ApiErrorResponse.ErrorBody(
                                "VALIDATION_ERROR",
                                "Dữ liệu không hợp lệ",
                                details
                        )
                ));
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiErrorResponse> handleTypeMismatch(MethodArgumentTypeMismatchException exception) {
        String paramName = exception.getName();
        return ResponseEntity.badRequest()
                .body(new ApiErrorResponse(
                        new ApiErrorResponse.ErrorBody(
                                "BAD_REQUEST",
                                "Invalid value supplied for parameter '" + paramName + "'",
                                List.of()
                        )
                ));
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ApiErrorResponse> handleMissingParameter(MissingServletRequestParameterException exception) {
        return ResponseEntity.badRequest()
                .body(new ApiErrorResponse(
                        new ApiErrorResponse.ErrorBody(
                                "BAD_REQUEST",
                                "Missing required parameter '" + exception.getParameterName() + "'",
                                List.of()
                        )
                ));
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiErrorResponse> handleMethodNotSupported(HttpRequestMethodNotSupportedException exception) {
        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED)
                .body(new ApiErrorResponse(
                        new ApiErrorResponse.ErrorBody(
                                "METHOD_NOT_ALLOWED",
                                "HTTP method not supported for this endpoint",
                                List.of()
                        )
                ));
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ApiErrorResponse> handleMediaTypeNotSupported(HttpMediaTypeNotSupportedException exception) {
        return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE)
                .body(new ApiErrorResponse(
                        new ApiErrorResponse.ErrorBody(
                                "UNSUPPORTED_MEDIA_TYPE",
                                "Unsupported content type",
                                List.of()
                        )
                ));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiErrorResponse> handleAccessDenied(AccessDeniedException exception) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(new ApiErrorResponse(
                        new ApiErrorResponse.ErrorBody(
                                "FORBIDDEN",
                                exception.getMessage() == null ? "Access denied" : exception.getMessage(),
                                List.of()
                        )
                ));
    }

    // The class-level javadoc on WorkflowAuthorizationDeniedException already documented this as
    // mapping to 403 WORKFLOW_ACCESS_DENIED, but the handler was never actually added -- it fell
    // through to the generic Exception handler below, surfacing as a vague 500 "Unexpected server
    // error" instead of the real denial reason (found while verifying a SoD permission fix: an
    // admin-role cancel-revision attempt was correctly rejected server-side, but the response hid
    // why).
    @ExceptionHandler(WorkflowAuthorizationDeniedException.class)
    public ResponseEntity<ApiErrorResponse> handleWorkflowAuthorizationDenied(WorkflowAuthorizationDeniedException exception) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(new ApiErrorResponse(
                        new ApiErrorResponse.ErrorBody(
                                "WORKFLOW_ACCESS_DENIED",
                                exception.getMessage() == null ? "Access denied" : exception.getMessage(),
                                List.of()
                        )
                ));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiErrorResponse> handleUnexpected(Exception exception) {
        log.error("Unhandled exception while processing request", exception);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ApiErrorResponse(
                        new ApiErrorResponse.ErrorBody(
                                "INTERNAL_ERROR",
                                "Unexpected server error",
                                List.of()
                        )
                ));
    }

    private ApiErrorResponse.ErrorDetail toDetail(FieldError fieldError) {
        return new ApiErrorResponse.ErrorDetail(fieldError.getField(), fieldError.getDefaultMessage());
    }

    private ApiErrorResponse.ErrorDetail toDetail(ConstraintViolation<?> violation) {
        String path = violation.getPropertyPath() == null ? null : violation.getPropertyPath().toString();
        return new ApiErrorResponse.ErrorDetail(path, violation.getMessage());
    }

    private ApiErrorResponse.ErrorDetail toDetail(RevisionWorkspaceValidationIssue issue) {
        String field = "items[" + (issue.itemOrder() == null ? 0 : issue.itemOrder()) + "]"
                + (issue.field() == null ? "" : "." + issue.field());
        String message = issue.message();
        UUID traceDocumentId = issue.documentId() != null ? issue.documentId() : issue.parentDocumentId();
        if (traceDocumentId != null) {
            message = "[" + traceDocumentId + "] " + message;
        }
        return new ApiErrorResponse.ErrorDetail(field, message);
    }

    private String resolveDataIntegrityMessage(DataIntegrityViolationException exception) {
        String message = exception.getMostSpecificCause() == null
                ? exception.getMessage()
                : exception.getMostSpecificCause().getMessage();
        if (message != null && message.contains("uq_document_workflow_participant")) {
            return "Document participant list contains duplicated users for the same role";
        }
        if (message != null && message.contains("uq_document_relation")) {
            return "Document relationship list contains duplicated documents";
        }
        return "Unable to save data because it violates database constraints";
    }
}
