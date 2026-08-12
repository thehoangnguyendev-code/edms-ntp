package com.eqms.controller;

import com.eqms.dto.configuration.PublicLocalizationResponse;
import com.eqms.service.SystemConfigurationService;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/localization")
public class PublicLocalizationController {
    private final SystemConfigurationService systemConfigurationService;

    public PublicLocalizationController(SystemConfigurationService systemConfigurationService) {
        this.systemConfigurationService = systemConfigurationService;
    }

    @GetMapping
    public ResponseEntity<PublicLocalizationResponse> getLocalization() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(systemConfigurationService.getPublicLocalization());
    }
}
