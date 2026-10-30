package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.repository.SystemConfigurationRepository;
import com.eqms.service.AuthBackgroundVideoStore;
import com.eqms.service.AuthBackgroundVideoTranscoder;
import com.eqms.service.PermissionEvaluationService;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;
import java.util.UUID;

@RestController
public class AuthBackgroundVideoController {
    private final AuthBackgroundVideoStore store;
    private final AuthBackgroundVideoTranscoder transcoder;
    private final CurrentUserService currentUser;
    private final PermissionEvaluationService permissions;
    private final SystemConfigurationRepository configurations;

    public AuthBackgroundVideoController(AuthBackgroundVideoStore store, AuthBackgroundVideoTranscoder transcoder, CurrentUserService currentUser, PermissionEvaluationService permissions, SystemConfigurationRepository configurations) {
        this.store = store; this.transcoder = transcoder; this.currentUser = currentUser; this.permissions = permissions; this.configurations = configurations;
    }
    private void requireManage() {
        if (!permissions.hasPermission(currentUser.requireCurrentUser(), "settings.configuration.manage")) throw new AccessDeniedException("Configuration permission required");
    }
    @PostMapping(value = "/settings/system/auth-background-video", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, String> upload(@RequestParam("video") MultipartFile video) throws IOException {
        requireManage();
        return Map.of("id", store.save(currentUser.requireCurrentUser().getId(), transcoder.transcode(video)).toString());
    }
    @GetMapping("/settings/system/auth-background-video/{id}")
    public ResponseEntity<byte[]> preview(@PathVariable UUID id) {
        requireManage();
        return response(id);
    }
    @GetMapping("/branding/auth-background-video/{id}")
    public ResponseEntity<byte[]> active(@PathVariable UUID id) {
        boolean active = configurations.findByConfigKey("default").map(config -> {
            var background = config.getGeneralConfig().path("appearance").path("authBackground");
            return "video".equals(background.path("mode").asText()) && id.toString().equals(background.path("videoId").asText());
        }).orElse(false);
        return active ? response(id) : ResponseEntity.notFound().build();
    }
    private ResponseEntity<byte[]> response(UUID id) {
        return store.read(id).map(bytes -> ResponseEntity.ok().contentType(MediaType.parseMediaType("video/mp4")).cacheControl(CacheControl.noStore()).body(bytes)).orElseGet(() -> ResponseEntity.notFound().build());
    }
}
