package com.eqms.controller;

import com.eqms.dto.configuration.PublicBrandingResponse;
import com.eqms.service.PwaBrandingService;
import com.eqms.service.SystemConfigurationService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.ResponseEntity;
import org.springframework.http.CacheControl;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

@RestController
@RequestMapping("/branding")
public class PublicBrandingController {
    private final SystemConfigurationService systemConfigurationService;
    private final PwaBrandingService pwaBranding;
    private final ObjectMapper objectMapper;

    public PublicBrandingController(SystemConfigurationService systemConfigurationService, PwaBrandingService pwaBranding, ObjectMapper objectMapper) {
        this.systemConfigurationService = systemConfigurationService;
        this.pwaBranding = pwaBranding;
        this.objectMapper = objectMapper;
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

    /**
     * Branding carries the logos and backgrounds as images, so it is large (hundreds of kilobytes) and every open screen asks again
     * every few seconds. It holds nothing private, so it is revalidated by its ETag instead of being refused to every cache: a
     * browser that already has the current branding gets a 304 with no body, and a changed branding gets a new ETag at once.
     */
    @GetMapping
    public ResponseEntity<PublicBrandingResponse> getBranding() {
        PublicBrandingResponse branding = systemConfigurationService.getPublicBranding();
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noCache())
                .eTag("\"" + contentVersion(branding) + "\"")
                .body(branding);
    }

    /** A digest of the exact content that is sent, so the ETag changes if and only if the branding the browser would draw changes. */
    private String contentVersion(PublicBrandingResponse branding) {
        try {
            byte[] json = objectMapper.writeValueAsBytes(branding);
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(json));
        } catch (JsonProcessingException | NoSuchAlgorithmException e) {
            throw new IllegalStateException("Cannot version the public branding", e);
        }
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
