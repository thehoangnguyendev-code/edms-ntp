package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.auth.LocalizationPreferenceResponse;
import com.eqms.dto.auth.UpdateLocalizationPreferenceRequest;
import com.eqms.entity.UserLocalizationPreference;
import com.eqms.repository.UserLocalizationPreferenceRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
public class UserLocalizationPreferenceService {
    private final CurrentUserService currentUserService;
    private final UserLocalizationPreferenceRepository repository;

    public UserLocalizationPreferenceService(CurrentUserService currentUserService,
                                             UserLocalizationPreferenceRepository repository) {
        this.currentUserService = currentUserService;
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public LocalizationPreferenceResponse getMine() {
        var user = currentUserService.requireCurrentUser();
        return repository.findById(user.getId()).map(this::toResponse)
                .orElseGet(() -> new LocalizationPreferenceResponse(true, null, null, null, null, null));
    }

    @Transactional
    public LocalizationPreferenceResponse updateMine(UpdateLocalizationPreferenceRequest request) {
        var user = currentUserService.requireCurrentUser();
        var preference = repository.findById(user.getId()).orElseGet(UserLocalizationPreference::new);
        preference.setUserId(user.getId());
        preference.setUseSystemDefaults(request.useSystemDefaults());
        preference.setLanguage(request.language());
        preference.setDateTimeFormat(request.dateTimeFormat());
        preference.setTimeZone(request.timeZone());
        preference.setNumberFormat(request.numberFormat());
        preference.setFontFamily(request.fontFamily());
        preference.setUpdatedAt(Instant.now());
        return toResponse(repository.save(preference));
    }

    private LocalizationPreferenceResponse toResponse(UserLocalizationPreference value) {
        return new LocalizationPreferenceResponse(value.isUseSystemDefaults(), value.getLanguage(),
                value.getDateTimeFormat(), value.getTimeZone(), value.getNumberFormat(), value.getFontFamily());
    }
}
