package com.eqms.service;

import com.eqms.config.MicrosoftGraphStorageProperties;
import com.eqms.entity.DocumentRevisionRecord;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.time.Duration;
import java.util.Base64;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class MicrosoftGraphStorageService {

    private static final Path REVISION_STORAGE_ROOT = Paths.get(System.getProperty("user.dir"), "storage", "revisions");
    private static final Logger log = LoggerFactory.getLogger(MicrosoftGraphStorageService.class);

    private final MicrosoftGraphStorageProperties properties;
    private final ObjectMapper objectMapper;
    private final StoragePathBuilder storagePathBuilder;
    private final HttpClient httpClient;

    private volatile CachedToken cachedToken;

    public MicrosoftGraphStorageService(
            MicrosoftGraphStorageProperties properties,
            ObjectMapper objectMapper,
            StoragePathBuilder storagePathBuilder
    ) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.storagePathBuilder = storagePathBuilder;
        this.httpClient = HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

    public boolean isConfigured() {
        return hasConfiguredValue(properties.getTenantId())
                && hasConfiguredValue(properties.getClientId())
                && hasConfiguredValue(properties.getClientSecret())
                && hasConfiguredValue(properties.getDriveId());
    }

    private boolean hasConfiguredValue(String value) {
        return StringUtils.hasText(value)
                && !value.trim().startsWith("TODO_REPLACE");
    }

    public SharePointSyncResult syncRevisionFile(DocumentRevisionRecord revision) {
        if (!isConfigured()) {
            return SharePointSyncResult.notConfigured();
        }
        if (revision == null || !StringUtils.hasText(revision.getFilePath())) {
            return SharePointSyncResult.failed("Revision file not available");
        }

        Path localFile = Paths.get(revision.getFilePath());
        if (!Files.exists(localFile)) {
            return SharePointSyncResult.failed("Revision file not found");
        }

        try {
            String remotePath = buildRemotePath(revision, revision.getFileName());
            ensureFolderHierarchy(remotePath);
            UploadedItem uploadedItem = uploadFile(localFile, remotePath, revision.getFileType());
            String editUrl = createSharingLink(uploadedItem.id(), "edit");
            String viewUrl = createSharingLink(uploadedItem.id(), "view");
            return SharePointSyncResult.synced(
                    properties.getSiteId(),
                    properties.getDriveId(),
                    uploadedItem.id(),
                    uploadedItem.webUrl(),
                    editUrl,
                    viewUrl,
                    null,
                    null
            );
        } catch (Exception ex) {
            return SharePointSyncResult.failed(ex.getMessage() == null ? "SharePoint sync failed" : ex.getMessage());
        }
    }

    private UploadedItem uploadFile(Path localFile, String remotePath, String contentType) throws IOException, InterruptedException {
        String token = getAccessToken();
        String uploadUrl = properties.getBaseUrl()
                + "/drives/"
                + encodePathSegment(properties.getDriveId())
                + "/root:/"
                + encodePath(remotePath)
                + ":/content";

        byte[] bytes = Files.readAllBytes(localFile);
        HttpRequest request = HttpRequest.newBuilder(URI.create(uploadUrl))
                .timeout(Duration.ofMinutes(2))
                .header("Authorization", "Bearer " + token)
                .header("Content-Type", StringUtils.hasText(contentType) ? contentType : "application/octet-stream")
                .PUT(HttpRequest.BodyPublishers.ofByteArray(bytes))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        ensureSuccess(response, "upload file to SharePoint");

        JsonNode jsonNode = objectMapper.readTree(response.body());
        String itemId = text(jsonNode, "id");
        String webUrl = text(jsonNode, "webUrl");
        if (!StringUtils.hasText(itemId)) {
            throw new IllegalStateException("SharePoint upload response missing item id");
        }
        return new UploadedItem(itemId, webUrl);
    }

    private void ensureFolderHierarchy(String remotePath) throws IOException, InterruptedException {
        if (!StringUtils.hasText(remotePath) || !remotePath.contains("/")) {
            return;
        }

        String folderPath = remotePath.substring(0, remotePath.lastIndexOf('/'));
        if (!StringUtils.hasText(folderPath)) {
            return;
        }

        String[] segments = folderPath.split("/");
        StringBuilder currentPath = new StringBuilder();
        String currentParentId = null;

        for (String rawSegment : segments) {
            if (!StringUtils.hasText(rawSegment)) {
                continue;
            }

            String segment = rawSegment.trim();
            if (!StringUtils.hasText(segment)) {
                continue;
            }

            if (currentPath.length() > 0) {
                currentPath.append('/');
            }
            currentPath.append(segment);

            JsonNode existing = getDriveItemByPath(currentPath.toString());
            if (existing != null && !existing.isMissingNode()) {
                String existingId = text(existing, "id");
                if (StringUtils.hasText(existingId)) {
                    currentParentId = existingId;
                    continue;
                }
            }

            currentParentId = createFolder(currentParentId, segment);
        }
    }

    private JsonNode getDriveItemByPath(String path) throws IOException, InterruptedException {
        String token = getAccessToken();
        String url = properties.getBaseUrl()
                + "/drives/"
                + encodePathSegment(properties.getDriveId())
                + "/root:/"
                + encodePath(path);

        HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofSeconds(30))
                .header("Authorization", "Bearer " + token)
                .GET()
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() == 404) {
            return null;
        }
        ensureSuccess(response, "resolve SharePoint folder");
        return objectMapper.readTree(response.body());
    }

    private String createFolder(String parentId, String folderName) throws IOException, InterruptedException {
        String token = getAccessToken();
        String url = StringUtils.hasText(parentId)
                ? properties.getBaseUrl()
                + "/drives/"
                + encodePathSegment(properties.getDriveId())
                + "/items/"
                + encodePathSegment(parentId)
                + "/children"
                : properties.getBaseUrl()
                + "/drives/"
                + encodePathSegment(properties.getDriveId())
                + "/root/children";

        ObjectNode body = objectMapper.createObjectNode();
        body.put("name", folderName);
        body.set("folder", objectMapper.createObjectNode());
        body.put("@microsoft.graph.conflictBehavior", "replace");

        HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofSeconds(60))
                .header("Authorization", "Bearer " + token)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body.toString()))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        ensureSuccess(response, "create SharePoint folder");
        JsonNode jsonNode = objectMapper.readTree(response.body());
        String folderId = text(jsonNode, "id");
        if (!StringUtils.hasText(folderId)) {
            throw new IllegalStateException("SharePoint folder response missing id");
        }
        return folderId;
    }

    private String createSharingLink(String itemId, String type) throws IOException, InterruptedException {
        String token = getAccessToken();
        String url = properties.getBaseUrl()
                + "/drives/"
                + encodePathSegment(properties.getDriveId())
                + "/items/"
                + encodePathSegment(itemId)
                + "/createLink";
        String payload = """
                {"type":"%s","scope":"%s"}
                """.formatted(type, StringUtils.hasText(properties.getShareLinkScope()) ? properties.getShareLinkScope() : "organization");

        HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofSeconds(60))
                .header("Authorization", "Bearer " + token)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(payload))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IllegalStateException("Failed to create SharePoint sharing link (HTTP " + response.statusCode() + "): " + extractGraphError(response.body()));
        }

        JsonNode jsonNode = objectMapper.readTree(response.body());
        JsonNode linkNode = jsonNode.path("link");
        String webUrl = text(linkNode, "webUrl");
        if (!StringUtils.hasText(webUrl)) {
            throw new IllegalStateException("SharePoint link response missing webUrl");
        }
        return webUrl;
    }

    public Path generatePdfPreview(DocumentRevisionRecord revision) throws IOException, InterruptedException {
        if (!isConfigured()) {
            throw new IllegalStateException("Microsoft Graph storage is not configured");
        }
        if (revision == null || !StringUtils.hasText(revision.getStorageItemId())) {
            throw new IllegalArgumentException("Revision is not linked to SharePoint");
        }
        return generatePdfPreview(revision.getStorageItemId(), revision);
    }

    private Path generatePdfPreview(String itemId, DocumentRevisionRecord revision) throws IOException, InterruptedException {
        String token = getAccessToken();
        String url = properties.getBaseUrl()
                + "/drives/"
                + encodePathSegment(properties.getDriveId())
                + "/items/"
                + encodePathSegment(itemId)
                + "/content?format=pdf";

        HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofSeconds(60))
                .header("Authorization", "Bearer " + token)
                .GET()
                .build();

        HttpResponse<byte[]> response = httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IllegalStateException("Failed to generate SharePoint PDF preview");
        }

        byte[] previewBytes = response.body();
        if (!isPdfBytes(previewBytes)) {
            log.warn("Graph PDF preview response for revision {} was not a PDF", revision.getRevisionNumber());
            throw new IllegalStateException("Microsoft Graph did not return a valid PDF preview");
        }

        Path targetDir = REVISION_STORAGE_ROOT.resolve(revision.getId().toString());
        Files.createDirectories(targetDir);
        Path previewPath = targetDir.resolve("sharepoint-preview.pdf");
        Files.write(previewPath, previewBytes);
        log.info("Generated SharePoint PDF preview for revision {} at {}", revision.getRevisionNumber(), previewPath);
        return previewPath;
    }

    private String getAccessToken() throws IOException, InterruptedException {
        CachedToken token = this.cachedToken;
        if (token != null && token.expiresAt().isAfter(Instant.now().plusSeconds(60))) {
            return token.accessToken();
        }

        synchronized (this) {
            token = this.cachedToken;
            if (token != null && token.expiresAt().isAfter(Instant.now().plusSeconds(60))) {
                return token.accessToken();
            }

            String tokenUrl = "https://login.microsoftonline.com/" + encodePathSegment(properties.getTenantId()) + "/oauth2/v2.0/token";
            String form = "client_id=" + encodeForm(properties.getClientId())
                    + "&client_secret=" + encodeForm(properties.getClientSecret())
                    + "&grant_type=client_credentials"
                    + "&scope=" + encodeForm("https://graph.microsoft.com/.default");

            HttpRequest request = HttpRequest.newBuilder(URI.create(tokenUrl))
                    .timeout(Duration.ofSeconds(30))
                    .header("Content-Type", "application/x-www-form-urlencoded")
                    .POST(HttpRequest.BodyPublishers.ofString(form))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            ensureSuccess(response, "request access token");

            JsonNode jsonNode = objectMapper.readTree(response.body());
            String accessToken = text(jsonNode, "access_token");
            long expiresIn = jsonNode.path("expires_in").asLong(3600L);
            if (!StringUtils.hasText(accessToken)) {
                throw new IllegalStateException("Microsoft Graph access token not returned");
            }

            this.cachedToken = new CachedToken(accessToken, Instant.now().plusSeconds(Math.max(60L, expiresIn)));
            return accessToken;
        }
    }

    private String buildRemotePath(DocumentRevisionRecord revision, String fileName) {
        return storagePathBuilder.sharePointRecordSourceV2(
                properties.getLibraryFolder(),
                revision == null ? null : revision.getDocumentNumber(),
                revision == null ? null : revision.getId(),
                fileName
        );
    }

    private String sanitizePathPart(String value) {
        if (!StringUtils.hasText(value)) {
            return "untitled";
        }
        return value.trim()
                .replace("\\", "-")
                .replace("/", "-")
                .replace(":", "-")
                .replace("?", "-")
                .replace("\"", "-")
                .replace("<", "-")
                .replace(">", "-")
                .replace("|", "-")
                .replace("*", "-");
    }

    private String encodePath(String path) {
        String[] parts = path.split("/");
        StringBuilder builder = new StringBuilder();
        for (int i = 0; i < parts.length; i++) {
            if (i > 0) {
                builder.append('/');
            }
            builder.append(encodePathSegment(parts[i]));
        }
        return builder.toString();
    }

    private String encodePathSegment(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20");
    }

    private String encodeForm(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private void ensureSuccess(HttpResponse<?> response, String action) {
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            String body = response.body() == null ? "" : response.body().toString();
            throw new IllegalStateException("Failed to " + action + " (HTTP " + response.statusCode() + "): " + extractGraphError(body));
        }
    }

    private String extractGraphError(String body) {
        if (!StringUtils.hasText(body)) {
            return "";
        }
        try {
            JsonNode node = objectMapper.readTree(body);
            String message = text(node.path("error"), "message");
            String code = text(node.path("error"), "code");
            if (StringUtils.hasText(code) && StringUtils.hasText(message)) {
                return code + ": " + message;
            }
            if (StringUtils.hasText(message)) {
                return message;
            }
        } catch (Exception ignored) {
            // fall through to raw body
        }
        return body.length() > 500 ? body.substring(0, 500) + "..." : body;
    }

    private String text(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        return value == null || value.isNull() ? null : value.asText();
    }

    private boolean isPdfBytes(byte[] bytes) {
        if (bytes == null || bytes.length < 4) {
            return false;
        }
        return bytes[0] == 0x25 && bytes[1] == 0x50 && bytes[2] == 0x44 && bytes[3] == 0x46;
    }

    private record CachedToken(String accessToken, Instant expiresAt) {}

    public record UploadedItem(String id, String webUrl) {}

    public record SharePointSyncResult(
            boolean configured,
            boolean synced,
            String status,
            String siteId,
            String driveId,
            String itemId,
            String webUrl,
            String editUrl,
            String viewUrl,
            String pdfPath,
            String previewUrl,
            String errorMessage
    ) {
        static SharePointSyncResult notConfigured() {
            return new SharePointSyncResult(false, false, "NOT_CONFIGURED", null, null, null, null, null, null, null, null, null);
        }

        static SharePointSyncResult synced(String siteId, String driveId, String itemId, String webUrl, String editUrl, String viewUrl, String pdfPath, String previewUrl) {
            return new SharePointSyncResult(true, true, "SYNCED", siteId, driveId, itemId, webUrl, editUrl, viewUrl, pdfPath, previewUrl, null);
        }

        static SharePointSyncResult failed(String errorMessage) {
            return new SharePointSyncResult(true, false, "FAILED", null, null, null, null, null, null, null, null, errorMessage);
        }
    }
}
