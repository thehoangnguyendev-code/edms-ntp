package com.eqms.exception;

import com.eqms.auth.UnauthorizedException;
import com.eqms.exception.RevisionWorkspaceBatchValidationException;
import com.eqms.exception.RevisionWorkspaceValidationIssue;
import com.eqms.i18n.LocalizedMessageResolver;
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
import java.util.Set;
import java.util.UUID;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);
    private static final Set<String> DOMAIN_VALIDATION_CODES = Set.of(
            "REVIEW_NOT_REQUIRED",
            "EXACTLY_ONE_REVIEWER_REQUIRED",
            "MULTIPLE_REVIEWERS_REQUIRED",
            "AT_LEAST_ONE_REVIEWER_REQUIRED",
            "TEST_EMAIL_SEND_FAILED"
    );
    private static final Set<String> RESPONSE_STATUS_DOMAIN_CODES = Set.of(
            "ACCESS_PROFILE_CONFIGURATION_CONFLICT",
            "DICTIONARY_IN_USE",
            "PERMISSION_CODE_REQUIRED"
    );

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
        String code = resolveUnauthorizedCode(exception.getMessage());
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ApiErrorResponse(
                        new ApiErrorResponse.ErrorBody(
                                code,
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
        String code = exception instanceof ResponseStatusException responseStatusException
                ? resolveResponseStatusCode(responseStatusException, status)
                : "RESOURCE_NOT_FOUND";

        return ResponseEntity.status(status)
                .body(new ApiErrorResponse(
                        new ApiErrorResponse.ErrorBody(
                                code,
                                exception.getMessage() == null ? "Resource not found" : exception.getMessage(),
                                List.of()
                        )
                ));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiErrorResponse> handleBadRequest(IllegalArgumentException exception) {
        String code = resolveDomainValidationCode(exception);
        return ResponseEntity.badRequest()
                .body(new ApiErrorResponse(
                        new ApiErrorResponse.ErrorBody(
                                code == null ? "BAD_REQUEST" : code,
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
        String code = resolveDomainValidationCode(exception);
        if (code != null) {
            return ResponseEntity.badRequest()
                    .body(new ApiErrorResponse(
                            new ApiErrorResponse.ErrorBody(code, exception.getMessage(), List.of())
                    ));
        }
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

    @ExceptionHandler(AuthorizationDeniedException.class)
    public ResponseEntity<ApiErrorResponse> handleAuthorizationDenied(AuthorizationDeniedException exception) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(new ApiErrorResponse(new ApiErrorResponse.ErrorBody(
                        exception.getReasonCode(), exception.getMessage(), List.of())));
    }

    @ExceptionHandler(FileAccessDeniedException.class)
    public ResponseEntity<ApiErrorResponse> handleFileAccessDenied(FileAccessDeniedException exception) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(new ApiErrorResponse(new ApiErrorResponse.ErrorBody(
                        exception.getReasonCode(), exception.getMessage(), List.of())));
    }

    @ExceptionHandler(ControlledCopyAuthorizationException.class)
    public ResponseEntity<ApiErrorResponse> handleControlledCopyAuthorization(ControlledCopyAuthorizationException exception) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(new ApiErrorResponse(new ApiErrorResponse.ErrorBody(
                        exception.getReasonCode(), exception.getMessage(), List.of())));
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
                                exception.getReasonCode() == null ? "WORKFLOW_ACCESS_DENIED" : exception.getReasonCode(),
                                exception.getMessage() == null ? "Access denied" : exception.getMessage(),
                                List.of()
                        )
                ));
    }

    @ExceptionHandler(WorkflowActionValidationException.class)
    public ResponseEntity<ApiErrorResponse> handleWorkflowActionValidation(WorkflowActionValidationException exception) {
        return ResponseEntity.status(exception.getHttpStatus())
                .body(new ApiErrorResponse(new ApiErrorResponse.ErrorBody(
                        exception.getErrorCode(), exception.getMessage(), List.of())));
    }

    @ExceptionHandler(WorkflowPolicyException.class)
    public ResponseEntity<ApiErrorResponse> handleWorkflowPolicy(WorkflowPolicyException exception) {
        return ResponseEntity.status(exception.getHttpStatus())
                .body(new ApiErrorResponse(new ApiErrorResponse.ErrorBody(
                        exception.getErrorCode(), exception.getMessage(), List.of())));
    }

    @ExceptionHandler(OfficeOnlineReviewLinkException.class)
    public ResponseEntity<ApiErrorResponse> handleOfficeOnlineReviewLink(OfficeOnlineReviewLinkException exception) {
        return ResponseEntity.status(exception.getHttpStatus())
                .body(new ApiErrorResponse(new ApiErrorResponse.ErrorBody(
                        exception.getErrorCode(), exception.getMessage(), List.of())));
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
        return new ApiErrorResponse.ErrorDetail(
                fieldError.getField(),
                LocalizedMessageResolver.resolveValidation(fieldError.getCode(), fieldError.getDefaultMessage())
        );
    }

    /**
     * A few document/revision workflow invariants intentionally use a stable
     * technical code followed by diagnostic text. Preserve that code for API
     * clients and let ApiErrorResponse resolve the human message from the
     * selected request locale. All other exceptions keep their existing
     * generic error behavior.
     */
    private String resolveDomainValidationCode(RuntimeException exception) {
        String message = exception == null ? null : exception.getMessage();
        if (message == null) {
            return null;
        }
        int separatorIndex = message.indexOf(':');
        if (separatorIndex <= 0) {
            return null;
        }
        String candidate = message.substring(0, separatorIndex).trim();
        return DOMAIN_VALIDATION_CODES.contains(candidate) ? candidate : null;
    }

    /**
     * Authentication failures predate the structured API-error contract and are
     * emitted by several services as human-readable text. Preserve their
     * existing HTTP status while mapping known, user-facing cases to stable
     * English codes so ErrorBody can select the request locale safely.
     */
    private String resolveUnauthorizedCode(String message) {
        if (message == null || message.isBlank()) {
            return "UNAUTHORIZED";
        }
        if (message.startsWith("Account is locked")) return "ACCOUNT_LOCKED";
        if (message.startsWith("Account is locked after")) return "ACCOUNT_LOCKED";
        if (message.startsWith("Password is incorrect")) return "PASSWORD_INCORRECT";
        return switch (message) {
            case "Authentication required" -> "UNAUTHORIZED";
            case "MFA challenge expired" -> "MFA_CHALLENGE_EXPIRED";
            case "Invalid verification code" -> "INVALID_VERIFICATION_CODE";
            case "Refresh token is missing" -> "REFRESH_TOKEN_MISSING";
            case "Refresh token expired or revoked" -> "REFRESH_TOKEN_EXPIRED";
            case "Session is not locked" -> "SESSION_NOT_LOCKED";
            case "Session revoked" -> "SESSION_REVOKED";
            case "Session expired" -> "SESSION_EXPIRED";
            case "Session locked" -> "SESSION_LOCKED";
            case "Current password is invalid" -> "CURRENT_PASSWORD_INVALID";
            case "Reset token expired" -> "RESET_TOKEN_EXPIRED";
            case "Password verification failed" -> "PASSWORD_VERIFICATION_FAILED";
            case "Session does not belong to current user" -> "SESSION_NOT_OWNED";
            case "Electronic signature must belong to the current user" -> "ESIGNATURE_OWNER_MISMATCH";
            case "Signature token does not belong to current user" -> "SIGNATURE_TOKEN_NOT_OWNED";
            case "Education does not belong to current user" -> "EDUCATION_NOT_OWNED";
            case "Certification does not belong to current user" -> "CERTIFICATION_NOT_OWNED";
            case "Authenticated user required for security change signature" -> "SECURITY_ESIGN_AUTH_REQUIRED";
            default -> "UNAUTHORIZED";
        };
    }

    /** Maps direct HTTP exceptions to stable, localizable API error codes. */
    private String errorCodeFor(HttpStatus status) {
        return switch (status) {
            case BAD_REQUEST -> "BAD_REQUEST";
            case UNAUTHORIZED -> "UNAUTHORIZED";
            case FORBIDDEN -> "FORBIDDEN";
            case NOT_FOUND -> "RESOURCE_NOT_FOUND";
            case METHOD_NOT_ALLOWED -> "METHOD_NOT_ALLOWED";
            case CONFLICT -> "CONFLICT";
            case PAYLOAD_TOO_LARGE -> "PAYLOAD_TOO_LARGE";
            case UNSUPPORTED_MEDIA_TYPE -> "UNSUPPORTED_MEDIA_TYPE";
            case UNPROCESSABLE_ENTITY -> "VALIDATION_ERROR";
            default -> "BAD_REQUEST";
        };
    }

    /** Keeps domain-specific HTTP failures stable while localizing their message by request locale. */
    private String resolveResponseStatusCode(ResponseStatusException exception, HttpStatus status) {
        String reason = exception.getReason();
        return reason != null && RESPONSE_STATUS_DOMAIN_CODES.contains(reason)
                ? reason
                : errorCodeFor(status);
    }

    private ApiErrorResponse.ErrorDetail toDetail(ConstraintViolation<?> violation) {
        String path = violation.getPropertyPath() == null ? null : violation.getPropertyPath().toString();
        String constraint = violation.getConstraintDescriptor() == null
                ? null
                : violation.getConstraintDescriptor().getAnnotation().annotationType().getSimpleName();
        return new ApiErrorResponse.ErrorDetail(
                path,
                LocalizedMessageResolver.resolveValidation(constraint, violation.getMessage())
        );
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
