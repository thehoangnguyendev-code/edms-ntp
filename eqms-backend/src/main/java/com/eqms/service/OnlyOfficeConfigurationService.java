package com.eqms.service;

import com.eqms.entity.SystemConfiguration;
import com.eqms.repository.SystemConfigurationRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import com.eqms.service.editprovider.EditMode;
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

    /** The saved "viewer" settings as they are, for what is read on each opening (the mode of a stage, the watermark); empty when never set. */
    public JsonNode getViewerSettings() {
        JsonNode viewer = systemConfigurationRepository.findByConfigKey(DEFAULT_CONFIG_KEY)
                .map(SystemConfiguration::getGeneralConfig)
                .map(this::extractOnlyOfficeNode)
                .map(node -> node.get("viewer"))
                .orElse(null);
        return viewer == null || viewer.isNull() ? com.fasterxml.jackson.databind.node.MissingNode.getInstance() : viewer;
    }

    /**
     * How a reviewer or an approver opens the file in OnlyOffice at a stage that has a person act on it: Pending Review and Pending Approval. Set in Settings >
     * Configuration > Preview File > OnlyOffice Preview. Until it is set, Pending Review is Review (track changes) and Pending Approval is Comment Only, as it was.
     */
    public EditMode editModeForStage(String statusCode) {
        JsonNode viewer = getViewerSettings();
        if ("PENDING_REVIEW".equalsIgnoreCase(statusCode)) {
            return stageMode(viewer, "pendingReviewMode", EditMode.REVIEW);
        }
        if ("PENDING_APPROVAL".equalsIgnoreCase(statusCode)) {
            return stageMode(viewer, "pendingApprovalMode", EditMode.COMMENT_ONLY);
        }
        throw new IllegalArgumentException("No configurable OnlyOffice mode for status " + statusCode);
    }

    private static EditMode stageMode(JsonNode viewer, String field, EditMode fallback) {
        String value = viewer == null || viewer.path(field).isMissingNode() || viewer.path(field).isNull() ? null : viewer.path(field).asText();
        if ("REVIEW".equals(value)) {
            return EditMode.REVIEW;
        }
        if ("COMMENT_ONLY".equals(value)) {
            return EditMode.COMMENT_ONLY;
        }
        return fallback;
    }

    /** Checks the "viewer" block of a configuration save; a block or a field that is missing is fine. */
    public static void validateViewerSettings(JsonNode general) {
        JsonNode backup = general == null ? null : general.get("backupSettings");
        JsonNode onlyOffice = backup == null ? null : backup.get("onlyOffice");
        JsonNode viewer = onlyOffice == null ? null : onlyOffice.get("viewer");
        if (viewer == null || viewer.isNull()) {
            return;
        }
        if (!viewer.isObject()) {
            throw new IllegalArgumentException("OnlyOffice viewer settings must be an object");
        }
        for (String flag : java.util.List.of("showPluginsTab", "showRightMenu", "showFileName", "watermarkEnabled", "watermarkShowViewerName",
                "watermarkShowEmployeeCode", "watermarkShowOpenedAt", "watermarkTiled", "editorAllowDownload", "editorAllowPrint")) {
            JsonNode value = viewer.get(flag);
            if (value != null && !value.isNull() && !value.isBoolean()) {
                throw new IllegalArgumentException("OnlyOffice viewer " + flag + " must be true or false");
            }
        }
        for (String field : java.util.List.of("pendingReviewMode", "pendingApprovalMode")) {
            JsonNode value = viewer.get(field);
            if (value != null && !value.isNull() && (!value.isTextual() || !java.util.Set.of("REVIEW", "COMMENT_ONLY").contains(value.asText()))) {
                throw new IllegalArgumentException("OnlyOffice viewer " + field + " must be REVIEW or COMMENT_ONLY");
            }
        }
        JsonNode text = viewer.get("watermarkText");
        if (text != null && !text.isNull() && (!text.isTextual() || text.asText().trim().length() > 120)) {
            throw new IllegalArgumentException("OnlyOffice viewer watermark text must be at most 120 characters");
        }
        JsonNode strength = viewer.get("watermarkStrength");
        if (strength != null && !strength.isNull() && (!strength.isTextual() || !java.util.Set.of("light", "standard", "strong").contains(strength.asText()))) {
            throw new IllegalArgumentException("OnlyOffice viewer watermark strength must be light, standard, or strong");
        }
        JsonNode colour = viewer.get("watermarkColor");
        if (colour != null && !colour.isNull() && (!colour.isTextual() || !colour.asText().matches("^#[0-9A-Fa-f]{6}$"))) {
            throw new IllegalArgumentException("OnlyOffice viewer watermark colour must be a hex colour such as #B3B3F5");
        }
        JsonNode angle = viewer.get("watermarkAngle");
        if (angle != null && !angle.isNull() && (!angle.isInt() || angle.asInt() < -90 || angle.asInt() > 90)) {
            throw new IllegalArgumentException("OnlyOffice viewer watermark angle must be a whole number of degrees from -90 to 90");
        }
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
