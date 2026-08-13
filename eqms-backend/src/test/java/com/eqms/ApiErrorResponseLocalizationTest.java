package com.eqms;

import com.eqms.exception.ApiErrorResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.i18n.LocaleContextHolder;

import java.util.List;
import java.util.Locale;

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
}
