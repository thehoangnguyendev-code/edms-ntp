package com.eqms.service;

import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.UserAccount;
import com.eqms.service.editprovider.EditMode;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import javax.crypto.SecretKey;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

/**
 * Builds OnlyOffice Document Server editor configs and handles its save-callback -- the
 * OnlyOffice-specific counterpart to {@code MicrosoftGraphOfficeOnlineService}. Unlike Graph
 * (EQMS pulls the edited file from a Graph drive item on an explicit "sync-back" call),
 * OnlyOffice pushes the finished file to a webhook EQMS exposes
 * ({@code OnlyOfficeCallbackController}), so this service also verifies that inbound callback's
 * JWT and fetches the edited bytes from the URL OnlyOffice provides in its callback payload.
 */
@Service
public class OnlyOfficeDocumentEditService {

    private static final Logger log = LoggerFactory.getLogger(OnlyOfficeDocumentEditService.class);
    /** OnlyOffice callback status: document is ready to be saved. */
    public static final int STATUS_SAVE = 2;
    /** OnlyOffice callback status: document is ready to be saved after a force-save request. */
    public static final int STATUS_FORCE_SAVE = 6;

    private final OnlyOfficeConfigurationService configurationService;
    private final SystemConfigurationService systemConfigurationService;
    private final ObjectMapper objectMapper;
    // Forced to HTTP/1.1: OnlyOffice's bundled nginx returns 502 on java.net.http.HttpClient's
    // default plaintext HTTP/2 upgrade attempt (see SettingsUserController#testOnlyOfficeConnection
    // for the same fix and a fuller explanation).
    private final HttpClient httpClient = HttpClient.newBuilder()
            .version(HttpClient.Version.HTTP_1_1)
            .connectTimeout(Duration.ofSeconds(15))
            .build();

    public OnlyOfficeDocumentEditService(
            OnlyOfficeConfigurationService configurationService,
            SystemConfigurationService systemConfigurationService,
            ObjectMapper objectMapper
    ) {
        this.configurationService = configurationService;
        this.systemConfigurationService = systemConfigurationService;
        this.objectMapper = objectMapper;
    }

    public boolean isConfigured() {
        OnlyOfficeConfigurationService.OnlyOfficeConfiguration config = configurationService.getEffectiveConfiguration();
        return config.enabled()
                && StringUtils.hasText(config.documentServerUrl())
                && StringUtils.hasText(config.jwtSecret());
    }

    /**
     * Builds the full editor config the frontend passes to {@code DocsAPI.DocEditor(...)},
     * including a signed {@code token} claim inside the config itself (OnlyOffice's own JWT
     * convention -- the token signs the config object, not a bearer header, when embedding the
     * editor). Also mints a short-lived, revision-scoped access token used to authenticate the
     * document-server-to-EQMS calls (source file fetch + save callback), since those requests
     * carry no EQMS session.
     */
    public ObjectNode buildEditorConfig(DocumentRevisionRecord revision, EditMode mode, UserAccount currentUser) {
        OnlyOfficeConfigurationService.OnlyOfficeConfiguration config = configurationService.getEffectiveConfiguration();
        if (!config.enabled() || !StringUtils.hasText(config.jwtSecret())) {
            throw new IllegalStateException("OnlyOffice Document Server is not configured");
        }

        String accessToken = mintAccessToken(revision.getId(), currentUser.getId(), config.jwtSecret());
        String fileName = StringUtils.hasText(revision.getFileName()) ? revision.getFileName() : "revision.docx";
        // A viewer deliberately shares the editing session's key: OnlyOffice then shows the editors'
        // changes to the viewer live, as they are typed (the Document tab is "real time"). Because the
        // first opener of a key decides its save callback, viewers get the callback URL too, so an
        // editor who joins a session a viewer started can never lose their saves. The callback resolves
        // the real editing user from the callback body, so a viewer's token is not blamed for the edits.
        String documentKey = buildDocumentKey(revision);

        ObjectNode documentNode = objectMapper.createObjectNode();
        documentNode.put("fileType", fileExtension(fileName));
        documentNode.put("key", documentKey);
        documentNode.put("title", fileName);
        documentNode.put("url", config.callbackBaseUrl() + "/onlyoffice/source-file/" + revision.getId() + "?token=" + accessToken);

        ObjectNode permissions = objectMapper.createObjectNode();
        // REVIEW: edit=false + review=true is how OnlyOffice pins a user to "Reviewing" (track
        // changes only) -- with edit=true the editor starts in "Editing" and lets them switch
        // freely, which defeats the reviewer restriction.
        permissions.put("edit", mode == EditMode.EDIT);
        permissions.put("review", mode == EditMode.REVIEW);
        permissions.put("comment", mode != EditMode.VIEW);
        permissions.put("download", mode != EditMode.VIEW);
        permissions.put("print", mode != EditMode.VIEW);
        documentNode.set("permissions", permissions);

        ObjectNode editorConfigNode = objectMapper.createObjectNode();
        editorConfigNode.put("mode", mode == EditMode.VIEW ? "view" : "edit"); // for edit modes OnlyOffice enforces the actual restriction via `permissions`/coEditing
        editorConfigNode.put("callbackUrl", config.callbackBaseUrl() + "/onlyoffice/callback/" + revision.getId() + "?token=" + accessToken);
        ObjectNode user = objectMapper.createObjectNode();
        user.put("id", currentUser.getId().toString());
        user.put("name", currentUser.getFullName());
        editorConfigNode.set("user", user);

        ObjectNode customization = objectMapper.createObjectNode();
        if (mode == EditMode.REVIEW) {
            customization.put("forcesave", true);
            ObjectNode review = objectMapper.createObjectNode();
            review.put("trackChanges", true);
            review.put("reviewDisplay", "markup");
            customization.set("review", review);
        }
        if (mode == EditMode.VIEW) {
            // Which parts of OnlyOffice's toolbar the read-only viewer shows is an admin setting
            // (Settings > Configuration > OnlyOffice > Document viewer toolbar).
            applyViewerOptions(customization, configurationService.getViewerOptions());
        }
        // Logo is referenced by URL (supplied by the browser as ?logoUrl=, pointing at
        // /branding/logo). Embedding the stored data: URI made the signed config huge and caused
        // HTTP 414 Request-URI Too Large in the editor.
        String logoUrl = requestedLogoUrl();
        if (StringUtils.hasText(logoUrl) && systemConfigurationService.getPublicBranding().systemLogo() != null) {
            ObjectNode logo = objectMapper.createObjectNode();
            logo.put("image", logoUrl);
            logo.put("imageEmbedded", logoUrl);
            customization.set("logo", logo);
        }
        editorConfigNode.set("customization", customization);

        ObjectNode rootConfig = objectMapper.createObjectNode();
        rootConfig.put("documentType", "word");
        rootConfig.set("document", documentNode);
        rootConfig.set("editorConfig", editorConfigNode);
        rootConfig.put("token", signConfig(rootConfig, config.jwtSecret()));
        return rootConfig;
    }

    /**
     * Maps only the settings supported by the bundled OnlyOffice Community Edition. The per-tab/panel
     * {@code layout} controls require a White Label license, so sending them gives an administrator a
     * misleading configuration that the Document Server silently ignores.
     */
    private void applyViewerOptions(ObjectNode customization, OnlyOfficeConfigurationService.ViewerOptions options) {
        customization.put("toolbarHideFileName", !options.showFileName());
        // toolbarHideFileName is applied by OnlyOffice only with its compact header enabled.
        customization.put("compactHeader", !options.showFileName());
        customization.put("hideRightMenu", !options.showRightMenu());
        customization.put("plugins", options.showPluginsTab());
    }

    /** Verifies an access token minted by {@link #buildEditorConfig} for the given revision. */
    public UUID verifyAccessToken(UUID revisionId, String token) {
        OnlyOfficeConfigurationService.OnlyOfficeConfiguration config = configurationService.getEffectiveConfiguration();
        if (!StringUtils.hasText(token) || !StringUtils.hasText(config.jwtSecret())) {
            throw new IllegalStateException("OnlyOffice access token missing or provider not configured");
        }
        SecretKey key = Keys.hmacShaKeyFor(config.jwtSecret().getBytes(StandardCharsets.UTF_8));
        var claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
        String subjectRevisionId = claims.get("rev", String.class);
        if (!revisionId.toString().equals(subjectRevisionId)) {
            throw new IllegalStateException("OnlyOffice access token does not match this revision");
        }
        return UUID.fromString(claims.getSubject());
    }

    /** Downloads the edited file OnlyOffice reports as ready in its save-callback payload. */
    public byte[] downloadCallbackFile(String url) throws java.io.IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder(URI.create(toInternalDocumentServerUrl(url))).GET().build();
        HttpResponse<byte[]> response = httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());
        if (response.statusCode() / 100 != 2) {
            throw new java.io.IOException("OnlyOffice callback file download failed: HTTP " + response.statusCode());
        }
        return response.body();
    }

    /**
     * Asks the document server to push any unsaved edits of this revision's open editing session to
     * our save-callback right now (Command Service {@code forcesave}) instead of waiting for the
     * last user to leave. Returns the Command Service error code: 0 = save triggered (the callback
     * follows asynchronously), 1 = no such session/key, 4 = nothing changed since the last save --
     * the last two both mean there is nothing pending to flush.
     */
    public int sendForceSave(DocumentRevisionRecord revision) {
        ObjectNode body = objectMapper.createObjectNode();
        body.put("c", "forcesave");
        body.put("key", buildDocumentKey(revision));
        return sendCommand(body);
    }

    /** The key an editing session opened for this revision right now would use (changes whenever the stored source changes). */
    public String currentDocumentKey(DocumentRevisionRecord revision) {
        return buildDocumentKey(revision);
    }

    /**
     * Disconnects everyone from the editing session with this key (Command Service {@code drop}) so a
     * stale editor cannot keep changing a revision that has just moved to another workflow stage.
     * Best-effort: 1 (no such session) is the normal outcome when nobody has it open.
     */
    public int dropSession(String documentKey) {
        ObjectNode body = objectMapper.createObjectNode();
        body.put("c", "drop");
        body.put("key", documentKey);
        return sendCommand(body);
    }

    private int sendCommand(ObjectNode body) {
        OnlyOfficeConfigurationService.OnlyOfficeConfiguration config = configurationService.getEffectiveConfiguration();
        if (!config.enabled() || !StringUtils.hasText(config.jwtSecret()) || !StringUtils.hasText(config.documentServerUrl())) {
            throw new IllegalStateException("OnlyOffice Document Server is not configured");
        }
        ObjectNode headerPayload = objectMapper.createObjectNode();
        headerPayload.set("payload", body.deepCopy());
        ObjectNode signedBody = body.deepCopy();
        signedBody.put("token", signConfig(body, config.jwtSecret()));
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(trimTrailingSlash(config.documentServerUrl()) + "/coauthoring/CommandService.ashx"))
                    .timeout(Duration.ofSeconds(20))
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .header("Authorization", "Bearer " + signConfig(headerPayload, config.jwtSecret()))
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(signedBody)))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() / 100 != 2) {
                throw new java.io.IOException("OnlyOffice CommandService returned HTTP " + response.statusCode());
            }
            return objectMapper.readTree(response.body()).path("error").asInt(-1);
        } catch (java.io.IOException | InterruptedException ex) {
            if (ex instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            throw new IllegalStateException("Failed to reach OnlyOffice CommandService", ex);
        }
    }

    /** Connection usage of the document server; a limit or usage of -1 means unknown. */
    public record Capacity(int editUsed, int editLimit, int viewUsed, int viewLimit) {}

    private volatile Capacity cachedCapacity;
    private volatile long cachedCapacityAt;

    /**
     * Current connection usage against the document server's licence limit (Community Edition allows
     * only a small number of simultaneous connections). Read from the server's own /info/info.json,
     * cached for a few seconds, and never throws: an unreachable or unreadable server yields "unknown".
     */
    public Capacity getCapacity() {
        long now = System.currentTimeMillis();
        Capacity cached = cachedCapacity;
        if (cached != null && now - cachedCapacityAt < 8_000) {
            return cached;
        }
        Capacity result = new Capacity(-1, -1, -1, -1);
        try {
            OnlyOfficeConfigurationService.OnlyOfficeConfiguration config = configurationService.getEffectiveConfiguration();
            if (config.enabled() && StringUtils.hasText(config.documentServerUrl())) {
                HttpRequest request = HttpRequest.newBuilder(URI.create(trimTrailingSlash(config.documentServerUrl()) + "/info/info.json"))
                        .timeout(Duration.ofSeconds(3)).GET().build();
                HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
                if (response.statusCode() / 100 == 2) {
                    JsonNode root = objectMapper.readTree(response.body());
                    result = new Capacity(
                            root.path("quota").path("edit").path("connectionsCount").asInt(-1),
                            root.path("licenseInfo").path("connections").asInt(-1),
                            root.path("quota").path("view").path("connectionsCount").asInt(-1),
                            root.path("licenseInfo").path("connectionsView").asInt(-1));
                }
            }
        } catch (Exception ex) {
            if (ex instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
        }
        cachedCapacity = result;
        cachedCapacityAt = now;
        return result;
    }

    /**
     * The document server builds the file URLs it hands back (save-callback {@code url}, ConvertService
     * {@code fileUrl}) from the Host header of whoever called it -- for an editing session that is the
     * browser's public address (e.g. http://localhost:8082), which this backend container cannot reach.
     * That silently dropped every edit (ConnectException, swallowed by the callback controller). Keep the
     * path/query but point scheme+host at the internally configured document server address.
     */
    private String toInternalDocumentServerUrl(String url) {
        String base = configurationService.getEffectiveConfiguration().documentServerUrl();
        if (!StringUtils.hasText(base)) {
            return url;
        }
        URI original = URI.create(url);
        URI internal = URI.create(trimTrailingSlash(base));
        StringBuilder rebuilt = new StringBuilder(internal.getScheme()).append("://").append(internal.getRawAuthority());
        if (original.getRawPath() != null) {
            rebuilt.append(original.getRawPath());
        }
        if (original.getRawQuery() != null) {
            rebuilt.append('?').append(original.getRawQuery());
        }
        return internal.getScheme() == null ? url : rebuilt.toString();
    }

    /**
     * Converts the revision's current source file to PDF via OnlyOffice's synchronous
     * ConvertService, mirroring what {@code MicrosoftGraphOfficeOnlineService#convertToPdf} does
     * for Graph. Points ConvertService at our own {@code source-file} endpoint (same one the
     * editor uses to fetch content) rather than uploading the file to the document server first,
     * since ConvertService already supports pulling from an arbitrary URL.
     */
    public byte[] convertToPdf(DocumentRevisionRecord revision) {
        OnlyOfficeConfigurationService.OnlyOfficeConfiguration config = configurationService.getEffectiveConfiguration();
        if (!config.enabled() || !StringUtils.hasText(config.jwtSecret()) || !StringUtils.hasText(config.documentServerUrl())) {
            throw new IllegalStateException("OnlyOffice Document Server is not configured");
        }

        String fileName = StringUtils.hasText(revision.getFileName()) ? revision.getFileName() : "revision.docx";
        // A read-only pull for conversion doesn't act on behalf of a specific person, so the
        // access token's subject is a synthetic id rather than a real user -- resolveOnlyOfficeTokenUser
        // is never called for this token, only the source-file endpoint's verifyAccessToken.
        String accessToken = mintAccessToken(revision.getId(), UUID.randomUUID(), config.jwtSecret());

        ObjectNode requestBody = objectMapper.createObjectNode();
        requestBody.put("async", false);
        requestBody.put("filetype", fileExtension(fileName));
        requestBody.put("outputtype", "pdf");
        requestBody.put("key", buildDocumentKey(revision) + "-pdf");
        requestBody.put("title", fileName);
        requestBody.put("url", config.callbackBaseUrl() + "/onlyoffice/source-file/" + revision.getId() + "?token=" + accessToken);
        requestBody.put("token", signConfig(requestBody, config.jwtSecret()));

        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(trimTrailingSlash(config.documentServerUrl()) + "/ConvertService.ashx"))
                    .timeout(Duration.ofMinutes(3))
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(requestBody)))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() / 100 != 2) {
                throw new java.io.IOException("OnlyOffice ConvertService returned HTTP " + response.statusCode() + ": " + response.body());
            }
            JsonNode result = objectMapper.readTree(response.body());
            if (result.path("error").asInt(0) != 0) {
                throw new java.io.IOException("OnlyOffice ConvertService reported error code " + result.path("error").asInt());
            }
            String pdfUrl = result.path("fileUrl").asText(null);
            if (!StringUtils.hasText(pdfUrl)) {
                throw new java.io.IOException("OnlyOffice ConvertService did not return a fileUrl");
            }
            return downloadCallbackFile(pdfUrl);
        } catch (java.io.IOException | InterruptedException ex) {
            if (ex instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            throw new IllegalStateException("Failed to convert revision file to PDF via OnlyOffice", ex);
        }
    }

    /**
     * Converts an arbitrary local file (not necessarily a revision's canonical MinIO-stored
     * source -- e.g. a freshly-rendered publishing template or e-signature preview sitting in a
     * temp file) to PDF, the same way {@link #convertToPdf} does for a revision's own file.
     * Points ConvertService at a short-lived {@code /onlyoffice/local-file} URL, signed with a
     * JWT whose claim is the file's own path -- OnlyOffice never sees or needs the path itself,
     * only the token, and the token is only ever valid for the one file it was minted for.
     */
    public byte[] convertLocalFileToPdf(java.nio.file.Path localPath, String fileName) {
        OnlyOfficeConfigurationService.OnlyOfficeConfiguration config = configurationService.getEffectiveConfiguration();
        if (!config.enabled() || !StringUtils.hasText(config.jwtSecret()) || !StringUtils.hasText(config.documentServerUrl())) {
            throw new IllegalStateException("OnlyOffice Document Server is not configured");
        }

        String accessToken = mintLocalFileToken(localPath, config.jwtSecret());

        ObjectNode requestBody = objectMapper.createObjectNode();
        requestBody.put("async", false);
        requestBody.put("filetype", fileExtension(fileName));
        requestBody.put("outputtype", "pdf");
        requestBody.put("key", UUID.randomUUID().toString());
        requestBody.put("title", fileName);
        requestBody.put("url", config.callbackBaseUrl() + "/onlyoffice/local-file?token=" + accessToken);
        requestBody.put("token", signConfig(requestBody, config.jwtSecret()));

        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(trimTrailingSlash(config.documentServerUrl()) + "/ConvertService.ashx"))
                    .timeout(Duration.ofMinutes(3))
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(requestBody)))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() / 100 != 2) {
                throw new java.io.IOException("OnlyOffice ConvertService returned HTTP " + response.statusCode() + ": " + response.body());
            }
            JsonNode result = objectMapper.readTree(response.body());
            if (result.path("error").asInt(0) != 0) {
                throw new java.io.IOException("OnlyOffice ConvertService reported error code " + result.path("error").asInt());
            }
            String pdfUrl = result.path("fileUrl").asText(null);
            if (!StringUtils.hasText(pdfUrl)) {
                throw new java.io.IOException("OnlyOffice ConvertService did not return a fileUrl");
            }
            return downloadCallbackFile(pdfUrl);
        } catch (java.io.IOException | InterruptedException ex) {
            if (ex instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            throw new IllegalStateException("Failed to convert local file to PDF via OnlyOffice", ex);
        }
    }

    /** Verifies a token minted by {@link #convertLocalFileToPdf} and returns the file path it authorizes. */
    public java.nio.file.Path verifyLocalFileToken(String token) {
        OnlyOfficeConfigurationService.OnlyOfficeConfiguration config = configurationService.getEffectiveConfiguration();
        if (!StringUtils.hasText(token) || !StringUtils.hasText(config.jwtSecret())) {
            throw new IllegalStateException("OnlyOffice access token missing or provider not configured");
        }
        SecretKey key = Keys.hmacShaKeyFor(config.jwtSecret().getBytes(StandardCharsets.UTF_8));
        var claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
        if (!"local-file".equals(claims.get("purpose", String.class))) {
            throw new IllegalStateException("Token is not a local-file conversion token");
        }
        return java.nio.file.Path.of(claims.getSubject());
    }

    private String mintLocalFileToken(java.nio.file.Path localPath, String jwtSecret) {
        SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(localPath.toAbsolutePath().toString())
                .claim("purpose", "local-file")
                .issuedAt(Date.from(now))
                // Only needs to survive one synchronous ConvertService round-trip.
                .expiration(Date.from(now.plus(Duration.ofMinutes(5))))
                .signWith(key)
                .compact();
    }

    private String trimTrailingSlash(String url) {
        return url != null && url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }

    private String mintAccessToken(UUID revisionId, UUID userId, String jwtSecret) {
        SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(userId.toString())
                .claim("rev", revisionId.toString())
                .issuedAt(Date.from(now))
                // Edit sessions are expected to be short-lived (open, edit, close) -- 8h covers a
                // full working session without leaving a long-lived credential outstanding.
                .expiration(Date.from(now.plus(Duration.ofHours(8))))
                .signWith(key)
                .compact();
    }

    /** OnlyOffice's own convention: the JWT payload IS the config object being signed. */
    private String signConfig(JsonNode config, String jwtSecret) {
        SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
        var builder = Jwts.builder();
        config.properties().forEach(entry -> builder.claim(entry.getKey(), objectMapper.convertValue(entry.getValue(), Object.class)));
        return builder.signWith(key).compact();
    }

    /**
     * Must change every time the document's content changes (OnlyOffice requirement -- reusing a
     * key across saves causes it to serve a cached version). Derived from the revision id plus
     * its current storage sync timestamp rather than a separate counter column, since that
     * timestamp already changes on every successful sync-back.
     */
    private String buildDocumentKey(DocumentRevisionRecord revision) {
        // Must be IDENTICAL for every concurrent opener of the same not-yet-saved content, or
        // OnlyOffice treats each open as a separate document and real-time co-editing between
        // Author/Co-Author never syncs (each participant only sees their own local edits). Falling
        // back to Instant.now() here was the bug: two users opening the same fresh revision even a
        // second apart got two different keys. Use the revision's own stable timestamps instead --
        // they only change when the content actually changes (a new source upload, or a prior
        // OnlyOffice save-callback), never on every open.
        Instant stableInstant = revision.getStorageLastSyncedAt() != null
                ? revision.getStorageLastSyncedAt()
                : revision.getSourceUploadedAt() != null
                        ? revision.getSourceUploadedAt()
                        : revision.getUpdatedAt() != null
                                ? revision.getUpdatedAt()
                                : revision.getCreatedAt();
        String suffix = stableInstant != null ? String.valueOf(stableInstant.toEpochMilli()) : "0";
        // The stored source's checksum ties the key to the actual bytes: ConvertService and the
        // editing session both cache by key, so a key that survives a content change (e.g. a
        // replaced/synced source) serves a stale document or PDF.
        String checksum = revision.getSourceFileChecksum();
        if (checksum != null && checksum.length() >= 12) {
            suffix = suffix + "-" + checksum.substring(0, 12);
        }
        String raw = revision.getId() + "-" + suffix;
        // OnlyOffice keys are capped at 128 chars and must be filesystem/URL-safe.
        return raw.length() > 128 ? raw.substring(0, 128) : raw;
    }

    private String requestedLogoUrl() {
        var attrs = org.springframework.web.context.request.RequestContextHolder.getRequestAttributes();
        if (attrs instanceof org.springframework.web.context.request.ServletRequestAttributes sra) {
            String v = sra.getRequest().getParameter("logoUrl");
            if (v != null && (v.startsWith("http://") || v.startsWith("https://")) && v.length() < 500) {
                return v;
            }
        }
        return null;
    }

    private String fileExtension(String fileName) {
        int dot = fileName.lastIndexOf('.');
        return dot >= 0 && dot < fileName.length() - 1 ? fileName.substring(dot + 1).toLowerCase() : "docx";
    }
}
