package com.eqms.service;

import com.eqms.dto.user.OfficeOnlineConfigurationTestRequest;
import com.eqms.entity.SystemConfiguration;
import com.eqms.repository.SystemConfigurationRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class OfficeOnlineConfigurationService {

    private static final String DEFAULT_CONFIG_KEY = "default";
    public static final String SECRET_MASK = "********";

    private final SystemConfigurationRepository systemConfigurationRepository;
    private final ObjectMapper objectMapper;

    @Value("${app.microsoft-graph.enabled:false}")
    private boolean envEnabled;

    @Value("${app.microsoft-graph.base-url:https://graph.microsoft.com/v1.0}")
    private String envGraphBaseUrl;

    @Value("${app.microsoft-graph.tenant-id:}")
    private String envTenantId;

    @Value("${app.microsoft-graph.client-id:}")
    private String envClientId;

    @Value("${app.microsoft-graph.client-secret:}")
    private String envClientSecret;

    @Value("${app.microsoft-graph.site-id:}")
    private String envSiteId;

    @Value("${app.microsoft-graph.drive-id:}")
    private String envDriveId;

    @Value("${app.microsoft-graph.folder-path:EQMS}")
    private String envFolderPath;

    @Value("${app.microsoft-graph.share-link-scope:anonymous}")
    private String envShareLinkScope;

    public OfficeOnlineConfigurationService(
            SystemConfigurationRepository systemConfigurationRepository,
            ObjectMapper objectMapper
    ) {
        this.systemConfigurationRepository = systemConfigurationRepository;
        this.objectMapper = objectMapper;
    }

    public OfficeOnlineConfiguration getEffectiveConfiguration() {
        JsonNode savedNode = systemConfigurationRepository.findByConfigKey(DEFAULT_CONFIG_KEY)
                .map(SystemConfiguration::getGeneralConfig)
                .map(this::extractOfficeOnlineNode)
                .orElse(null);
        return mergeWithEnvironment(savedNode);
    }

    public OfficeOnlineConfiguration getConfigurationForResponse() {
        return getEffectiveConfiguration().masked();
    }

    public OfficeOnlineConfiguration mergeRequestWithExisting(OfficeOnlineConfigurationTestRequest request) {
        OfficeOnlineConfiguration existing = getEffectiveConfiguration();
        String resolvedSecret = normalizeSecret(request.clientSecret(), existing.clientSecret());
        return new OfficeOnlineConfiguration(
                request.enabled() == null ? existing.enabled() : request.enabled(),
                defaultIfBlank(request.graphBaseUrl(), existing.graphBaseUrl()),
                defaultIfBlank(request.tenantId(), existing.tenantId()),
                defaultIfBlank(request.clientId(), existing.clientId()),
                resolvedSecret,
                defaultIfBlank(request.siteId(), existing.siteId()),
                defaultIfBlank(request.driveId(), existing.driveId()),
                defaultIfBlank(request.libraryFolder(), existing.libraryFolder()),
                normalizeShareLinkScope(defaultIfBlank(request.shareLinkScope(), existing.shareLinkScope())),
                request.reviewLinksEnabled() == null ? existing.reviewLinksEnabled() : request.reviewLinksEnabled()
        );
    }

    public JsonNode sanitizeGeneralConfigForResponse(JsonNode generalConfig) {
        if (!(generalConfig instanceof ObjectNode generalObject)) {
            return generalConfig;
        }

        ObjectNode generalCopy = generalObject.deepCopy();
        ObjectNode backupSettings = childObject(generalCopy, "backupSettings");
        if (backupSettings == null) {
            return generalCopy;
        }

        OfficeOnlineConfiguration effective = getEffectiveConfiguration();
        ObjectNode officeOnline = childObject(backupSettings, "officeOnline");
        if (officeOnline == null) {
            officeOnline = backupSettings.putObject("officeOnline");
        }

        officeOnline.put("enabled", effective.enabled());
        officeOnline.put("graphBaseUrl", safe(effective.graphBaseUrl()));
        officeOnline.put("tenantId", safe(effective.tenantId()));
        officeOnline.put("clientId", safe(effective.clientId()));
        officeOnline.put("clientSecret", safe(effective.clientSecret()));
        officeOnline.put("clientSecretConfigured", StringUtils.hasText(effective.clientSecret()));
        officeOnline.put("clientSecretMasked", StringUtils.hasText(effective.clientSecret()) ? SECRET_MASK : "");
        officeOnline.put("clearClientSecret", false);
        officeOnline.put("siteId", safe(effective.siteId()));
        officeOnline.put("driveId", safe(effective.driveId()));
        officeOnline.put("libraryFolder", safe(effective.libraryFolder()));
        officeOnline.put("shareLinkScope", safe(effective.shareLinkScope()));
        officeOnline.put("reviewLinksEnabled", effective.reviewLinksEnabled());
        return generalCopy;
    }

    public JsonNode mergeGeneralConfigForStorage(JsonNode incomingGeneral, JsonNode existingGeneral) {
        if (!(incomingGeneral instanceof ObjectNode incomingObject)) {
            return incomingGeneral;
        }
        ObjectNode merged = existingGeneral instanceof ObjectNode existingObject
                ? existingObject.deepCopy()
                : objectMapper.createObjectNode();
        merged.setAll(incomingObject);

        ObjectNode incomingBackup = childObject(incomingObject, "backupSettings");
        if (incomingBackup == null) {
            return merged;
        }

        ObjectNode mergedBackup = childObject(merged, "backupSettings");
        if (mergedBackup == null) {
            mergedBackup = merged.putObject("backupSettings");
        }
        mergedBackup.setAll(incomingBackup);

        ObjectNode incomingOffice = childObject(incomingBackup, "officeOnline");
        if (incomingOffice == null) {
            return merged;
        }

        ObjectNode existingOffice = childObject(existingGeneral, "backupSettings");
        existingOffice = existingOffice == null ? null : childObject(existingOffice, "officeOnline");
        ObjectNode mergedOffice = existingOffice == null ? objectMapper.createObjectNode() : existingOffice.deepCopy();
        mergedOffice.setAll(incomingOffice);

        String incomingSecret = text(incomingOffice, "clientSecret");
        String existingSecret = text(existingOffice, "clientSecret");
        boolean clearClientSecret = booleanValue(incomingOffice, "clearClientSecret", false);
        String resolvedSecret = clearClientSecret ? "" : normalizeSecret(incomingSecret, existingSecret);
        if (StringUtils.hasText(resolvedSecret)) {
            mergedOffice.put("clientSecret", resolvedSecret);
        } else {
            mergedOffice.put("clientSecret", "");
        }
        mergedOffice.remove("clientSecretMasked");
        mergedOffice.remove("clientSecretConfigured");
        mergedOffice.remove("clearClientSecret");

        mergedBackup.set("officeOnline", mergedOffice);
        merged.set("backupSettings", mergedBackup);
        return merged;
    }

    private OfficeOnlineConfiguration mergeWithEnvironment(JsonNode savedNode) {
        boolean enabled = booleanValue(savedNode, "enabled", envEnabled);
        return new OfficeOnlineConfiguration(
                enabled,
                defaultIfBlank(text(savedNode, "graphBaseUrl"), envGraphBaseUrl),
                defaultIfBlank(text(savedNode, "tenantId"), envTenantId),
                defaultIfBlank(text(savedNode, "clientId"), envClientId),
                defaultIfBlank(text(savedNode, "clientSecret"), envClientSecret),
                defaultIfBlank(text(savedNode, "siteId"), envSiteId),
                defaultIfBlank(text(savedNode, "driveId"), envDriveId),
                defaultIfBlank(text(savedNode, "libraryFolder"), envFolderPath),
                normalizeShareLinkScope(defaultIfBlank(text(savedNode, "shareLinkScope"), envShareLinkScope)),
                booleanValue(savedNode, "reviewLinksEnabled", false)
        );
    }

    private JsonNode extractOfficeOnlineNode(JsonNode generalConfig) {
        JsonNode backupSettings = generalConfig == null ? null : generalConfig.get("backupSettings");
        return backupSettings == null ? null : backupSettings.get("officeOnline");
    }

    private ObjectNode childObject(JsonNode node, String field) {
        JsonNode child = node == null ? null : node.get(field);
        return child instanceof ObjectNode objectNode ? objectNode : null;
    }

    private String normalizeSecret(String requestedSecret, String existingSecret) {
        if (StringUtils.hasText(requestedSecret) && !SECRET_MASK.equals(requestedSecret.trim())) {
            return requestedSecret.trim();
        }
        return existingSecret;
    }

    private String defaultIfBlank(String preferred, String fallback) {
        return StringUtils.hasText(preferred) ? preferred.trim() : (fallback == null ? "" : fallback.trim());
    }

    private String normalizeShareLinkScope(String value) {
        if ("users".equalsIgnoreCase(value) || "organization".equalsIgnoreCase(value)) {
            return value.toLowerCase();
        }
        return "users";
    }

    private String text(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        return value == null || value.isNull() ? null : value.asText();
    }

    private boolean booleanValue(JsonNode node, String field, boolean fallback) {
        JsonNode value = node == null ? null : node.get(field);
        return value == null || value.isNull() ? fallback : value.asBoolean(fallback);
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }

    public record OfficeOnlineConfiguration(
            boolean enabled,
            String graphBaseUrl,
            String tenantId,
            String clientId,
            String clientSecret,
            String siteId,
            String driveId,
            String libraryFolder,
            String shareLinkScope,
            boolean reviewLinksEnabled
    ) {
        /** Backward-compatible constructor for existing path-builder callers/tests. */
        public OfficeOnlineConfiguration(
                boolean enabled,
                String graphBaseUrl,
                String tenantId,
                String clientId,
                String clientSecret,
                String siteId,
                String driveId,
                String libraryFolder,
                String shareLinkScope
        ) {
            this(enabled, graphBaseUrl, tenantId, clientId, clientSecret, siteId, driveId, libraryFolder, shareLinkScope, false);
        }

        public OfficeOnlineConfiguration masked() {
            return new OfficeOnlineConfiguration(
                    enabled,
                    graphBaseUrl,
                    tenantId,
                    clientId,
                    "",
                    siteId,
                    driveId,
                    libraryFolder,
                    shareLinkScope,
                    reviewLinksEnabled
            );
        }
    }
}
