package com.eqms.controller;

import com.eqms.dto.configuration.PublicBrandingResponse;
import com.eqms.service.PwaBrandingService;
import com.eqms.service.SystemConfigurationService;
import org.springframework.http.ResponseEntity;
import org.springframework.http.CacheControl;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/branding")
public class PublicBrandingController {
    private final SystemConfigurationService systemConfigurationService;
    private final PwaBrandingService pwaBranding;

    public PublicBrandingController(SystemConfigurationService systemConfigurationService, PwaBrandingService pwaBranding) {
        this.systemConfigurationService = systemConfigurationService;
        this.pwaBranding = pwaBranding;
    }

    /**
     * The web app manifest of the home-screen shortcut. A phone asks for it before anyone signs in. It is revalidated on every use (an ETag answers 304 when
     * nothing changed), so a new icon reaches a phone the next time it looks.
     */
    @GetMapping(value = "/pwa/manifest.webmanifest", produces = "application/manifest+json")
    public ResponseEntity<String> manifest() {
        PwaBrandingService.Source source = systemConfigurationService.getPwaBrandingSource();
        String body = pwaBranding.manifest(source);
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noCache())
                .eTag("\"" + pwaBranding.version(source) + "\"")
                .contentType(org.springframework.http.MediaType.parseMediaType("application/manifest+json"))
                .body(body);
    }

    /** One size of the shortcut icon. Without a custom icon the built-in one is used, so the address never stops working. */
    @GetMapping("/pwa/icon/{name}")
    public ResponseEntity<byte[]> pwaIcon(@PathVariable String name) {
        PwaBrandingService.Source source = systemConfigurationService.getPwaBrandingSource();
        return pwaBranding.icon(source, name)
                .map(bytes -> ResponseEntity.ok()
                        .cacheControl(CacheControl.noCache())
                        .eTag("\"" + pwaBranding.version(source) + "-" + name + "\"")
                        .contentType(org.springframework.http.MediaType.IMAGE_PNG)
                        .body(bytes))
                .orElseGet(() -> pwaBranding.hasCustomIcon(source)
                        ? ResponseEntity.notFound().build()
                        : ResponseEntity.status(org.springframework.http.HttpStatus.FOUND).header("Location", "/icons/apple-touch-icon.png").<byte[]>build());
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
