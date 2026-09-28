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

    @GetMapping("/logo")
    public ResponseEntity<byte[]> getLogo() {
        String data = systemConfigurationService.getPublicBranding().systemLogo();
        if (data == null || !data.startsWith("data:") || !data.contains(";base64,")) {
            return ResponseEntity.notFound().build();
        }
        int i = data.indexOf(";base64,");
        String mime = data.substring(5, i);
        byte[] bytes = java.util.Base64.getDecoder().decode(data.substring(i + 8));
        return ResponseEntity.ok()
                .contentType(org.springframework.http.MediaType.parseMediaType(mime))
                .cacheControl(CacheControl.noCache())
                .body(bytes);
    }
}
