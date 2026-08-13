package com.eqms.config;

import com.eqms.auth.AuthenticatedUser;
import com.eqms.repository.UserLocalizationPreferenceRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.LocaleResolver;

import java.util.Locale;

/** Resolves only supported UI locales. Authenticated users override Accept-Language. */
@Component("localeResolver")
public class UserLocaleResolver implements LocaleResolver {
    private static final Locale DEFAULT_LOCALE = Locale.ENGLISH;
    private final UserLocalizationPreferenceRepository preferences;

    public UserLocaleResolver(UserLocalizationPreferenceRepository preferences) {
        this.preferences = preferences;
    }

    @Override
    public Locale resolveLocale(HttpServletRequest request) {
        var authentication = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof AuthenticatedUser user) {
            var preference = preferences.findById(user.userId()).orElse(null);
            if (preference != null && !preference.isUseSystemDefaults()) {
                return supported(preference.getLanguage());
            }
        }
        String header = request.getHeader("Accept-Language");
        return supported(header == null ? null : header.split(",", 2)[0]);
    }

    @Override
    public void setLocale(HttpServletRequest request, jakarta.servlet.http.HttpServletResponse response, Locale locale) {
        LocaleContextHolder.setLocale(locale == null ? DEFAULT_LOCALE : locale);
    }

    private Locale supported(String candidate) {
        return candidate != null && candidate.trim().toLowerCase(Locale.ROOT).startsWith("vi")
                ? Locale.forLanguageTag("vi")
                : DEFAULT_LOCALE;
    }
}
