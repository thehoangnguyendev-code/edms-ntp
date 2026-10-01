package com.eqms.controller;

import com.eqms.entity.EformEditSession;
import com.eqms.service.EformEditSessionService;
import com.eqms.service.FileStorageService;
import com.eqms.service.OnlyOfficeDocumentEditService;
import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Form-session counterpart to {@link OnlyOfficeController} -- reached by the
 * {@code onlyoffice-documentserver} container itself, authenticated by the short-lived,
 * session-scoped JWT minted in {@code OnlyOfficeDocumentEditService#buildFormSessionConfig} (query
 * param {@code token} + {@code purpose}), never by an EQMS session cookie. Registered under
 * {@code /onlyoffice/forms/**}, permitted in {@code SecurityConfig} the same way
 * {@code /onlyoffice/**} already is.
 */
@RestController
@RequestMapping("/onlyoffice/forms")
public class OnlyOfficeFormSessionController {

    private static final Logger log = LoggerFactory.getLogger(OnlyOfficeFormSessionController.class);

    private final EformEditSessionService eformEditSessionService;
    private final OnlyOfficeDocumentEditService onlyOfficeDocumentEditService;
    private final FileStorageService fileStorageService;

    public OnlyOfficeFormSessionController(
            EformEditSessionService eformEditSessionService,
            OnlyOfficeDocumentEditService onlyOfficeDocumentEditService,
            FileStorageService fileStorageService
    ) {
        this.eformEditSessionService = eformEditSessionService;
        this.onlyOfficeDocumentEditService = onlyOfficeDocumentEditService;
        this.fileStorageService = fileStorageService;
    }

    /** OnlyOffice's initial fetch of the session's current file. */
    @GetMapping("/source/{sessionId}")
    public ResponseEntity<byte[]> sourceFile(
            @PathVariable UUID sessionId, @RequestParam String token, @RequestParam String purpose
    ) throws Exception {
        EformEditSession session = eformEditSessionService.requireSessionForToken(sessionId, purpose, token);
        byte[] content = fileStorageService.readFile(session.getStorageObjectKey());
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_OCTET_STREAM).body(content);
    }

    /** OnlyOffice's save webhook -- same "always return error:0" protocol as {@link OnlyOfficeController#callback}. */
    @PostMapping("/callback/{sessionId}")
    public ResponseEntity<Map<String, Object>> callback(
            @PathVariable UUID sessionId,
            @RequestParam String token,
            @RequestParam String purpose,
            @RequestBody JsonNode body
    ) {
        int errorCode = 0;
        try {
            int status = body.path("status").asInt(-1);
            log.info("OnlyOffice form-session callback for {}: status={} key={}", sessionId, status, body.path("key").asText(""));
            if (status == OnlyOfficeDocumentEditService.STATUS_SAVE || status == OnlyOfficeDocumentEditService.STATUS_FORCE_SAVE) {
                String fileUrl = body.path("url").asText(null);
                if (fileUrl == null || fileUrl.isBlank()) {
                    throw new IllegalStateException("OnlyOffice callback did not include a file url");
                }
                byte[] editedContent = onlyOfficeDocumentEditService.downloadCallbackFile(fileUrl);
                eformEditSessionService.applyCallback(sessionId, purpose, token, editedContent);
            }
        } catch (Exception ex) {
            log.error("OnlyOffice form-session save-callback failed for session {}: {}", sessionId, ex.toString(), ex);
            errorCode = 1;
        }
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("error", errorCode);
        return ResponseEntity.ok(response);
    }
}
