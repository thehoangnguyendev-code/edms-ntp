package com.eqms.controller;

import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.service.OnlyOfficeDocumentEditService;
import com.eqms.service.RevisionService;
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
 * Two endpoints reached by the {@code onlyoffice-documentserver} container itself, not by a
 * logged-in browser -- both authenticated by the short-lived, revision-scoped JWT minted in
 * {@code OnlyOfficeDocumentEditService#buildEditorConfig} (query param {@code token}), not by an
 * EQMS session cookie. Registered under {@code /onlyoffice/**}, permitted in
 * {@code SecurityConfig} the same way the controlled-copy portal's signed-token links are --
 * see that class's comment for the precedent.
 *
 * <p>The session-authenticated "open an editing session" endpoint lives on
 * {@link RevisionController} instead (under {@code /revisions/{id}/onlyoffice/edit-config}),
 * since that one IS called by a logged-in browser and needs the normal permission/session stack.
 */
@RestController
@RequestMapping("/onlyoffice")
public class OnlyOfficeController {

    private static final Logger log = LoggerFactory.getLogger(OnlyOfficeController.class);

    private final RevisionService revisionService;
    private final OnlyOfficeDocumentEditService onlyOfficeDocumentEditService;

    public OnlyOfficeController(RevisionService revisionService, OnlyOfficeDocumentEditService onlyOfficeDocumentEditService) {
        this.revisionService = revisionService;
        this.onlyOfficeDocumentEditService = onlyOfficeDocumentEditService;
    }

    /** OnlyOffice's initial fetch of the document to edit. */
    @GetMapping("/source-file/{revisionId}")
    public ResponseEntity<byte[]> sourceFile(@PathVariable UUID revisionId, @RequestParam String token) throws Exception {
        DocumentRevisionRecord revision = revisionService.requireRevisionForOnlyOfficeToken(revisionId, token);
        byte[] content = revisionService.readCurrentSourceFileBytes(revision);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(content);
    }

    /**
     * OnlyOffice's ConvertService fetch of an arbitrary local temp file (not a revision's own
     * stored source) -- see {@code OnlyOfficeDocumentEditService#convertLocalFileToPdf}, used by
     * the e-signature preview and publishing/template PDF renderers.
     */
    @GetMapping("/local-file")
    public ResponseEntity<byte[]> localFile(@RequestParam String token) throws Exception {
        java.nio.file.Path path = onlyOfficeDocumentEditService.verifyLocalFileToken(token);
        byte[] content = java.nio.file.Files.readAllBytes(path);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(content);
    }

    /**
     * OnlyOffice's save webhook. Must always return {@code {"error": 0}} on the HTTP 200 body
     * (per OnlyOffice's own protocol) even when EQMS-side processing fails, or the document
     * server will endlessly retry the same callback.
     */
    @PostMapping("/callback/{revisionId}")
    public ResponseEntity<Map<String, Object>> callback(
            @PathVariable UUID revisionId,
            @RequestParam String token,
            @RequestBody JsonNode body
    ) {
        int errorCode = 0;
        try {
            int status = body.path("status").asInt(-1);
            log.info("OnlyOffice callback for revision {}: status={} key={}", revisionId, status, body.path("key").asText(""));
            if (status == OnlyOfficeDocumentEditService.STATUS_SAVE || status == OnlyOfficeDocumentEditService.STATUS_FORCE_SAVE) {
                String fileUrl = body.path("url").asText(null);
                if (fileUrl == null || fileUrl.isBlank()) {
                    throw new IllegalStateException("OnlyOffice callback did not include a file url");
                }
                byte[] editedContent = onlyOfficeDocumentEditService.downloadCallbackFile(fileUrl);
                revisionService.applyOnlyOfficeCallback(revisionId, token, editedContent, resolveEditingUserId(body));
            }
        } catch (Exception ex) {
            // Logged, not rethrown -- OnlyOffice's protocol only inspects the {"error": ...} body
            // field, and a non-zero error here just makes it retry the identical callback rather
            // than surface the failure to the editing user. Operators should watch this log for
            // repeated callback failures instead.
            log.error("OnlyOffice save-callback failed for revision {}: {}", revisionId, ex.toString(), ex);
            // Tell OnlyOffice the save failed so it keeps the edited document and retries,
            // instead of discarding the user's edits after a false "saved" acknowledgement.
            errorCode = 1;
        }
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("error", errorCode);
        return ResponseEntity.ok(response);
    }

    /**
     * The document server lists, in the callback body, the ids of the users who edited the document
     * (the ids our editor config supplied). The last one is the person whose changes are being saved,
     * which is who the sync-back must be attributed to -- the URL token only says who opened the
     * session first, which for a shared (co-editing / live-view) session may be a viewer.
     */
    private UUID resolveEditingUserId(JsonNode body) {
        JsonNode users = body.path("users");
        if (!users.isArray()) {
            return null;
        }
        for (int i = users.size() - 1; i >= 0; i--) {
            try {
                return UUID.fromString(users.get(i).asText(""));
            } catch (IllegalArgumentException ignored) {
                // not one of our user ids; try the previous entry
            }
        }
        return null;
    }
}
