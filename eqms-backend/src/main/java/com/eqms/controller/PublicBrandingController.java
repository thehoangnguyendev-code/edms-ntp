package com.eqms.controller;

import com.eqms.dto.configuration.PublicBrandingResponse;
import com.eqms.service.SystemConfigurationService;
import org.springframework.http.ResponseEntity;
import org.springframework.http.CacheControl;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/branding")
public class PublicBrandingController {
    private final SystemConfigurationService systemConfigurationService;

    public PublicBrandingController(SystemConfigurationService systemConfigurationService) {
        this.systemConfigurationService = systemConfigurationService;
    }

    @GetMapping
    public ResponseEntity<PublicBrandingResponse> getBranding() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(systemConfigurationService.getPublicBranding());
    }
}
