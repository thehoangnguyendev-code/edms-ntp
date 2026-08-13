package com.eqms;

import com.eqms.exception.ApiErrorResponse;
import com.eqms.exception.GlobalExceptionHandler;
import com.eqms.dto.security.AuthorizationDecision;
import com.eqms.i18n.LocalizedMessageResolver;
import com.eqms.exception.WorkflowPolicyException;
import com.eqms.auth.UnauthorizedException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Locale;
import java.util.ResourceBundle;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ApiErrorResponseLocalizationTest {

    @AfterEach
    void resetLocale() {
        LocaleContextHolder.resetLocaleContext();
    }

    @Test
    void returnsVietnameseMessageAndStableTechnicalMetadata() {
        LocaleContextHolder.setLocale(Locale.forLanguageTag("vi"));

        var error = new ApiErrorResponse.ErrorBody("PAYLOAD_TOO_LARGE", "Uploaded file is too large", List.of());

        assertEquals("PAYLOAD_TOO_LARGE", error.code());
        assertEquals("errors.payload_too_large", error.messageKey());
        assertEquals("Tệp tải lên quá lớn.", error.message());
    }

    @Test
    void fallsBackToEnglishForUnsupportedLocales() {
        LocaleContextHolder.setLocale(Locale.JAPANESE);

        var error = new ApiErrorResponse.ErrorBody("FORBIDDEN", "Access denied", List.of());

        assertEquals("You do not have permission to perform this action.", error.message());
    }

    @Test
    void usesVietnameseSafeFallbackForUnregisteredTechnicalCodes() {
        LocaleContextHolder.setLocale(Locale.forLanguageTag("vi"));

        var error = new ApiErrorResponse.ErrorBody(
                "LEGACY_SERVICE_CONDITION", "Legacy service condition was not met", List.of());

        assertEquals("LEGACY_SERVICE_CONDITION", error.code());
        assertEquals("Không thể xử lý yêu cầu. Vui lòng kiểm tra dữ liệu và thử lại.", error.message());
    }

    @Test
    void preservesKnownWorkflowValidationCodeAndLocalizesItsMessage() {
        LocaleContextHolder.setLocale(Locale.forLanguageTag("vi"));

        var response = new GlobalExceptionHandler().handleBadRequest(
                new IllegalArgumentException("AT_LEAST_ONE_REVIEWER_REQUIRED: at least one Reviewer is required"));

        assertEquals("AT_LEAST_ONE_REVIEWER_REQUIRED", response.getBody().error().code());
        assertEquals("errors.at_least_one_reviewer_required", response.getBody().error().messageKey());
        assertEquals("Khi không chọn Sub-Type, cần chỉ định tối thiểu một Reviewer.", response.getBody().error().message());
    }

    @Test
    void preservesAndLocalizesKnownResponseStatusDomainCode() {
        LocaleContextHolder.setLocale(Locale.forLanguageTag("vi"));

        var response = new GlobalExceptionHandler().handleNotFound(
                new ResponseStatusException(HttpStatus.CONFLICT, "DICTIONARY_IN_USE"));

        assertEquals("DICTIONARY_IN_USE", response.getBody().error().code());
        assertEquals("errors.dictionary_in_use", response.getBody().error().messageKey());
        assertEquals("Bản ghi từ điển đang được sử dụng nên không thể xóa. Hãy ngừng kích hoạt để bảo toàn lịch sử quy định.",
                response.getBody().error().message());
    }

    @Test
    void localizesAuthorizationDecisionMessagesByReasonCode() {
        LocaleContextHolder.setLocale(Locale.forLanguageTag("vi"));

        var decision = AuthorizationDecision.denied(
                "MISSING_PERMISSION", "You do not have permission to perform this action.",
                "document.read", "DOCUMENT", null);

        assertEquals("MISSING_PERMISSION", decision.reasonCode());
        assertEquals("Bạn không có quyền thực hiện thao tác này.", decision.message());
    }

    @Test
    void localizesCommonValidationDetailByConstraintCode() {
        LocaleContextHolder.setLocale(Locale.forLanguageTag("vi"));

        assertEquals("Yêu cầu nhập trường này.",
                LocalizedMessageResolver.resolveValidation("NotBlank", "must not be blank"));
    }

    @Test
    void keepsWorkflowPolicyCodeAndReturnsVietnameseMessage() {
        LocaleContextHolder.setLocale(Locale.forLanguageTag("vi"));

        var response = new GlobalExceptionHandler().handleWorkflowPolicy(
                WorkflowPolicyException.duplicate("duplicate workflow policy"));

        assertEquals(409, response.getStatusCode().value());
        assertEquals("WORKFLOW_POLICY_DUPLICATE", response.getBody().error().code());
        assertEquals("Đã tồn tại chính sách workflow với cấu hình này.", response.getBody().error().message());
    }

    @Test
    void localizesRevisionUploadAndOfficeOnlineErrorCodes() {
        LocaleContextHolder.setLocale(Locale.forLanguageTag("vi"));

        var upload = new ApiErrorResponse.ErrorBody(
                "REVISION_FILE_READ_FAILED", "The selected DOCX file could not be read.", List.of());
        var sharing = new ApiErrorResponse.ErrorBody(
                "EXTERNAL_IDENTITY_NOT_PROVISIONED", "Fallback", List.of());

        assertEquals("Không thể đọc tệp DOCX đã chọn.", upload.message());
        assertEquals(
                "Người nhận chưa được thêm vào Microsoft Entra hoặc chưa chấp nhận lời mời. Hãy nhờ quản trị viên mời người dùng rồi thử lại.",
                sharing.message());
    }

    @Test
    void preservesSpecificAuthenticationReasonAndLocalizesIt() {
        LocaleContextHolder.setLocale(Locale.forLanguageTag("vi"));

        var response = new GlobalExceptionHandler().handleUnauthorized(
                new UnauthorizedException("MFA challenge expired"));

        assertEquals("MFA_CHALLENGE_EXPIRED", response.getBody().error().code());
        assertEquals("Yêu cầu MFA đã hết hạn. Vui lòng bắt đầu lại.", response.getBody().error().message());
    }

    @Test
    void englishAndVietnameseServerMessageCatalogsExposeTheSameKeys() {
        var english = ResourceBundle.getBundle("messages", Locale.ENGLISH);
        var vietnamese = ResourceBundle.getBundle("messages", Locale.forLanguageTag("vi"));

        assertEquals(english.keySet(), vietnamese.keySet());
    }
}
