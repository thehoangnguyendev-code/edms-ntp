package com.eqms.i18n;

import org.springframework.context.i18n.LocaleContextHolder;

import java.util.Locale;
import java.util.MissingResourceException;
import java.util.ResourceBundle;

/** Resolves API decision text from a stable technical code in the current request locale. */
public final class LocalizedMessageResolver {
    private LocalizedMessageResolver() {
    }

    public static String resolve(String namespace, String code, String fallback) {
        if (code == null || code.isBlank()) {
            return fallback;
        }
        try {
            Locale requested = LocaleContextHolder.getLocale();
            Locale locale = "vi".equalsIgnoreCase(requested.getLanguage())
                    ? Locale.forLanguageTag("vi")
                    : Locale.ENGLISH;
            ResourceBundle bundle = ResourceBundle.getBundle("messages", locale);
            String key = namespace + "." + code.toLowerCase(Locale.ROOT);
            return bundle.containsKey(key) ? bundle.getString(key) : fallback;
        } catch (MissingResourceException ignored) {
            return fallback;
        }
    }

    public static String resolveValidation(String constraintCode, String fallback) {
        return resolve("validation", constraintCode, fallback);
    }
}
