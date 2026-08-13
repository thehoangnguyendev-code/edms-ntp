package com.eqms.exception;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.MissingResourceException;
import java.util.ResourceBundle;

import org.springframework.context.i18n.LocaleContextHolder;

public record ApiErrorResponse(
        ErrorBody error
) {
    public record ErrorBody(
            String code,
            String messageKey,
            String message,
            Map<String, Object> parameters,
            List<ErrorDetail> details
    ) {
        /** Compatibility constructor for existing handlers. */
        public ErrorBody(String code, String fallbackMessage, List<ErrorDetail> details) {
            this(code, messageKey(code), resolveMessage(code, fallbackMessage), Map.of(), details);
        }

        private static String messageKey(String code) {
            return "errors." + (code == null ? "internal_error" : code.toLowerCase(Locale.ROOT));
        }

        private static String resolveMessage(String code, String fallbackMessage) {
            String key = messageKey(code);
            try {
                Locale requestedLocale = LocaleContextHolder.getLocale();
                Locale supportedLocale = "vi".equalsIgnoreCase(requestedLocale.getLanguage())
                        ? Locale.forLanguageTag("vi")
                        : Locale.ENGLISH;
                ResourceBundle bundle = ResourceBundle.getBundle("messages", supportedLocale);
                return bundle.containsKey(key) ? bundle.getString(key) : fallbackMessage;
            } catch (MissingResourceException ignored) {
                return fallbackMessage;
            }
        }
    }

    public record ErrorDetail(
            String field,
            String message
    ) {
    }
}
