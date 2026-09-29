package com.eqms.service;

import com.eqms.entity.SystemConfiguration;
import com.eqms.repository.SystemConfigurationRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/**
 * Config-singleton service for OnlyOffice Document Server -- one {@code backupSettings.onlyOffice}
 * JSON node on the single {@code SystemConfiguration} row, env-var fallback merge, secret-masking
 * discipline for the JWT secret.
 */
@Service
public class OnlyOfficeConfigurationService {

    private static final String DEFAULT_CONFIG_KEY = "default";
    public static final String SECRET_MASK = "********";

    private final SystemConfigurationRepository systemConfigurationRepository;
    private final ObjectMapper objectMapper;

    @Value("${app.onlyoffice.enabled:false}")
    private boolean envEnabled;

    @Value("${app.onlyoffice.document-server-url:http://onlyoffice-documentserver}")
    private String envDocumentServerUrl;

    @Value("${app.onlyoffice.callback-base-url:http://backend:5000}")
    private String envCallbackBaseUrl;

    @Value("${app.onlyoffice.jwt-secret:}")
    private String envJwtSecret;

    public OnlyOfficeConfigurationService(
            SystemConfigurationRepository systemConfigurationRepository,
            ObjectMapper objectMapper
    ) {
        this.systemConfigurationRepository = systemConfigurationRepository;
        this.objectMapper = objectMapper;
    }

    public OnlyOfficeConfiguration getEffectiveConfiguration() {
        JsonNode savedNode = systemConfigurationRepository.findByConfigKey(DEFAULT_CONFIG_KEY)
                .map(SystemConfiguration::getGeneralConfig)
                .map(this::extractOnlyOfficeNode)
                .orElse(null);
        return mergeWithEnvironment(savedNode);
    }

    public OnlyOfficeConfiguration getConfigurationForResponse() {
        return getEffectiveConfiguration().masked();
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

        OnlyOfficeConfiguration effective = getEffectiveConfiguration();
        ObjectNode onlyOffice = childObject(backupSettings, "onlyOffice");
        if (onlyOffice == null) {
            onlyOffice = backupSettings.putObject("onlyOffice");
        }

        onlyOffice.put("enabled", effective.enabled());
        onlyOffice.put("documentServerUrl", safe(effective.documentServerUrl()));
        onlyOffice.put("callbackBaseUrl", safe(effective.callbackBaseUrl()));
        // Same non-disclosure rule as the Graph client secret: the browser only learns whether
        // a JWT secret is configured, never its value.
        onlyOffice.put("jwtSecret", "");
        onlyOffice.put("jwtSecretConfigured", StringUtils.hasText(effective.jwtSecret()));
        onlyOffice.put("jwtSecretMasked", StringUtils.hasText(effective.jwtSecret()) ? SECRET_MASK : "");
        onlyOffice.put("clearJwtSecret", false);
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

        ObjectNode incomingOnlyOffice = childObject(incomingBackup, "onlyOffice");
        if (incomingOnlyOffice == null) {
            merged.set("backupSettings", mergedBackup);
            return merged;
        }

        ObjectNode existingOnlyOffice = childObject(existingGeneral, "backupSettings");
        existingOnlyOffice = existingOnlyOffice == null ? null : childObject(existingOnlyOffice, "onlyOffice");
        ObjectNode mergedOnlyOffice = existingOnlyOffice == null
                ? objectMapper.createObjectNode()
                : existingOnlyOffice.deepCopy();
        mergedOnlyOffice.setAll(incomingOnlyOffice);

        String incomingSecret = text(incomingOnlyOffice, "jwtSecret");
        String existingSecret = text(existingOnlyOffice, "jwtSecret");
        boolean clearSecret = booleanValue(incomingOnlyOffice, "clearJwtSecret", false);
        String resolvedSecret = clearSecret ? "" : normalizeSecret(incomingSecret, existingSecret);
        mergedOnlyOffice.put("jwtSecret", resolvedSecret == null ? "" : resolvedSecret);
        mergedOnlyOffice.remove("jwtSecretMasked");
        mergedOnlyOffice.remove("jwtSecretConfigured");
        mergedOnlyOffice.remove("clearJwtSecret");

        mergedBackup.set("onlyOffice", mergedOnlyOffice);
        merged.set("backupSettings", mergedBackup);
        return merged;
    }

    /**
     * Community Edition options for the read-only Document-tab viewer. Set by the admin in
     * Settings > Configuration > Preview File ("viewer" object stored next to the connection settings).
     * Per-tab, left-panel and status-bar controls are White Label-only and are intentionally not represented here.
     */
    public record ViewerOptions(
            boolean showPluginsTab,
            boolean showRightMenu,
            boolean showFileName
    ) {}

    public ViewerOptions getViewerOptions() {
        JsonNode savedNode = systemConfigurationRepository.findByConfigKey(DEFAULT_CONFIG_KEY)
                .map(SystemConfiguration::getGeneralConfig)
                .map(this::extractOnlyOfficeNode)
                .orElse(null);
        JsonNode viewer = savedNode == null ? null : savedNode.get("viewer");
        return new ViewerOptions(
                booleanValue(viewer, "showPluginsTab", false),
                booleanValue(viewer, "showRightMenu", false),
                booleanValue(viewer, "showFileName", true)
        );
    }

    private OnlyOfficeConfiguration mergeWithEnvironment(JsonNode savedNode) {
        boolean enabled = booleanValue(savedNode, "enabled", envEnabled);
        return new OnlyOfficeConfiguration(
                enabled,
                defaultIfBlank(text(savedNode, "documentServerUrl"), envDocumentServerUrl),
                defaultIfBlank(text(savedNode, "callbackBaseUrl"), envCallbackBaseUrl),
                defaultIfBlank(text(savedNode, "jwtSecret"), envJwtSecret)
        );
    }

    private JsonNode extractOnlyOfficeNode(JsonNode generalConfig) {
        JsonNode backupSettings = generalConfig == null ? null : generalConfig.get("backupSettings");
        return backupSettings == null ? null : backupSettings.get("onlyOffice");
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

    public record OnlyOfficeConfiguration(
            boolean enabled,
            String documentServerUrl,
            String callbackBaseUrl,
            String jwtSecret
    ) {
        public OnlyOfficeConfiguration masked() {
            return new OnlyOfficeConfiguration(enabled, documentServerUrl, callbackBaseUrl, "");
        }
    }
}
