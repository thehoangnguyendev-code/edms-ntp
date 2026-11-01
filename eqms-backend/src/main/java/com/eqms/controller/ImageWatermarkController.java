package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.entity.UserAccount;
import com.eqms.service.ImageWatermarkService;
import com.eqms.service.PermissionEvaluationService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Instant;

/**
 * Previews of the image watermark. Nothing is stored: the picture is stamped by the same code as a real upload and sent back. {@code config-preview} tries settings that are not saved yet
 * (the Configuration screen) on a sample or on a picture the administrator chose; {@code upload-preview} shows the signed-in user the stamp that the saved settings would put on the picture
 * they are about to upload. The time in the stamp is the time of the preview; the real upload writes its own.
 */
@RestController
@RequestMapping("/image-watermark")
public class ImageWatermarkController {
    private static final long MAX_BYTES = 10L * 1024L * 1024L;

    private final ImageWatermarkService watermark;
    private final CurrentUserService currentUser;
    private final PermissionEvaluationService permissions;
    private final ObjectMapper objectMapper;

    public ImageWatermarkController(ImageWatermarkService watermark, CurrentUserService currentUser, PermissionEvaluationService permissions, ObjectMapper objectMapper) {
        this.watermark = watermark;
        this.currentUser = currentUser;
        this.permissions = permissions;
        this.objectMapper = objectMapper;
    }

    @PostMapping(value = "/config-preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<byte[]> configPreview(@RequestParam String target, @RequestParam String settings, @RequestParam(value = "file", required = false) MultipartFile file) throws IOException {
        UserAccount user = currentUser.requireCurrentUser();
        if (!permissions.hasPermission(user, "settings.configuration.manage")) throw new AccessDeniedException("Configuration permission required");
        ImageWatermarkService.Target kind = ImageWatermarkService.Target.fromKey(target);
        JsonNode draft = objectMapper.readTree(settings);
        byte[] picture = file == null || file.isEmpty() ? watermark.sample(kind) : bytesOf(file);
        return respond(watermark.apply(watermark.draft(kind, draft), picture, new ImageWatermarkService.Stamp(user.getFullName(), Instant.now())));
    }

    @PostMapping(value = "/upload-preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<byte[]> uploadPreview(@RequestParam String target, @RequestParam("file") MultipartFile file) throws IOException {
        UserAccount user = currentUser.requireCurrentUser();
        ImageWatermarkService.Target kind = ImageWatermarkService.Target.fromKey(target);
        return respond(watermark.apply(kind, bytesOf(file), new ImageWatermarkService.Stamp(user.getFullName(), Instant.now())));
    }

    private static byte[] bytesOf(MultipartFile file) throws IOException {
        if (file.getSize() > MAX_BYTES) throw new IllegalArgumentException("The picture exceeds the maximum allowed size of 10 MB");
        return file.getBytes();
    }

    private ResponseEntity<byte[]> respond(ImageWatermarkService.Result result) {
        ResponseEntity.BodyBuilder builder = ResponseEntity.ok().contentType(MediaType.parseMediaType(result.contentType())).cacheControl(CacheControl.noStore())
                .header("X-Watermark-Applied", String.valueOf(result.applied()))
                .header("Access-Control-Expose-Headers", "X-Watermark-Applied, X-Watermark-Note");
        if (result.note() != null) builder = builder.header("X-Watermark-Note", result.note());
        return builder.body(result.bytes());
    }
}
