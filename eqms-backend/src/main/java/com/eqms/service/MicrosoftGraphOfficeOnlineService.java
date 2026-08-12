package com.eqms.service;

import com.eqms.exception.OfficeOnlineShareException;
import com.eqms.repository.ExternalIdentityProvisioningRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Optional;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@Service
public class MicrosoftGraphOfficeOnlineService {

    private static final int CHUNK_SIZE_BYTES = 5 * 1024 * 1024;
    private static final Logger log = LoggerFactory.getLogger(MicrosoftGraphOfficeOnlineService.class);
    private static final int CIRCUIT_FAILURE_THRESHOLD = 5;
    private static final long CIRCUIT_OPEN_MILLIS = Duration.ofSeconds(30).toMillis();

    /** Must match ExternalIdentityProvisioningService.PROVIDER -- kept as a literal here rather
     *  than injecting that whole service, since only a read-only status lookup by email is
     *  needed. */
    private static final String EXTERNAL_IDENTITY_PROVIDER = "MICROSOFT_ENTRA";

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final OfficeOnlineConfigurationService officeOnlineConfigurationService;
    private final SharePointPathBuilder sharePointPathBuilder;
    private final ExternalIdentityProvisioningRepository externalIdentityProvisioningRepository;
    private final AtomicInteger consecutiveFailures = new AtomicInteger();
    private volatile long circuitOpenedAt;

    public MicrosoftGraphOfficeOnlineService(
            ObjectMapper objectMapper,
            OfficeOnlineConfigurationService officeOnlineConfigurationService,
            SharePointPathBuilder sharePointPathBuilder,
            ExternalIdentityProvisioningRepository externalIdentityProvisioningRepository
    ) {
        this.objectMapper = objectMapper;
        this.officeOnlineConfigurationService = officeOnlineConfigurationService;
        this.sharePointPathBuilder = sharePointPathBuilder;
        this.externalIdentityProvisioningRepository = externalIdentityProvisioningRepository;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(30))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

    /**
     * Fails fast with a specific, actionable reason instead of letting the Graph "/invite" call
     * blow up with a raw "sharingFailed" JSON blob -- the single most common cause is simply that
     * this user's email was never invited into Microsoft Entra (or the invitation is still
     * pending). An administrator can fix this from User Management -- External Identity; the user
     * can then retry Edit Online themselves once the invite is accepted.
     */
    private void requireProvisionedRecipient(String email) {
        if (!StringUtils.hasText(email)) {
            return;
        }
        String normalized = email.trim().toLowerCase();
        boolean linked = externalIdentityProvisioningRepository
                .findByProviderAndEmailNormalized(EXTERNAL_IDENTITY_PROVIDER, normalized)
                .map(record -> "LINKED".equals(record.getStatus()) || "REDEEMED".equals(record.getStatus()))
                .orElse(false);
        if (!linked) {
            throw new OfficeOnlineShareException(
                    "EXTERNAL_IDENTITY_NOT_PROVISIONED",
                    "This user's email (" + email + ") has not been added to Microsoft Entra yet, or the invitation "
                            + "has not been accepted. An administrator must invite this user from User Management -- "
                            + "External Identity; once the invitation is accepted, the user can try Edit Online again."
            );
        }
    }

    /**
     * Graph's own rejection for a share/invite call -- parses the error code out of the response
     * body instead of surfacing the raw JSON, and treats "sharingFailed" the same as a missing
     * Entra provisioning (Graph returns this exact code when the recipient can't be resolved as a
     * valid guest, which in this system's case is almost always because they were never invited).
     */
    private OfficeOnlineShareException toShareException(String actionLabel, HttpResponse<String> response) {
        String graphCode = null;
        String graphMessage = null;
        try {
            JsonNode error = objectMapper.readTree(response.body()).path("error");
            graphCode = text(error, "code");
            graphMessage = text(error, "message");
        } catch (Exception ignored) {
            // Fall through to the generic message below if the body isn't valid Graph error JSON.
        }
        if ("sharingFailed".equalsIgnoreCase(graphCode)) {
            return new OfficeOnlineShareException(
                    "EXTERNAL_IDENTITY_NOT_PROVISIONED",
                    "Microsoft Graph could not share this file with the recipient (sharingFailed). This almost "
                            + "always means the recipient has not been added to Microsoft Entra yet. An administrator "
                            + "must invite this user from User Management -- External Identity; once the invitation "
                            + "is accepted, the user can try " + actionLabel + " again."
            );
        }
        String detail = StringUtils.hasText(graphMessage)
                ? graphCode + ": " + graphMessage
                : "HTTP " + response.statusCode();
        return new OfficeOnlineShareException(
                "OFFICE_ONLINE_SHARE_FAILED",
                "Failed to grant " + actionLabel + " access to the Office Online file (" + detail + ")."
        );
    }

    public boolean isConfigured() {
        return isConfigured(officeOnlineConfigurationService.getEffectiveConfiguration());
    }

    public GraphUploadResult uploadOfficeFile(Path filePath, String fileName, String subFolderPath) throws IOException {
        OfficeOnlineConfigurationService.OfficeOnlineConfiguration config = officeOnlineConfigurationService.getEffectiveConfiguration();
        if (!isConfigured(config)) {
            throw new IllegalStateException("Microsoft Graph Office Online is not configured");
        }
        if (filePath == null || !Files.exists(filePath)) {
            throw new IllegalArgumentException("Revision file not found");
        }

        String token = acquireAccessToken(config);
        String safeName = StringUtils.hasText(fileName) ? fileName.trim() : filePath.getFileName().toString();
        Optional<DriveItemLookupResult> existingItem = findDriveItemInFolder(config, token, subFolderPath, safeName);
        if (existingItem.isPresent()) {
            log.info("Office Online file already exists for folder '{}' and file '{}'; reusing existing drive item {}",
                    subFolderPath, safeName, existingItem.get().id());
            return buildGraphUploadResult(config, existingItem.get().id(), existingItem.get().webUrl());
        }
        String uploadPath = buildUploadPath(config, safeName, subFolderPath);
        String createSessionUrl = trimTrailingSlash(config.graphBaseUrl()) + "/drives/" + urlEncodePathSegment(config.driveId()) + "/root:/" + uploadPath + ":/createUploadSession";

        Map<String, Object> itemPayload = new LinkedHashMap<>();
        itemPayload.put("@microsoft.graph.conflictBehavior", "replace");
        itemPayload.put("name", safeName);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("item", itemPayload);

        HttpRequest createSessionRequest = HttpRequest.newBuilder()
                .uri(URI.create(createSessionUrl))
                .timeout(Duration.ofMinutes(2))
                .header("Authorization", "Bearer " + token)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(payload)))
                .build();

        HttpResponse<String> createSessionResponse = send(createSessionRequest);
        if (createSessionResponse.statusCode() < 200 || createSessionResponse.statusCode() >= 300) {
            if (createSessionResponse.statusCode() == 409 && containsNameAlreadyExists(createSessionResponse.body())) {
                Optional<DriveItemLookupResult> retryExistingItem = findDriveItemInFolder(config, token, subFolderPath, safeName);
                if (retryExistingItem.isPresent()) {
                    log.info("Recovered Office Online upload for existing drive item {} after nameAlreadyExists", retryExistingItem.get().id());
                    return buildGraphUploadResult(config, retryExistingItem.get().id(), retryExistingItem.get().webUrl());
                }
            }
            throw new IllegalStateException("Failed to create Office Online upload session: " + createSessionResponse.body());
        }

        JsonNode sessionJson = objectMapper.readTree(createSessionResponse.body());
        String uploadUrl = text(sessionJson, "uploadUrl");
        if (!StringUtils.hasText(uploadUrl)) {
            throw new IllegalStateException("Office Online upload session did not return uploadUrl");
        }

        JsonNode uploadedItem = uploadWithSession(uploadUrl, filePath);
        String itemId = text(uploadedItem, "id");
        String webUrl = text(uploadedItem, "webUrl");
        return buildGraphUploadResult(config, itemId, webUrl);
    }

    public void revokeSharingPermission(String driveId, String itemId, String permissionId) throws IOException {
        OfficeOnlineConfigurationService.OfficeOnlineConfiguration config = officeOnlineConfigurationService.getEffectiveConfiguration();
        if (!isConfigured(config)) {
            throw new IllegalStateException("Microsoft Graph Office Online is not configured");
        }
        if (!StringUtils.hasText(driveId) || !StringUtils.hasText(itemId) || !StringUtils.hasText(permissionId)) {
            return;
        }

        String token = acquireAccessToken(config);
        String url = trimTrailingSlash(config.graphBaseUrl()) + "/drives/" + urlEncodePathSegment(driveId)
                + "/items/" + urlEncodePathSegment(itemId)
                + "/permissions/" + urlEncodePathSegment(permissionId);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofMinutes(2))
                .header("Authorization", "Bearer " + token)
                .DELETE()
                .build();

        HttpResponse<String> response = send(request);
        if (response.statusCode() == 404) {
            return;
        }
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IllegalStateException("Failed to revoke Office Online sharing permission: " + response.body());
        }
    }

    public void deleteFile(String driveId, String itemId) throws IOException {
        OfficeOnlineConfigurationService.OfficeOnlineConfiguration config = officeOnlineConfigurationService.getEffectiveConfiguration();
        if (!isConfigured(config)) {
            throw new IllegalStateException("Microsoft Graph Office Online is not configured");
        }
        String token = acquireAccessToken(config);
        String url = trimTrailingSlash(config.graphBaseUrl()) + "/drives/" + urlEncodePathSegment(driveId)
                + "/items/" + urlEncodePathSegment(itemId);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofMinutes(2))
                .header("Authorization", "Bearer " + token)
                .DELETE()
                .build();

        HttpResponse<String> response = send(request);
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IllegalStateException("Failed to delete Office Online working file: " + response.body());
        }
    }

    public java.util.List<SharingPermissionResult> listSharingPermissions(String driveId, String itemId) throws IOException {
        OfficeOnlineConfigurationService.OfficeOnlineConfiguration config = officeOnlineConfigurationService.getEffectiveConfiguration();
        if (!isConfigured(config)) {
            throw new IllegalStateException("Microsoft Graph Office Online is not configured");
        }
        if (!StringUtils.hasText(driveId) || !StringUtils.hasText(itemId)) {
            return java.util.List.of();
        }

        String token = acquireAccessToken(config);
        String url = trimTrailingSlash(config.graphBaseUrl()) + "/drives/" + urlEncodePathSegment(driveId)
                + "/items/" + urlEncodePathSegment(itemId)
                + "/permissions?$select=id,roles,link,grantedToV2,grantedToIdentitiesV2,inheritedFrom";

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofMinutes(2))
                .header("Authorization", "Bearer " + token)
                .GET()
                .build();

        HttpResponse<String> response = send(request);
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IllegalStateException("Failed to list Office Online sharing permissions: " + response.body());
        }

        JsonNode json = objectMapper.readTree(response.body());
        JsonNode values = json.get("value");
        java.util.List<SharingPermissionResult> result = new java.util.ArrayList<>();
        if (values != null && values.isArray()) {
            for (JsonNode item : values) {
                java.util.Set<String> roles = new java.util.LinkedHashSet<>();
                JsonNode rolesNode = item.path("roles");
                if (rolesNode.isArray()) {
                    rolesNode.forEach(role -> {
                        String value = role.asText();
                        if (StringUtils.hasText(value)) {
                            roles.add(value.trim().toLowerCase());
                        }
                    });
                }
                java.util.Set<String> recipientEmails = new java.util.LinkedHashSet<>();
                collectPermissionEmails(item.path("grantedToV2"), recipientEmails);
                JsonNode identities = item.path("grantedToIdentitiesV2");
                if (identities.isArray()) {
                    identities.forEach(identity -> collectPermissionEmails(identity, recipientEmails));
                }
                String linkType = text(item.path("link"), "type");
                java.util.List<String> permissionTypes = new java.util.ArrayList<>(roles);
                if (StringUtils.hasText(linkType) && !permissionTypes.contains(linkType.trim().toLowerCase())) {
                    permissionTypes.add(linkType.trim().toLowerCase());
                }
                result.add(new SharingPermissionResult(
                        text(item, "id"),
                        text(item.path("link"), "webUrl"),
                        String.join(",", permissionTypes),
                        recipientEmails,
                        item.path("inheritedFrom").isMissingNode() || item.path("inheritedFrom").isNull()
                                ? null
                                : item.path("inheritedFrom").toString()
                ));
            }
        }
        return result;
    }

    private void collectPermissionEmails(JsonNode identity, java.util.Set<String> recipientEmails) {
        if (identity == null || identity.isMissingNode() || identity.isNull()) {
            return;
        }
        String email = text(identity.path("user"), "email");
        if (StringUtils.hasText(email)) {
            recipientEmails.add(email.trim().toLowerCase());
        }
    }

    public SharingLinkResult createSharingLink(OfficeOnlineConfigurationService.OfficeOnlineConfiguration config, String itemId, String type) throws IOException {
        if (!isConfigured(config)) {
            throw new IllegalStateException("Microsoft Graph Office Online is not configured");
        }
        if (!StringUtils.hasText(itemId)) {
            throw new IllegalArgumentException("Revision file item id is missing");
        }
        String normalizedType = StringUtils.hasText(type) ? type.trim().toLowerCase() : "view";
        if (!"view".equals(normalizedType) && !"edit".equals(normalizedType)) {
            throw new IllegalArgumentException("Unsupported sharing link type: " + type);
        }

        String token = acquireAccessToken(config);
        String url = trimTrailingSlash(config.graphBaseUrl()) + "/drives/" + urlEncodePathSegment(config.driveId())
                + "/items/" + urlEncodePathSegment(itemId) + "/createLink";
        String configuredScope = StringUtils.hasText(config.shareLinkScope()) ? config.shareLinkScope().trim() : "organization";
        String effectiveScope = configuredScope;
        if (!"anonymous".equalsIgnoreCase(effectiveScope)
                && !"organization".equalsIgnoreCase(effectiveScope)
                && !"users".equalsIgnoreCase(effectiveScope)) {
            effectiveScope = "organization";
        }
        log.info("Creating Office Online sharing link: itemId={}, type={}, configuredScope={}, effectiveScope={}",
                itemId, normalizedType, configuredScope, effectiveScope);

        // Graph's createLink endpoint cannot create a users-scoped link without a recipient.
        // Named-user mode uses the item's direct URL; workflow code grants the assigned user
        // an item-scoped permission through /invite.
        if ("users".equalsIgnoreCase(effectiveScope)) {
            String directUrl = getDriveItemWebUrl(config, token, itemId);
            return new SharingLinkResult(null, directUrl, normalizedType);
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("type", normalizedType);
        payload.put("scope", effectiveScope);
        payload.put("retainInheritedPermissions", false);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofMinutes(2))
                .header("Authorization", "Bearer " + token)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(payload)))
                .build();

        HttpResponse<String> response = send(request);
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IllegalStateException("Failed to create Office Online sharing link: " + response.body());
        }

        JsonNode json = objectMapper.readTree(response.body());
        String permissionId = text(json, "id");
        String webUrl = text(json.path("link"), "webUrl");
        if (!StringUtils.hasText(permissionId) || !StringUtils.hasText(webUrl)) {
            throw new IllegalStateException("Office Online sharing link response did not include id/webUrl");
        }
        return new SharingLinkResult(permissionId, webUrl, normalizedType);
    }

    public void testConnection(OfficeOnlineConfigurationService.OfficeOnlineConfiguration config) throws IOException {
        if (!isConfigured(config)) {
            throw new IllegalStateException("Microsoft Graph Office Online is not configured");
        }
        String token = acquireAccessToken(config);
        String url = trimTrailingSlash(config.graphBaseUrl()) + "/sites/" + urlEncodePathSegment(config.siteId())
                + "/drives/" + urlEncodePathSegment(config.driveId());
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofMinutes(2))
                .header("Authorization", "Bearer " + token)
                .GET()
                .build();

        HttpResponse<String> response = send(request);
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IllegalStateException("Failed to verify Microsoft Graph site/drive access: " + response.body());
        }
    }

    private JsonNode uploadWithSession(String uploadUrl, Path filePath) throws IOException {
        long fileSize = Files.size(filePath);
        if (fileSize == 0L) {
            throw new IllegalArgumentException("Revision file is empty");
        }

        byte[] buffer = new byte[CHUNK_SIZE_BYTES];
        long position = 0L;
        JsonNode responseJson = null;

        try (InputStream input = Files.newInputStream(filePath)) {
            int read;
            while ((read = input.read(buffer)) != -1) {
                long start = position;
                long end = position + read - 1L;
                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create(uploadUrl))
                        .timeout(Duration.ofMinutes(5))
                        .header("Content-Range", "bytes " + start + "-" + end + "/" + fileSize)
                        .PUT(HttpRequest.BodyPublishers.ofByteArray(copyOf(buffer, read)))
                        .build();

                HttpResponse<String> response = send(request);
                int status = response.statusCode();
                if (status == 200 || status == 201) {
                    responseJson = objectMapper.readTree(response.body());
                } else if (status != 202) {
                    throw new IllegalStateException("Failed to upload Office Online chunk: " + response.body());
                }

                position = end + 1L;
            }
        }

        if (responseJson == null) {
            throw new IllegalStateException("Office Online upload did not return a drive item");
        }
        return responseJson;
    }

    private HttpResponse<String> send(HttpRequest request) throws IOException {
        long openedAt = circuitOpenedAt;
        if (openedAt > 0 && System.currentTimeMillis() - openedAt < CIRCUIT_OPEN_MILLIS) {
            throw new IOException("Microsoft Graph circuit breaker is open; retry after 30 seconds");
        }
        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() >= 500 || response.statusCode() == 429) {
                tripCircuitIfNeeded();
            } else if (response.statusCode() >= 200 && response.statusCode() < 500) {
                consecutiveFailures.set(0);
                circuitOpenedAt = 0;
            }
            return response;
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new IOException("Microsoft Graph request interrupted", ex);
        } catch (IOException ex) {
            tripCircuitIfNeeded();
            throw ex;
        }
    }

    /**
     * Binary download and PDF conversion requests must obey the same circuit as
     * JSON Graph calls. Otherwise a Graph outage can occupy publishing threads
     * for their five-minute request timeout even after the service is known down.
     */
    private HttpResponse<byte[]> sendBytes(HttpRequest request) throws IOException {
        long openedAt = circuitOpenedAt;
        if (openedAt > 0 && System.currentTimeMillis() - openedAt < CIRCUIT_OPEN_MILLIS) {
            throw new IOException("Microsoft Graph circuit breaker is open; retry after 30 seconds");
        }
        try {
            HttpResponse<byte[]> response = httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());
            if (response.statusCode() >= 500 || response.statusCode() == 429) {
                tripCircuitIfNeeded();
            } else if (response.statusCode() >= 200 && response.statusCode() < 500) {
                consecutiveFailures.set(0);
                circuitOpenedAt = 0;
            }
            return response;
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new IOException("Microsoft Graph request interrupted", ex);
        } catch (IOException ex) {
            tripCircuitIfNeeded();
            throw ex;
        }
    }

    private void tripCircuitIfNeeded() {
        if (consecutiveFailures.incrementAndGet() >= CIRCUIT_FAILURE_THRESHOLD) {
            circuitOpenedAt = System.currentTimeMillis();
            log.warn("Microsoft Graph circuit opened after {} consecutive failures", CIRCUIT_FAILURE_THRESHOLD);
        }
    }

    private String acquireAccessToken(OfficeOnlineConfigurationService.OfficeOnlineConfiguration config) throws IOException {
        String tokenUrl = "https://login.microsoftonline.com/" + urlEncodePathSegment(config.tenantId()) + "/oauth2/v2.0/token";
        String body = "client_id=" + encodeForm(config.clientId())
                + "&client_secret=" + encodeForm(config.clientSecret())
                + "&grant_type=client_credentials"
                + "&scope=" + encodeForm("https://graph.microsoft.com/.default");

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(tokenUrl))
                .timeout(Duration.ofMinutes(2))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

        HttpResponse<String> response = send(request);
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IllegalStateException("Failed to acquire Microsoft Graph token: " + response.body());
        }

        JsonNode json = objectMapper.readTree(response.body());
        String token = text(json, "access_token");
        if (!StringUtils.hasText(token)) {
            throw new IllegalStateException("Microsoft Graph token response did not include access_token");
        }
        return token;
    }

    private boolean isConfigured(OfficeOnlineConfigurationService.OfficeOnlineConfiguration config) {
        return config != null
                && config.enabled()
                && StringUtils.hasText(config.graphBaseUrl())
                && StringUtils.hasText(config.tenantId())
                && StringUtils.hasText(config.clientId())
                && StringUtils.hasText(config.clientSecret())
                && StringUtils.hasText(config.siteId())
                && StringUtils.hasText(config.driveId());
    }

    private String buildUploadPath(OfficeOnlineConfigurationService.OfficeOnlineConfiguration config, String fileName, String subFolderPath) {
        return buildRawPath(subFolderPath, fileName);
    }

    private GraphUploadResult buildGraphUploadResult(
            OfficeOnlineConfigurationService.OfficeOnlineConfiguration config,
            String itemId,
            String webUrl
    ) throws IOException {
        try {
            SharingLinkResult editLink = createSharingLink(config, itemId, "edit");
            SharingLinkResult viewLink = createSharingLink(config, itemId, "view");
            return new GraphUploadResult(
                    config.siteId(),
                    config.driveId(),
                    itemId,
                    webUrl,
                    editLink.webUrl(),
                    viewLink.webUrl(),
                    editLink.permissionId(),
                    viewLink.permissionId()
            );
        } catch (IllegalStateException ex) {
            if (!isSharingDisabled(ex) || !StringUtils.hasText(webUrl)) {
                throw ex;
            }
            log.warn("SharePoint sharing is disabled for item {}; using its direct web URL. "
                    + "Users must be granted site access by SharePoint.", itemId);
            return new GraphUploadResult(
                    config.siteId(),
                    config.driveId(),
                    itemId,
                    webUrl,
                    webUrl,
                    webUrl,
                    null,
                    null
            );
        }
    }

    /** Performs a reversible probe of upload and item sharing using a temporary file. */
    public void testTemporarySharingCapabilities() throws IOException {
        testTemporarySharingCapabilities(officeOnlineConfigurationService.getEffectiveConfiguration());
    }

    public void testTemporarySharingCapabilities(OfficeOnlineConfigurationService.OfficeOnlineConfiguration config) throws IOException {
        if (!isConfigured(config)) throw new IllegalStateException("Microsoft Graph Office Online is not configured");
        Path probe = Files.createTempFile("eqms-office-online-probe-", ".docx");
        GraphUploadResult uploaded = null;
        String folder = sharePointPathBuilder.tempFolder(config, "health", UUID.randomUUID().toString());
        try {
            writeValidProbeDocx(probe);
            uploaded = uploadOfficeFile(probe, "connection-probe.docx", folder);
            createSharingLink(config, uploaded.itemId(), "edit");
            createSharingLink(config, uploaded.itemId(), "view");
        } finally {
            if (uploaded != null) {
                try { deleteFile(config.driveId(), uploaded.itemId()); } catch (Exception ignored) { }
            }
            Files.deleteIfExists(probe);
        }
    }

    private void writeValidProbeDocx(Path path) throws IOException {
        try (ZipOutputStream zip = new ZipOutputStream(Files.newOutputStream(path))) {
            putZipEntry(zip, "[Content_Types].xml", "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxml-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/><Override PartName=\"/word/document.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/></Types>");
            putZipEntry(zip, "_rels/.rels", "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"word/document.xml\"/></Relationships>");
            putZipEntry(zip, "word/document.xml", "<?xml version=\"1.0\" encoding=\"UTF-8\"?><w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:body><w:p><w:r><w:t>EQMS connection probe</w:t></w:r></w:p><w:sectPr/></w:body></w:document>");
        }
    }

    private void putZipEntry(ZipOutputStream zip, String name, String content) throws IOException {
        zip.putNextEntry(new ZipEntry(name));
        zip.write(content.getBytes(StandardCharsets.UTF_8));
        zip.closeEntry();
    }

    private String getDriveItemWebUrl(OfficeOnlineConfigurationService.OfficeOnlineConfiguration config, String token, String itemId) throws IOException {
        String url = trimTrailingSlash(config.graphBaseUrl()) + "/drives/" + urlEncodePathSegment(config.driveId())
                + "/items/" + urlEncodePathSegment(itemId) + "?$select=id,webUrl";
        HttpRequest request = HttpRequest.newBuilder().uri(URI.create(url)).timeout(Duration.ofMinutes(2))
                .header("Authorization", "Bearer " + token).GET().build();
        HttpResponse<String> response = send(request);
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IllegalStateException("Failed to resolve Office Online item URL: " + response.body());
        }
        String webUrl = text(objectMapper.readTree(response.body()), "webUrl");
        if (!StringUtils.hasText(webUrl)) throw new IllegalStateException("Office Online item did not return a web URL");
        return webUrl;
    }

    /**
     * Grants a signed-in user edit access to one Office Online working file.
     * This is intentionally item-scoped: EQMS workflow permissions never grant
     * access to the full SharePoint library.
     */
    public void grantItemWriteAccess(String driveId, String itemId, String email) throws IOException {
        grantItemAccess(driveId, itemId, email, "write", "edit");
    }

    /**
     * Creates Word's native "Can review" link for one recipient. The review link API is
     * currently exposed by Microsoft Graph beta; driveItem/invite only supports read/write.
     */
    public String createItemReviewLink(String driveId, String itemId, String email) throws IOException {
        OfficeOnlineConfigurationService.OfficeOnlineConfiguration config = officeOnlineConfigurationService.getEffectiveConfiguration();
        if (!isConfigured(config)) {
            throw new IllegalStateException("Microsoft Graph Office Online is not configured");
        }
        if (!StringUtils.hasText(driveId) || !StringUtils.hasText(itemId)) {
            throw new IllegalArgumentException("Office Online file location is missing");
        }
        if (!StringUtils.hasText(email)) {
            throw new IllegalStateException("The current EQMS account must have an email address to review in Office Online");
        }
        requireProvisionedRecipient(email);

        revokeDirectItemAccessForEmail(driveId, itemId, email);
        String token = acquireAccessToken(config);
        String betaBaseUrl = trimTrailingSlash(config.graphBaseUrl()).replaceFirst("/v1\\.0$", "/beta");
        String url = betaBaseUrl + "/drives/" + urlEncodePathSegment(driveId)
                + "/items/" + urlEncodePathSegment(itemId) + "/createLink";
        Map<String, Object> recipient = new LinkedHashMap<>();
        recipient.put("email", email.trim());
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("type", "review");
        payload.put("scope", "users");
        payload.put("recipients", java.util.List.of(recipient));
        payload.put("sendNotification", false);
        payload.put("retainInheritedPermissions", true);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofMinutes(2))
                .header("Authorization", "Bearer " + token)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(payload)))
                .build();
        HttpResponse<String> response = send(request);
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw toShareException("review", response);
        }
        String reviewUrl = text(objectMapper.readTree(response.body()).path("link"), "webUrl");
        if (!StringUtils.hasText(reviewUrl)) {
            throw new IllegalStateException("Microsoft Graph did not return an Office Online review link");
        }
        return reviewUrl;
    }

    private void grantItemAccess(String driveId, String itemId, String email, String role, String actionLabel) throws IOException {
        OfficeOnlineConfigurationService.OfficeOnlineConfiguration config = officeOnlineConfigurationService.getEffectiveConfiguration();
        if (!isConfigured(config)) {
            throw new IllegalStateException("Microsoft Graph Office Online is not configured");
        }
        if (!StringUtils.hasText(driveId) || !StringUtils.hasText(itemId)) {
            throw new IllegalArgumentException("Office Online file location is missing");
        }
        if (!StringUtils.hasText(email)) {
            throw new IllegalStateException("The current EQMS account must have an email address to access the Office Online file");
        }
        requireProvisionedRecipient(email);

        revokeDirectItemAccessForEmail(driveId, itemId, email);

        String token = acquireAccessToken(config);
        String url = trimTrailingSlash(config.graphBaseUrl()) + "/drives/" + urlEncodePathSegment(driveId)
                + "/items/" + urlEncodePathSegment(itemId) + "/invite";
        Map<String, Object> recipient = new LinkedHashMap<>();
        recipient.put("email", email.trim());
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("recipients", java.util.List.of(recipient));
        payload.put("roles", java.util.List.of(role));
        payload.put("requireSignIn", true);
        payload.put("sendInvitation", false);
        payload.put("retainInheritedPermissions", true);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofMinutes(2))
                .header("Authorization", "Bearer " + token)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(payload)))
                .build();

        HttpResponse<String> response = send(request);
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw toShareException(actionLabel, response);
        }
    }

    private void revokeDirectItemAccessForEmail(String driveId, String itemId, String email) throws IOException {
        if (!StringUtils.hasText(email)) {
            return;
        }
        String normalizedEmail = email.trim().toLowerCase();
        for (SharingPermissionResult permission : listSharingPermissions(driveId, itemId)) {
            if (permission == null || StringUtils.hasText(permission.inheritedFrom())
                    || !permission.principalEmails().contains(normalizedEmail)) {
                continue;
            }
            revokeSharingPermission(driveId, itemId, permission.id());
        }
    }

    /** Returns the item URL, which honors direct item permissions for guest users. */
    public String getItemWebUrl(String driveId, String itemId) throws IOException {
        OfficeOnlineConfigurationService.OfficeOnlineConfiguration config = officeOnlineConfigurationService.getEffectiveConfiguration();
        if (!isConfigured(config)) {
            throw new IllegalStateException("Microsoft Graph Office Online is not configured");
        }
        if (!StringUtils.hasText(driveId) || !StringUtils.hasText(itemId)) {
            throw new IllegalArgumentException("Office Online file location is missing");
        }

        String token = acquireAccessToken(config);
        String url = trimTrailingSlash(config.graphBaseUrl()) + "/drives/" + urlEncodePathSegment(driveId)
                + "/items/" + urlEncodePathSegment(itemId) + "?$select=webUrl";
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofMinutes(2))
                .header("Authorization", "Bearer " + token)
                .GET()
                .build();
        HttpResponse<String> response = send(request);
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IllegalStateException("Failed to resolve Office Online file URL: " + response.body());
        }
        String webUrl = text(objectMapper.readTree(response.body()), "webUrl");
        if (!StringUtils.hasText(webUrl)) {
            throw new IllegalStateException("Office Online file response did not include webUrl");
        }
        return webUrl;
    }

    private boolean isSharingDisabled(IllegalStateException exception) {
        String message = exception.getMessage();
        return StringUtils.hasText(message)
                && (message.contains("\"sharingDisabled\"") || message.contains("sharingDisabled"));
    }

    private Optional<DriveItemLookupResult> findDriveItemInFolder(
            OfficeOnlineConfigurationService.OfficeOnlineConfiguration config,
            String token,
            String folderPath,
            String fileName
    ) throws IOException {
        if (!StringUtils.hasText(folderPath) || !StringUtils.hasText(fileName)) {
            return Optional.empty();
        }

        String normalizedFolderPath = folderPath.trim().replace("\\", "/").replaceAll("^/+|/+$", "");
        String url = trimTrailingSlash(config.graphBaseUrl()) + "/drives/" + urlEncodePathSegment(config.driveId())
                + "/root:/" + buildRawPath(normalizedFolderPath, "") + ":/children?$select=id,name,webUrl&$top=200";

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofMinutes(2))
                .header("Authorization", "Bearer " + token)
                .GET()
                .build();

        HttpResponse<String> response = send(request);
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            log.debug("Failed to inspect existing Office Online files in '{}': {}", normalizedFolderPath, response.body());
            return Optional.empty();
        }

        JsonNode json = objectMapper.readTree(response.body());
        JsonNode values = json.get("value");
        if (values == null || !values.isArray()) {
            return Optional.empty();
        }

        for (JsonNode item : values) {
            String name = text(item, "name");
            if (StringUtils.hasText(name) && name.equalsIgnoreCase(fileName.trim())) {
                String id = text(item, "id");
                String webUrl = text(item, "webUrl");
                if (StringUtils.hasText(id) && StringUtils.hasText(webUrl)) {
                    return Optional.of(new DriveItemLookupResult(id, name, webUrl));
                }
            }
        }
        return Optional.empty();
    }

    private boolean containsNameAlreadyExists(String body) {
        return StringUtils.hasText(body) && body.contains("nameAlreadyExists");
    }

    private String text(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        return value == null || value.isNull() ? null : value.asText();
    }

    private String encodeForm(String value) {
        return URLEncoder.encode(value == null ? "" : value, StandardCharsets.UTF_8);
    }

    private String urlEncodePathSegment(String value) {
        return URLEncoder.encode(value == null ? "" : value, StandardCharsets.UTF_8).replace("+", "%20");
    }

    private void appendPathSegment(StringBuilder builder, String value) {
        if (!StringUtils.hasText(value)) {
            return;
        }
        String normalized = value.trim().replace("\\", "/");
        for (String part : normalized.split("/")) {
            if (!StringUtils.hasText(part)) {
                continue;
            }
            if (!builder.isEmpty()) {
                builder.append('/');
            }
            builder.append(urlEncodePathSegment(part));
        }
    }

    private String trimTrailingSlash(String value) {
        if (!StringUtils.hasText(value)) {
            return "";
        }
        String trimmed = value.trim();
        while (trimmed.endsWith("/")) {
            trimmed = trimmed.substring(0, trimmed.length() - 1);
        }
        return trimmed;
    }

    private byte[] copyOf(byte[] source, int length) {
        byte[] copy = new byte[length];
        System.arraycopy(source, 0, copy, 0, length);
        return copy;
    }

    private String buildTemporaryPreviewFileName(String fileName, Path filePath) {
        String baseName = StringUtils.hasText(fileName)
                ? fileName
                : (filePath == null ? "preview" : filePath.getFileName().toString());
        return "preview-" + UUID.randomUUID() + "-" + sanitizeFileName(baseName);
    }

    private String sanitizeFileName(String fileName) {
        if (!StringUtils.hasText(fileName)) {
            return "revision-file";
        }
        return fileName.replaceAll("[\\\\/:*?\"<>|]", "_");
    }

    public java.util.List<FolderItem> browseFolders(String folderPath) throws IOException {
        OfficeOnlineConfigurationService.OfficeOnlineConfiguration config = officeOnlineConfigurationService.getEffectiveConfiguration();
        if (!isConfigured(config)) {
            throw new IllegalStateException("Microsoft Graph Office Online is not configured");
        }
        String token = acquireAccessToken(config);
        String base = trimTrailingSlash(config.graphBaseUrl()) + "/drives/" + urlEncodePathSegment(config.driveId());
        String url;
        if (!StringUtils.hasText(folderPath) || folderPath.equals("/")) {
            url = base + "/root/children?$filter=folder+ne+null&$select=id,name,folder,webUrl&$top=100";
        } else {
            // Build path to child listing under the given folder
            String normalizedPath = folderPath.trim().replaceAll("^/+|/+$", "");
            url = base + "/root:/" + normalizedPath + ":/children?$filter=folder+ne+null&$select=id,name,folder,webUrl&$top=100";
        }

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofMinutes(2))
                .header("Authorization", "Bearer " + token)
                .GET()
                .build();

        HttpResponse<String> response = send(request);
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IllegalStateException("Failed to browse Office Online workspace folders: " + response.body());
        }
        JsonNode json = objectMapper.readTree(response.body());
        JsonNode values = json.get("value");
        java.util.List<FolderItem> result = new java.util.ArrayList<>();
        if (values != null && values.isArray()) {
            for (JsonNode item : values) {
                String name = text(item, "name");
                String id = text(item, "id");
                String itemWebUrl = text(item, "webUrl");
                // Compute logical path = parentPath + "/" + name
                String logicalPath = StringUtils.hasText(folderPath) && !folderPath.equals("/")
                        ? folderPath.trim().replaceAll("^/+|/+$", "") + "/" + name
                        : name;
                result.add(new FolderItem(id, name, logicalPath, itemWebUrl));
            }
        }
        return result;
    }

    public byte[] convertToPdf(String itemId) throws IOException {
        OfficeOnlineConfigurationService.OfficeOnlineConfiguration config = officeOnlineConfigurationService.getEffectiveConfiguration();
        if (!isConfigured(config)) {
            throw new IllegalStateException("Microsoft Graph Office Online is not configured");
        }
        String token = acquireAccessToken(config);
        String url = trimTrailingSlash(config.graphBaseUrl()) + "/drives/" + urlEncodePathSegment(config.driveId())
                + "/items/" + urlEncodePathSegment(itemId) + "/content?format=pdf";

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofMinutes(5))
                .header("Authorization", "Bearer " + token)
                .GET()
                .build();

        HttpResponse<byte[]> response = sendBytes(request);
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IllegalStateException("Failed to convert file to PDF via Graph: Status " + response.statusCode() + ", body: " + new String(response.body(), StandardCharsets.UTF_8));
        }
        return response.body();
    }

    public byte[] convertSourceFileToPdf(Path filePath, String fileName) throws IOException {
        return convertSourceFileToPdf(filePath, fileName, null);
    }

    public byte[] convertSourceFileToPdf(Path filePath, String fileName, String workspacePath) throws IOException {
        OfficeOnlineConfigurationService.OfficeOnlineConfiguration config = officeOnlineConfigurationService.getEffectiveConfiguration();
        if (!isConfigured(config)) {
            throw new IllegalStateException("Microsoft Graph Office Online is not configured");
        }
        if (filePath == null || !Files.exists(filePath)) {
            throw new IllegalArgumentException("Source file not found");
        }

        String tempName = buildTemporaryPreviewFileName(fileName, filePath);
        String token = acquireAccessToken(config);
        String uploadPath = StringUtils.hasText(workspacePath)
                ? buildWorkspaceUploadPath(config, workspacePath, tempName)
                : buildWorkspaceUploadPath(config, sharePointPathBuilder.conversionFolder(config, "revisions", "preview"), tempName);
        String createSessionUrl = trimTrailingSlash(config.graphBaseUrl()) + "/drives/" + urlEncodePathSegment(config.driveId()) + "/root:/" + uploadPath + ":/createUploadSession";

        Map<String, Object> itemPayload = new LinkedHashMap<>();
        itemPayload.put("@microsoft.graph.conflictBehavior", "replace");
        itemPayload.put("name", tempName);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("item", itemPayload);

        HttpRequest createSessionRequest = HttpRequest.newBuilder()
                .uri(URI.create(createSessionUrl))
                .timeout(Duration.ofMinutes(2))
                .header("Authorization", "Bearer " + token)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(payload)))
                .build();

        HttpResponse<String> createSessionResponse = send(createSessionRequest);
        if (createSessionResponse.statusCode() < 200 || createSessionResponse.statusCode() >= 300) {
            throw new IllegalStateException("Failed to create Office Online upload session: " + createSessionResponse.body());
        }

        JsonNode sessionJson = objectMapper.readTree(createSessionResponse.body());
        String uploadUrl = text(sessionJson, "uploadUrl");
        if (!StringUtils.hasText(uploadUrl)) {
            throw new IllegalStateException("Office Online upload session did not return uploadUrl");
        }

        JsonNode uploadedItem = uploadWithSession(uploadUrl, filePath);
        String itemId = text(uploadedItem, "id");
        if (!StringUtils.hasText(itemId)) {
            throw new IllegalStateException("Temporary Office Online upload did not return an item id");
        }

        try {
            return convertToPdf(itemId);
        } finally {
            try {
                deleteFile(config.driveId(), itemId);
            } catch (Exception ex) {
                log.debug("Failed to delete temporary Office Online preview item {}", itemId, ex);
            }
        }
    }

    private String buildWorkspaceUploadPath(OfficeOnlineConfigurationService.OfficeOnlineConfiguration config, String workspacePath, String fileName) {
        String normalizedWorkspace = StringUtils.hasText(workspacePath) ? workspacePath.trim().replace("\\", "/") : "";
        String normalizedFileName = StringUtils.hasText(fileName) ? fileName.trim() : "file.bin";
        if (!StringUtils.hasText(normalizedWorkspace)) {
            return buildRawPath(sharePointPathBuilder.conversionFolder(config, "revisions", "preview"), normalizedFileName);
        }
        return buildRawPath(normalizedWorkspace, normalizedFileName);
    }

    private String buildRawPath(String workspacePath, String fileName) {
        StringBuilder path = new StringBuilder();
        appendPathSegment(path, workspacePath);
        appendPathSegment(path, fileName);
        return path.toString();
    }

    public byte[] downloadFile(String itemId) throws IOException {
        OfficeOnlineConfigurationService.OfficeOnlineConfiguration config = officeOnlineConfigurationService.getEffectiveConfiguration();
        if (!isConfigured(config)) {
            throw new IllegalStateException("Microsoft Graph Office Online is not configured");
        }
        String token = acquireAccessToken(config);
        String url = trimTrailingSlash(config.graphBaseUrl()) + "/drives/" + urlEncodePathSegment(config.driveId())
                + "/items/" + urlEncodePathSegment(itemId) + "/content";

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofMinutes(5))
                .header("Authorization", "Bearer " + token)
                .GET()
                .build();

        HttpResponse<byte[]> response = sendBytes(request);
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IllegalStateException("Failed to download file from Graph: Status " + response.statusCode());
        }
        return response.body();
    }

    public record FolderItem(
            String id,
            String name,
            String path,
            String webUrl
    ) {}
    public record GraphUploadResult(
            String siteId,
            String driveId,
            String itemId,
            String webUrl,
            String editUrl,
            String viewUrl,
            String editPermissionId,
            String viewPermissionId
    ) {
    }

    public record DriveItemLookupResult(
            String id,
            String name,
            String webUrl
    ) {
    }

    public record SharingLinkResult(
            String permissionId,
            String webUrl,
            String type
    ) {
    }

    public record SharingPermissionResult(
            String id,
            String webUrl,
            String type,
            java.util.Set<String> principalEmails,
            String inheritedFrom
    ) {
    }
}
