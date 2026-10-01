package com.eqms.service;

import com.eqms.dto.user.SystemConfigurationRequest;
import com.eqms.dto.user.SystemConfigurationResponse;
import com.eqms.dto.user.SecurityConfigurationRequest;
import com.eqms.dto.user.SecurityConfigurationResponse;
import com.eqms.dto.user.StoragePathPreviewResponse;
import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.auth.CurrentUserService;
import com.eqms.entity.SystemConfiguration;
import com.eqms.entity.UserAccount;
import com.eqms.repository.SystemConfigurationRepository;
import com.eqms.repository.UserAccountRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Instant;
import java.util.Locale;
import java.util.UUID;
import java.util.List;
import java.util.ArrayList;
import java.util.Map;
import java.util.Objects;

@Service
public class SystemConfigurationService {

    private static final String DEFAULT_CONFIG_KEY = "default";
    private static final UUID SYSTEM_CONFIG_AUDIT_ENTITY_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final String ACTION_SYSTEM_CONFIGURATION_UPDATED = "SYSTEM_CONFIGURATION_UPDATED";
    private static final String ACTION_SYSTEM_SECURITY_CONFIGURATION_UPDATED = "SYSTEM_SECURITY_CONFIGURATION_UPDATED";
    private static final String SECRET_MASK = OnlyOfficeConfigurationService.SECRET_MASK;

    private final SystemConfigurationRepository repository;
    private final UserAccountRepository userRepository;
    private final ObjectMapper objectMapper;
    private final AuditTrailService auditTrailService;
    private final CurrentUserService currentUserService;
    private final NotificationRealtimeService notificationRealtimeService;

    @org.springframework.beans.factory.annotation.Autowired
    private PermissionEvaluationService permissionEvaluationService;
    private final EmailNotificationService emailNotificationService;
    private final StoragePathBuilder storagePathBuilder;
    private final String defaultMinioEndpoint;
    private final String defaultMinioBucket;
    private final String defaultMinioAccessKeyId;
    private final String defaultMinioSecretAccessKey;
    private final String defaultMinioDocumentsPrefix;
    private final String defaultMinioControlledCopiesPrefix;
    private final String defaultMinioTemplatesPrefix;
    private final String defaultMinioTrainingPrefix;
    private final String defaultMinioAuditPrefix;
    private final String defaultMinioTempPrefix;
    private final int defaultMinioRetentionYears;

    public SystemConfigurationService(
            SystemConfigurationRepository repository,
            UserAccountRepository userRepository,
            ObjectMapper objectMapper,
            AuditTrailService auditTrailService,
            CurrentUserService currentUserService,
            NotificationRealtimeService notificationRealtimeService,
            EmailNotificationService emailNotificationService,
            StoragePathBuilder storagePathBuilder,
            @Value("${app.minio.endpoint:http://localhost:9000}") String defaultMinioEndpoint,
            @Value("${app.minio.bucket:eqms-gmp-revisions}") String defaultMinioBucket,
            @Value("${app.minio.access-key:eqms-minio}") String defaultMinioAccessKeyId,
            @Value("${app.minio.secret-key:eqms-minio-secret}") String defaultMinioSecretAccessKey,
            @Value("${app.minio.documents-prefix:documents}") String defaultMinioDocumentsPrefix,
            @Value("${app.minio.controlled-copies-prefix:controlled-copies}") String defaultMinioControlledCopiesPrefix,
            @Value("${app.minio.templates-prefix:templates}") String defaultMinioTemplatesPrefix,
            @Value("${app.minio.training-prefix:training}") String defaultMinioTrainingPrefix,
            @Value("${app.minio.audit-prefix:audit}") String defaultMinioAuditPrefix,
            @Value("${app.minio.temp-prefix:temp}") String defaultMinioTempPrefix,
            @Value("${app.minio.retention-years:5}") int defaultMinioRetentionYears
    ) {
        this.repository = repository;
        this.userRepository = userRepository;
        this.objectMapper = objectMapper;
        this.auditTrailService = auditTrailService;
        this.currentUserService = currentUserService;
        this.notificationRealtimeService = notificationRealtimeService;
        this.emailNotificationService = emailNotificationService;
        this.storagePathBuilder = storagePathBuilder;
        this.defaultMinioEndpoint = defaultMinioEndpoint;
        this.defaultMinioBucket = defaultMinioBucket;
        this.defaultMinioAccessKeyId = defaultMinioAccessKeyId;
        this.defaultMinioSecretAccessKey = defaultMinioSecretAccessKey;
        this.defaultMinioDocumentsPrefix = defaultMinioDocumentsPrefix;
        this.defaultMinioControlledCopiesPrefix = defaultMinioControlledCopiesPrefix;
        this.defaultMinioTemplatesPrefix = defaultMinioTemplatesPrefix;
        this.defaultMinioTrainingPrefix = defaultMinioTrainingPrefix;
        this.defaultMinioAuditPrefix = defaultMinioAuditPrefix;
        this.defaultMinioTempPrefix = defaultMinioTempPrefix;
        this.defaultMinioRetentionYears = defaultMinioRetentionYears;
    }

    @Transactional
    public SystemConfigurationResponse getConfiguration() {
        return toResponse(requireConfiguration());
    }

    /**
     * Returns display-safe examples from the persisted configuration. The paths are built by
     * the production path builders, preventing the UI from duplicating storage conventions.
     */
    @Transactional(readOnly = true)
    public StoragePathPreviewResponse getStoragePathPreview() {
        JsonNode storage = requireConfiguration().getIntegrationsConfig().path("storage");
        UUID previewId = UUID.fromString("00000000-0000-0000-0000-000000000001");
        String document = "previewdocumentnumber";
        String batch = "previewbatchnumber";
        String copy = "previewcopynumber";
        String module = "previewmodule";
        String entity = "previewentityid";

        return new StoragePathPreviewResponse(
                replacePreviewTokens(storagePathBuilder.revisionSourceV2(storage, document, previewId, "source.pdf"), previewId)
                        .replace("source.pdf", "source.{extension}"),
                replacePreviewTokens(storagePathBuilder.controlledCopyPdfV2(storage, batch, copy, previewId), previewId),
                replacePreviewTokens(storagePathBuilder.publishingComponentTemplateV2(storage, previewId, 1, "previewcomponent", "previewlayout", "source.docx"), previewId)
                        .replace("/v1/", "/v{Version}/")
                        .replace("source.docx", "source.{extension}"),
                replacePreviewTokens(storagePathBuilder.trainingFile(storage, document, "previewrevisionnumber", "previewfiletype", "previewfilename"), previewId),
                replacePreviewTokens(storagePathBuilder.auditEvidence(storage, module, entity, "previewevidencefile"), previewId)
                        .replaceAll("[0-9a-f-]{36}_previewevidencefile$", "{Generated UUID}_{Evidence File}"),
                replacePreviewTokens(storagePathBuilder.tempFile(storage, module, entity, "previewtemporaryfile"), previewId)
                        .replaceAll("[0-9a-f-]{36}_previewtemporaryfile$", "{Generated UUID}_{Temporary File}")
        );
    }

    private String replacePreviewTokens(String path, UUID previewId) {
        return path
                .replace("previewdocumentnumber", "{Document Number}")
                .replace("previewbatchnumber", "{Batch Number}")
                .replace("previewcopynumber", "{Copy Number}")
                .replace("previewrevisionnumber", "{Revision Number}")
                .replace("previewfiletype", "{File Type}")
                .replace("previewfilename", "{File Name}")
                .replace("previewmodule", "{Module}")
                .replace("previewentityid", "{Entity ID}")
                .replace("previewcomponent", "{Component}")
                .replace("previewlayout", "{Layout}")
                .replace(previewId.toString(), "{Revision ID}");
    }

    @Transactional
    @CacheEvict(cacheNames = {"public-branding", "public-localization", "public-navigation-labels"}, allEntries = true)
    public SystemConfigurationResponse updateConfiguration(SystemConfigurationRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        SystemConfiguration config = requireConfiguration();
        JsonNode previousGeneral = config.getGeneralConfig();
        JsonNode previousSecurity = config.getSecurityConfig();
        JsonNode previousDocuments = config.getDocumentsConfig();
        JsonNode previousNotifications = config.getNotificationsConfig();
        JsonNode previousIntegrations = config.getIntegrationsConfig();
        JsonNode previousFeatures = config.getFeaturesConfig();
        validateSecurityConfig(defaultIfNull(request.security(), config.getSecurityConfig()));
        JsonNode nextGeneral = request.general() == null
                ? config.getGeneralConfig()
                : onlyOfficeConfigurationService.mergeGeneralConfigForStorage(request.general(), config.getGeneralConfig());
        validateDesktopFilterConfig(nextGeneral);
        config.setGeneralConfig(nextGeneral);
        config.setSecurityConfig(defaultIfNull(request.security(), config.getSecurityConfig()));
        if (request.documents() != null) {
            validateDocumentsConfig(request.documents());
        }
        config.setDocumentsConfig(mergeDocumentsConfig(request.documents(), config.getDocumentsConfig()));
        config.setNotificationsConfig(defaultIfNull(request.notifications(), config.getNotificationsConfig()));
        config.setIntegrationsConfig(request.integrations() == null
                ? config.getIntegrationsConfig()
                : mergeIntegrationsConfigForStorage(request.integrations(), config.getIntegrationsConfig()));
        config.setFeaturesConfig(defaultIfNull(request.features(), config.getFeaturesConfig()));
        SystemConfiguration saved = repository.save(config);
        
        // Also update admin user email to match senderEmail if configured
        if (request.notifications() != null) {
            JsonNode emailConfig = request.notifications().path("emailConfig");
            if (emailConfig != null && !emailConfig.isMissingNode()) {
                String senderEmail = emailConfig.path("senderEmail").asText("");
                if (!senderEmail.isBlank() && !"noreply@eqms.com".equals(senderEmail) && !"noreply@example.com".equals(senderEmail)) {
                    userRepository.findByUsername("admin").ifPresent(admin -> {
                        admin.setEmail(senderEmail);
                        userRepository.save(admin);
                    });
                }
            }
        }
        List<AuditTrailChangeResponse> changes = buildConfigurationChanges(
                previousGeneral,
                previousSecurity,
                previousDocuments,
                previousNotifications,
                previousIntegrations,
                previousFeatures,
                saved
        );
        auditTrailService.logAs(
                currentUser,
                "SYSTEM_CONFIGURATION",
                "System Configuration",
                SYSTEM_CONFIG_AUDIT_ENTITY_ID,
                ACTION_SYSTEM_CONFIGURATION_UPDATED,
                null,
                null,
                "Updated system configuration",
                changes
        );
        sendPreferenceUpdateNotification(
                "General and notification settings updated",
                summarizeConfigFromSections(previousGeneral, previousSecurity, previousDocuments, previousNotifications, previousIntegrations, previousFeatures),
                summarizeConfig(saved)
        );
        publishBrandingInvalidationAfterCommit(previousGeneral, nextGeneral);
        publishOnlyOfficeViewerInvalidationAfterCommit(previousGeneral, nextGeneral);
        publishDocumentsPreviewInvalidationAfterCommit(previousDocuments, saved.getDocumentsConfig());
        publishSecurityConfigInvalidationAfterCommit(previousSecurity, saved.getSecurityConfig());
        return toResponse(saved);
    }

    /**
     * Session timeout (and other Security tab settings read once into a long-lived browser tab,
     * e.g. by SessionTimeoutGuard) must not wait for that tab's next reload. The event carries no
     * configuration data; each authenticated browser re-reads the system configuration endpoint.
     */
    private void publishSecurityConfigInvalidationAfterCommit(JsonNode previousSecurity, JsonNode nextSecurity) {
        if (Objects.equals(previousSecurity, nextSecurity)) {
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                notificationRealtimeService.publishGlobalEvent("security-config-updated");
            }
        });
    }

    /**
     * A branding refresh is presentation-only, but clients must never observe it before the
     * configuration and its audit entry commit. The SSE payload contains no configuration data;
     * each authenticated browser re-reads the public branding endpoint after this signal.
     */
    private void publishBrandingInvalidationAfterCommit(JsonNode previousGeneral, JsonNode nextGeneral) {
        if (Objects.equals(previousGeneral, nextGeneral)) {
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                notificationRealtimeService.publishGlobalEvent("branding-updated");
            }
        });
    }

    /**
     * The OnlyOffice viewer reads its signed UI customization only while it is being created.
     * Notify connected browsers after the configuration and its audit entry commit, so they can
     * re-open an already-authorized viewer without a page reload. The event deliberately carries
     * no configuration, document, or user data.
     */
    private void publishOnlyOfficeViewerInvalidationAfterCommit(JsonNode previousGeneral, JsonNode nextGeneral) {
        if (!hasOnlyOfficeViewerChange(previousGeneral, nextGeneral)) {
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                notificationRealtimeService.publishGlobalEvent("onlyoffice-viewer-config-updated");
            }
        });
    }

    static boolean hasOnlyOfficeViewerChange(JsonNode previousGeneral, JsonNode nextGeneral) {
        return !Objects.equals(onlyOfficeViewerNode(previousGeneral), onlyOfficeViewerNode(nextGeneral));
    }

    private static JsonNode onlyOfficeViewerNode(JsonNode generalConfig) {
        JsonNode backupSettings = generalConfig == null ? null : generalConfig.get("backupSettings");
        JsonNode onlyOffice = backupSettings == null ? null : backupSettings.get("onlyOffice");
        return onlyOffice == null ? null : onlyOffice.get("viewer");
    }

    private void publishDocumentsPreviewInvalidationAfterCommit(JsonNode previousDocuments, JsonNode nextDocuments) {
        if (!hasDocumentsPreviewChange(previousDocuments, nextDocuments)) return;
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                notificationRealtimeService.publishGlobalEvent("documents-preview-config-updated");
            }
        });
    }

    static boolean hasDocumentsPreviewChange(JsonNode previousDocuments, JsonNode nextDocuments) {
        return !Objects.equals(previewPolicyNode(previousDocuments), previewPolicyNode(nextDocuments));
    }

    private static JsonNode previewPolicyNode(JsonNode documents) {
        ObjectNode result = com.fasterxml.jackson.databind.node.JsonNodeFactory.instance.objectNode();
        if (documents != null) {
            for (String field : java.util.List.of("enableWatermark", "allowDownload", "pdfPreview")) {
                JsonNode value = documents.get(field);
                if (value != null) result.set(field, value);
            }
        }
        return result;
    }

    @Transactional(readOnly = true)
    @Cacheable(cacheNames = "public-branding", key = "'current'")
    public com.eqms.dto.configuration.PublicBrandingResponse getPublicBranding() {
        JsonNode general = requireConfiguration().getGeneralConfig();
        JsonNode appearance = general == null ? null : general.get("appearance");
        return new com.eqms.dto.configuration.PublicBrandingResponse(
                textValue(general, "systemDisplayName"),
                textValue(general, "systemLogo"),
                appearance != null && textValue(appearance, "systemSidebarCollapsedLogo") != null
                        ? textValue(appearance, "systemSidebarCollapsedLogo")
                        : textValue(general, "systemSidebarCollapsedLogo"),
                appearance != null && appearance.path("showSidebarUserProfile").asBoolean(false),
                appearance != null && appearance.path("knowledgeExplorerEnabled").asBoolean(false),
                appearance != null && appearance.path("compactDesktopFilters").asBoolean(false),
                textValue(general, "systemFavicon"),
                appearance == null ? null : textValue(appearance, "systemFooter"),
                readStringMap(general == null ? null : general.get("navigationLabelOverrides"))
        );
    }

    static void validateDesktopFilterConfig(JsonNode general) {
        JsonNode appearance = general == null ? null : general.get("appearance");
        JsonNode compact = appearance == null ? null : appearance.get("compactDesktopFilters");
        if (compact != null && !compact.isBoolean()) {
            throw new IllegalArgumentException("compactDesktopFilters must be true or false");
        }
    }

    @Transactional(readOnly = true)
    @Cacheable(cacheNames = "public-navigation-labels", key = "'current'")
    public Map<String, String> getNavigationLabelOverrides() {
        JsonNode general = requireConfiguration().getGeneralConfig();
        return readStringMap(general == null ? null : general.get("navigationLabelOverrides"));
    }

    private Map<String, String> readStringMap(JsonNode node) {
        if (node == null || !node.isObject()) {
            return Map.of();
        }
        Map<String, String> values = new java.util.LinkedHashMap<>();
        node.fields().forEachRemaining(entry -> {
            if (entry.getValue().isTextual() && !entry.getValue().asText().isBlank()) {
                values.put(entry.getKey(), entry.getValue().asText());
            }
        });
        return Map.copyOf(values);
    }

    @Transactional(readOnly = true)
    @Cacheable(cacheNames = "public-localization", key = "'current'")
    public com.eqms.dto.configuration.PublicLocalizationResponse getPublicLocalization() {
        JsonNode general = requireConfiguration().getGeneralConfig();
        JsonNode locale = general == null ? null : general.get("locale");
        return new com.eqms.dto.configuration.PublicLocalizationResponse(
                locale == null ? null : textValue(locale, "language"),
                textValue(general, "dateTimeFormat"),
                textValue(general, "timeZone"),
                locale == null ? null : textValue(locale, "numberFormat")
        );
    }

    @Transactional(readOnly = true)
    public SecurityConfigurationResponse getSecurityConfiguration() {
        return new SecurityConfigurationResponse(getSessionTimeoutMinutes());
    }

    /** Admin-selected seed for the FIRST revision number of newly created documents.
     *  Supported: "0.0.1" (three-part) and "0.1" (two-part). Falls back to "0.0.1". */
    @Transactional(readOnly = true)
    public String getRevisionNumberSeed() {
        JsonNode documents = requireConfiguration().getDocumentsConfig();
        if (documents == null) {
            return "0.0.1";
        }
        JsonNode value = documents.get("revisionNumberSeed");
        if (value == null || value.isNull()) {
            return "0.0.1";
        }
        String seed = value.asText("").trim();
        return ("0.0.1".equals(seed) || "0.1".equals(seed)) ? seed : "0.0.1";
    }

    /**
     * Admin-selected fallback Document Name Format (Document Properties screen), used by
     * DocumentService#generateDocumentNumber only when the Document Type being numbered has no
     * Format of its own assigned. Null when unset -- callers fall back to the legacy hardcoded
     * "TYPE.NNNN" shape, same as if this key never existed.
     */
    @Transactional(readOnly = true)
    public java.util.UUID getDefaultDocumentNameFormatId() {
        JsonNode documents = requireConfiguration().getDocumentsConfig();
        if (documents == null) {
            return null;
        }
        JsonNode value = documents.get("defaultDocumentNameFormatId");
        String text = value == null || value.isNull() ? null : value.asText(null);
        if (text == null || text.trim().isEmpty()) {
            return null;
        }
        try {
            return java.util.UUID.fromString(text.trim());
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    /**
     * Zero-padding width for the Serial Number Document Component (Document Properties screen).
     * Defaults to 4 (the pre-existing hardcoded behavior) when unset or out of the sane 1-9 range
     * -- 9 is the practical ceiling before a serial number risks overflowing a 32-bit sequence
     * column. Only affects NEW document numbers generated going forward; existing document
     * numbers already issued at a different width are never rewritten.
     */
    @Transactional(readOnly = true)
    public int getSerialNumberDigits() {
        JsonNode documents = requireConfiguration().getDocumentsConfig();
        if (documents == null) {
            return 4;
        }
        JsonNode value = documents.get("serialNumberDigits");
        if (value == null || value.isNull() || !value.isIntegralNumber()) {
            return 4;
        }
        int digits = value.asInt(4);
        return digits >= 1 && digits <= 9 ? digits : 4;
    }

    /**
     * The 4 Document Master participant roles -- one independent on/off setting each (Document
     * Properties > Protection & Distribution) -- whose REMOVED holder keeps read-only visibility of
     * the Document afterwards (e.g. a DCO reassigning the Author via "Edit Revision for Upgrade" on
     * Document Detail), via the permanent {@code document_stakeholder_history} record of everyone
     * who was ever assigned that role (see V458). Each defaults to false -- zero behavior change
     * for anyone who never touches this setting: a removed participant with no separate
     * revision-level footprint stops seeing the Document, exactly as before this setting existed.
     */
    private static final java.util.Map<String, String> RETAIN_VISIBILITY_CONFIG_KEY_BY_PARTICIPANT_TYPE = java.util.Map.of(
            "AUTHOR", "retainVisibilityForRemovedAuthor",
            "CO_AUTHOR", "retainVisibilityForRemovedCoAuthor",
            "REVIEWER", "retainVisibilityForRemovedReviewer",
            "APPROVER", "retainVisibilityForRemovedApprover"
    );

    /** The subset of AUTHOR/CO_AUTHOR/REVIEWER/APPROVER currently enabled -- empty set (not null)
     *  when none are, so callers can pass it straight into an IN-clause. */
    @Transactional(readOnly = true)
    public java.util.Set<String> getRetainVisibilityForRemovedParticipantTypes() {
        JsonNode documents = requireConfiguration().getDocumentsConfig();
        if (documents == null) {
            return java.util.Set.of();
        }
        java.util.Set<String> enabled = new java.util.LinkedHashSet<>();
        for (var entry : RETAIN_VISIBILITY_CONFIG_KEY_BY_PARTICIPANT_TYPE.entrySet()) {
            JsonNode value = documents.get(entry.getValue());
            if (value != null && value.asBoolean(false)) {
                enabled.add(entry.getKey());
            }
        }
        return enabled;
    }

    /**
     * Whether Document Revision Reviewers may act in any order (true) instead of the historical
     * one-at-a-time sequence gated by {@code sequenceOrder} (false, the default -- zero behavior
     * change for anyone who never touches this setting). Read by
     * RevisionWorkflowAuthorizationService (who may act right now) and RevisionService (server-side
     * re-check at the point of action) -- both must agree, so this is the single source of truth
     * for either to consult rather than each keeping its own flag.
     */
    /** Days a Review/Approval may wait before the assignee is reminded; 0 disables reminders. */
    @Transactional(readOnly = true)
    public int getWorkflowReminderAfterDays() {
        return getDaysDocumentsConfig("workflowReminderAfterDays", 3);
    }

    /** Days a Review/Approval may wait before Document Control is told; 0 disables escalation. */
    @Transactional(readOnly = true)
    public int getWorkflowEscalationAfterDays() {
        return getDaysDocumentsConfig("workflowEscalationAfterDays", 7);
    }

    /** How many documents each Knowledge portal card lists (1-20, default 5). */
    @Transactional(readOnly = true)
    public int getKnowledgePortalTopCount() {
        int value = getDaysDocumentsConfig("knowledgePortalTopCount", 5);
        return value >= 1 && value <= 20 ? value : 5;
    }

    /** Days of views that count towards "Most Viewed" (1-365, default 30). */
    @Transactional(readOnly = true)
    public int getKnowledgePortalViewsWindowDays() {
        int value = getDaysDocumentsConfig("knowledgePortalViewsWindowDays", 30);
        return value >= 1 ? value : 30;
    }

    public static final String EFFECTIVE_DATE_AFTER_APPROVAL = "AFTER_APPROVAL";
    public static final String EFFECTIVE_DATE_AFTER_TRAINING = "AFTER_TRAINING";
    public static final String EFFECTIVE_DATE_AFTER_PUBLISH = "AFTER_PUBLISH";

    /**
     * What event the Effective Date is counted from: AFTER_APPROVAL (last Approver completed, the
     * default), AFTER_TRAINING (training completion date) or AFTER_PUBLISH (the DCO publishing).
     * Unknown or missing values fall back to the default. Legacy single setting, superseded by the
     * Required/Non-Required Training split below but kept as the migration fallback for installs
     * saved before the split.
     */
    @Transactional(readOnly = true)
    public String getEffectiveDateBasis() {
        JsonNode documents = requireConfiguration().getDocumentsConfig();
        String value = documents == null || documents.get("effectiveDateBasis") == null
                ? null : documents.get("effectiveDateBasis").asText(null);
        if (EFFECTIVE_DATE_AFTER_TRAINING.equals(value) || EFFECTIVE_DATE_AFTER_PUBLISH.equals(value)) {
            return value;
        }
        return EFFECTIVE_DATE_AFTER_APPROVAL;
    }

    /** Calendar days added to the basis event to get the Effective Date (0-365, default 0 = same day). Legacy
     *  single setting; see {@link #getEffectiveDateBasis()}. */
    @Transactional(readOnly = true)
    public int getEffectiveDateOffsetDays() {
        int value = getDaysDocumentsConfig("effectiveDateOffsetDays", 0);
        return value >= 0 && value <= 365 ? value : 0;
    }

    /**
     * What event the Effective Date is counted from, split by whether the revision's document was
     * flagged "Requires Training" at creation (a per-document decision the user makes when the
     * document is created, not editable afterward). A Non-Required-Training document is never
     * offered AFTER_TRAINING -- there is no training completion event to count from -- so an
     * invalid/legacy value for that case falls back to AFTER_APPROVAL, not AFTER_TRAINING.
     * Falls back to the legacy single {@link #getEffectiveDateBasis()} setting when the split key was
     * never saved (pre-split installs), so existing configuration is not silently reset.
     */
    @Transactional(readOnly = true)
    public String getEffectiveDateBasis(boolean requiresTraining) {
        JsonNode documents = requireConfiguration().getDocumentsConfig();
        String key = requiresTraining ? "effectiveDateBasisTrainingRequired" : "effectiveDateBasisTrainingNotRequired";
        String value = readOptionalText(documents, key);
        if (value == null) {
            value = getEffectiveDateBasis();
        }
        java.util.Set<String> allowed = requiresTraining
                ? java.util.Set.of(EFFECTIVE_DATE_AFTER_APPROVAL, EFFECTIVE_DATE_AFTER_TRAINING, EFFECTIVE_DATE_AFTER_PUBLISH)
                : java.util.Set.of(EFFECTIVE_DATE_AFTER_APPROVAL, EFFECTIVE_DATE_AFTER_PUBLISH);
        return allowed.contains(value) ? value : EFFECTIVE_DATE_AFTER_APPROVAL;
    }

    /** Calendar days added to the basis event, split by Required/Non-Required Training; see
     *  {@link #getEffectiveDateBasis(boolean)}. Falls back to the legacy single
     *  {@link #getEffectiveDateOffsetDays()} setting when the split key was never saved. */
    @Transactional(readOnly = true)
    public int getEffectiveDateOffsetDays(boolean requiresTraining) {
        String key = requiresTraining ? "effectiveDateOffsetDaysTrainingRequired" : "effectiveDateOffsetDaysTrainingNotRequired";
        JsonNode documents = requireConfiguration().getDocumentsConfig();
        JsonNode value = documents == null ? null : documents.get(key);
        if (value == null || value.isNull() || !value.isIntegralNumber()) {
            return getEffectiveDateOffsetDays();
        }
        int days = value.asInt(0);
        return days >= 0 && days <= 365 ? days : 0;
    }

    private String readOptionalText(JsonNode documents, String key) {
        JsonNode node = documents == null ? null : documents.get(key);
        return node == null || node.isNull() ? null : node.asText(null);
    }

    private int getDaysDocumentsConfig(String key, int defaultDays) {
        JsonNode documents = requireConfiguration().getDocumentsConfig();
        JsonNode value = documents == null ? null : documents.get(key);
        if (value == null || value.isNull() || !value.isIntegralNumber()) {
            return defaultDays;
        }
        int days = value.asInt(defaultDays);
        return days >= 0 && days <= 365 ? days : defaultDays;
    }

    @Transactional(readOnly = true)
    public boolean isParallelReviewEnabled() {
        return getBooleanDocumentsConfig("parallelReviewEnabled");
    }

    /**
     * Whether the configured Reviewer/Approver sequence still gates "who may act right now" for
     * this participant type -- {@code false} once the Parallel Review switch is on. Approvers are
     * always sequence-gated (the system allows exactly one Approver, so there is no Parallel
     * Approval option). Single source of truth for the REVIEWER/APPROVER branching that
     * RevisionWorkflowAuthorizationService#isPendingReviewer/isPendingApprover (read-time capability
     * check, against the generic {@code workflow_participants} table) and
     * RevisionService#requirePendingParticipant (mutation-time re-check, against
     * {@code revision_workflow_participants}) each re-derive against their own participant table --
     * this only centralizes the shared "is sequence enforced" business rule, not the two tables
     * themselves, which remain intentionally separate data sources.
     */
    @Transactional(readOnly = true)
    public boolean isSequenceEnforcedForParticipantType(String participantType) {
        if ("REVIEWER".equalsIgnoreCase(participantType)) {
            return !isParallelReviewEnabled();
        }
        return true;
    }

    private boolean getBooleanDocumentsConfig(String key) {
        JsonNode documents = requireConfiguration().getDocumentsConfig();
        if (documents == null) {
            return false;
        }
        JsonNode value = documents.get(key);
        return value != null && value.isBoolean() && value.asBoolean(false);
    }

    @Transactional(readOnly = true)
    public boolean isDocumentWatermarkEnabled() {
        JsonNode documents = requireConfiguration().getDocumentsConfig();
        if (documents == null) {
            return true;
        }
        JsonNode value = documents.get("enableWatermark");
        return value == null || value.isNull() || value.asBoolean(true);
    }

    @Transactional(readOnly = true)
    public boolean isMaintenanceModeEnabled() {
        JsonNode general = requireConfiguration().getGeneralConfig();
        if (general == null) {
            return false;
        }
        JsonNode value = general.get("maintenanceMode");
        return value != null && !value.isNull() && value.asBoolean(false);
    }

    @Transactional(readOnly = true)
    public int getDocumentMaxFileSizeMb() {
        JsonNode documents = requireConfiguration().getDocumentsConfig();
        if (documents == null) {
            return 25;
        }
        JsonNode value = documents.get("maxFileSizeMB");
        if (value == null || value.isNull() || !value.canConvertToInt()) {
            return 25;
        }
        int size = value.asInt(25);
        // Keep the domain setting aligned with Spring's multipart request ceiling.
        return Math.min(Math.max(size, 1), 100);
    }

    @Transactional
    public SecurityConfigurationResponse updateSecurityConfiguration(SecurityConfigurationRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        // Same permission that already gates the broader /configurations/system endpoint, which
        // can set this exact securityConfig field wholesale -- this narrower endpoint used to be
        // gated more strictly (super-admin-only), which was inconsistent, not more secure.
        if (!permissionEvaluationService.hasPermission(currentUser, "settings.configuration.manage")) {
            throw new org.springframework.security.access.AccessDeniedException("Current user is not allowed to edit system configuration");
        }
        SystemConfiguration config = requireConfiguration();
        int previousTimeout = getSessionTimeoutMinutes(config);
        ObjectNode securityConfig = config.getSecurityConfig() != null && config.getSecurityConfig().isObject()
                ? (ObjectNode) config.getSecurityConfig().deepCopy()
                : objectMapper.createObjectNode();
        securityConfig.put("sessionTimeoutMinutes", request.sessionTimeoutMinutes());
        config.setSecurityConfig(securityConfig);
        SystemConfiguration saved = repository.save(config);
        auditTrailService.logAs(
                currentUser,
                "SYSTEM_CONFIGURATION",
                "System Configuration",
                SYSTEM_CONFIG_AUDIT_ENTITY_ID,
                ACTION_SYSTEM_SECURITY_CONFIGURATION_UPDATED,
                String.valueOf(previousTimeout),
                String.valueOf(request.sessionTimeoutMinutes()),
                ACTION_SYSTEM_SECURITY_CONFIGURATION_UPDATED,
                List.of(
                        new AuditTrailChangeResponse("Session Timeout Minutes", String.valueOf(previousTimeout), String.valueOf(request.sessionTimeoutMinutes()))
                )
        );
        sendPreferenceUpdateNotification(
                "Security settings updated",
                summarizeConfigFromSections(config.getGeneralConfig(), config.getSecurityConfig(), config.getDocumentsConfig(), config.getNotificationsConfig(), config.getIntegrationsConfig(), config.getFeaturesConfig()),
                "Session Timeout=" + request.sessionTimeoutMinutes() + " minutes"
        );
        return new SecurityConfigurationResponse(getSessionTimeoutMinutes(saved));
    }

    public SystemConfiguration requireConfiguration() {
        SystemConfiguration config = repository.findByConfigKey(DEFAULT_CONFIG_KEY)
                .orElseGet(() -> repository.save(buildDefaultConfiguration()));
        return migrateFeaturesIfNecessary(config);
    }

    private SystemConfiguration migrateFeaturesIfNecessary(SystemConfiguration config) {
        JsonNode features = config.getFeaturesConfig();
        boolean needsMigration = features == null || !features.isArray();
        if (!needsMigration) {
            for (JsonNode f : features) {
                if (isRetiredModuleFeature(f.path("id").asText())) {
                    needsMigration = true;
                    break;
                }
            }
        }

        if (needsMigration) {
            boolean oldEdmsEnabled = true;
            boolean oldTmsEnabled = true;
            boolean oldQualityEnabled = false;

            if (features != null && features.isArray()) {
                for (JsonNode f : features) {
                    String id = f.path("id").asText();
                    boolean enabled = f.path("enabled").asBoolean(true);
                    if ("feat-001".equals(id)) {
                        oldEdmsEnabled = enabled;
                    } else if ("feat-002".equals(id)) {
                        oldTmsEnabled = enabled;
                    } else if ("feat-003".equals(id)) {
                        oldQualityEnabled = enabled;
                    }
                }
            }

            JsonNode defaultFeatures = filterCurrentModuleFeatures(features);
            if (defaultFeatures == null || !defaultFeatures.isArray() || defaultFeatures.isEmpty()) {
                defaultFeatures = buildDefaultFeaturesJson();
            }
            if (defaultFeatures.isArray()) {
                for (JsonNode f : defaultFeatures) {
                    if (f instanceof ObjectNode) {
                        ObjectNode obj = (ObjectNode) f;
                        String id = obj.path("id").asText();
                        if ("feat-edms".equals(id)) {
                            obj.put("enabled", oldEdmsEnabled);
                        } else if ("feat-tms".equals(id)) {
                            obj.put("enabled", oldTmsEnabled);
                        } else if ("feat-quality".equals(id)) {
                            obj.put("enabled", oldQualityEnabled);
                        }
                    }
                }
            }
            config.setFeaturesConfig(defaultFeatures);
            config = repository.save(config);
        }
        return config;
    }

    private boolean isRetiredModuleFeature(String id) {
        return "feat-my-tasks".equals(id)
                || "feat-edms-archive".equals(id)
                || id.startsWith("feat-quality")
                || id.startsWith("feat-operations")
                || id.startsWith("feat-regulatory");
    }

    private JsonNode filterCurrentModuleFeatures(JsonNode features) {
        if (features == null || !features.isArray()) {
            return features;
        }
        ArrayNode filtered = objectMapper.createArrayNode();
        for (JsonNode feature : features) {
            if (!isRetiredModuleFeature(feature.path("id").asText())) {
                filtered.add(feature);
            }
        }
        return filtered;
    }

    private JsonNode buildDefaultFeaturesJson() {
        JsonNode defaults = filterCurrentModuleFeatures(parse("""
            [
              {
                "id": "feat-dashboard",
                "name": "Dashboard",
                "description": "Real-time charts, metrics, and summary views.",
                "enabled": true,
                "category": "Core"
              },
              {
                "id": "feat-my-tasks",
                "name": "My Tasks",
                "description": "Personal inbox for tasks, workflows, and training assignments.",
                "enabled": true,
                "category": "Core"
              },
              {
                "id": "feat-notifications",
                "name": "Notifications",
                "description": "Real-time email and in-app system notifications.",
                "enabled": true,
                "category": "Core"
              },
              {
                "id": "feat-edms",
                "name": "Electronic Document Management (EDMS)",
                "description": "Core module for document lifecycle management, versioning, and controlled access.",
                "enabled": true,
                "category": "Core"
              },
              {
                "id": "feat-edms-kb",
                "name": "Knowledge Base",
                "description": "Access public knowledge base and document repository.",
                "enabled": true,
                "category": "Core",
                "parentId": "feat-edms"
              },
              {
                "id": "feat-edms-owned",
                "name": "Documents Owned By Me",
                "description": "Manage documents owned by the logged-in user.",
                "enabled": true,
                "category": "Core",
                "parentId": "feat-edms"
              },
              {
                "id": "feat-edms-all",
                "name": "All Documents",
                "description": "Administrative list of all system documents.",
                "enabled": true,
                "category": "Core",
                "parentId": "feat-edms"
              },
              {
                "id": "feat-edms-revisions",
                "name": "Document Revisions",
                "description": "Track draft documents, revisions, and approval workflows.",
                "enabled": true,
                "category": "Core",
                "parentId": "feat-edms"
              },
              {
                "id": "feat-edms-copies",
                "name": "Controlled Copies",
                "description": "Track and distribute paper/PDF controlled copies.",
                "enabled": true,
                "category": "Core",
                "parentId": "feat-edms"
              },
              {
                "id": "feat-tms",
                "name": "Training Management System (TMS)",
                "description": "Manage employee training records, curriculum, and compliance tracking.",
                "enabled": true,
                "category": "Core"
              },
              {
                "id": "feat-tms-my",
                "name": "My Training",
                "description": "View and complete assigned training courses.",
                "enabled": true,
                "category": "Core",
                "parentId": "feat-tms"
              },
              {
                "id": "feat-tms-materials",
                "name": "Training Materials",
                "description": "Access training materials, slides, and documents.",
                "enabled": true,
                "category": "Core",
                "parentId": "feat-tms"
              },
              {
                "id": "feat-tms-courses",
                "name": "Course Inventory",
                "description": "Manage training courses and approval workflows.",
                "enabled": true,
                "category": "Core",
                "parentId": "feat-tms"
              },
              {
                "id": "feat-tms-compliance",
                "name": "Compliance Tracking",
                "description": "Training matrix, rules, and course statuses.",
                "enabled": true,
                "category": "Core",
                "parentId": "feat-tms"
              },
              {
                "id": "feat-tms-records",
                "name": "Records & Archive",
                "description": "Employee files and exportable compliance logs.",
                "enabled": true,
                "category": "Core",
                "parentId": "feat-tms"
              },
              {
                "id": "feat-quality",
                "name": "Quality Processes",
                "description": "Quality events and deviation handling workflows.",
                "enabled": true,
                "category": "Quality"
              },
              {
                "id": "feat-quality-deviations",
                "name": "Deviations & NCs",
                "description": "Report and investigate deviations and non-conformances.",
                "enabled": true,
                "category": "Quality",
                "parentId": "feat-quality"
              },
              {
                "id": "feat-quality-capa",
                "name": "CAPA Management",
                "description": "Corrective and Preventive Action plans.",
                "enabled": true,
                "category": "Quality",
                "parentId": "feat-quality"
              },
              {
                "id": "feat-quality-change",
                "name": "Change Controls",
                "description": "Manage structural and operational changes.",
                "enabled": true,
                "category": "Quality",
                "parentId": "feat-quality"
              },
              {
                "id": "feat-quality-complaints",
                "name": "Complaints Management",
                "description": "Track customer quality feedback and complaints.",
                "enabled": true,
                "category": "Quality",
                "parentId": "feat-quality"
              },
              {
                "id": "feat-quality-risk",
                "name": "Risk Management (FMEA)",
                "description": "Tools for proactive risk assessment and mitigation.",
                "enabled": true,
                "category": "Quality",
                "parentId": "feat-quality"
              },
              {
                "id": "feat-operations",
                "name": "Operations Management",
                "description": "Modules for physical and supplier operations.",
                "enabled": true,
                "category": "Operations"
              },
              {
                "id": "feat-operations-equipment",
                "name": "Equipment Management",
                "description": "Track instruments, calibrations, and maintenance schedules.",
                "enabled": true,
                "category": "Operations",
                "parentId": "feat-operations"
              },
              {
                "id": "feat-operations-supplier",
                "name": "Supplier Management",
                "description": "Evaluate vendor quality, approvals, and performance.",
                "enabled": true,
                "category": "Operations",
                "parentId": "feat-operations"
              },
              {
                "id": "feat-operations-product",
                "name": "Product Management",
                "description": "Monitor product master data and specifications.",
                "enabled": true,
                "category": "Operations",
                "parentId": "feat-operations"
              },
              {
                "id": "feat-regulatory",
                "name": "Regulatory Track",
                "description": "Regulatory files and compliance reporting.",
                "enabled": true,
                "category": "Regulatory"
              },
              {
                "id": "feat-regulatory-management",
                "name": "Regulatory Management",
                "description": "Track regulatory submissions, approvals, and correspondences.",
                "enabled": true,
                "category": "Regulatory",
                "parentId": "feat-regulatory"
              },
              {
                "id": "feat-system-reports",
                "name": "Reports & Analytics",
                "description": "Generate templates, history, and scheduled reports.",
                "enabled": true,
                "category": "System"
              },
              {
                "id": "feat-system-audit-trail",
                "name": "Audit Trail",
                "description": "Chronological list of all system modifications.",
                "enabled": true,
                "category": "System"
              },
              {
                "id": "feat-system-admin",
                "name": "System Administration",
                "description": "Manage users, roles, configurations, and system info.",
                "enabled": true,
                "category": "System"
              },
              {
                "id": "feat-system-settings",
                "name": "Application Settings",
                "description": "System dictionary lists and email template definitions.",
                "enabled": true,
                "category": "System"
              },
              {
                "id": "feat-system-preferences",
                "name": "Preferences",
                "description": "Configure personal user settings and local displays.",
                "enabled": true,
                "category": "System"
              }
            ]
            """));
        return defaults;
    }

    @Transactional(readOnly = true)
    public boolean isFeatureEnabled(String featureId) {
        if (featureId == null || featureId.isBlank()) {
            return false;
        }
        SystemConfiguration config = requireConfiguration();
        JsonNode features = config.getFeaturesConfig();
        if (features == null || !features.isArray()) {
            return false;
        }
        return checkFeature(features, featureId);
    }

    private boolean checkFeature(JsonNode features, String id) {
        JsonNode featureNode = null;
        for (JsonNode f : features) {
            if (id.equals(f.path("id").asText())) {
                featureNode = f;
                break;
            }
        }
        if (featureNode == null) {
            return false;
        }

        boolean enabled = featureNode.path("enabled").asBoolean(false);
        if (!enabled) {
            return false;
        }

        String parentId = featureNode.path("parentId").asText(null);
        if (parentId != null && !parentId.isBlank()) {
            return checkFeature(features, parentId);
        }

        return true;
    }

    private SystemConfiguration buildDefaultConfiguration() {
        SystemConfiguration config = new SystemConfiguration();
        config.setConfigKey(DEFAULT_CONFIG_KEY);
        config.setGeneralConfig(parse("""
            {
              "systemName": "EQMS Enterprise",
              "systemDisplayName": "EQMS - Quality Management System",
              "systemLogo": "/assets/logo.png",
              "systemFavicon": "/assets/favicon.ico",
              "adminEmail": "admin@example.com",
              "maintenanceMode": false,
              "dateTimeFormat": "DD/MM/YYYY HH:mm:ss",
              "timeZone": "UTC+7",
              "companyInfo": {
                "companyName": "ACME Corporation",
                "companyAddress": "123 Business Street, Tech City, TC 12345",
                "companyPhone": "+1-555-0123",
                "companyWebsite": "https://www.acme-corp.com",
                "taxId": "TAX-123456789",
                "industry": "Pharmaceutical Manufacturing",
                "regulatoryBody": "FDA, ISO 9001:2015"
              },
              "backupSettings": {
                "enableAutoBackup": true,
                "backupFrequency": "daily",
                "backupTime": "02:00",
                "retentionDays": 30,
                "backupLocation": "cloud",
                "notifyOnBackupFailure": true,
                "officeOnline": {
                  "enabled": false,
                  "graphBaseUrl": "https://graph.microsoft.com/v1.0",
                  "tenantId": "",
                  "clientId": "",
                  "clientSecret": "",
                  "siteId": "",
                  "driveId": "",
                  "libraryFolder": "EQMS",
                  "shareLinkScope": "anonymous"
                }
              },
              "locale": {
                "language": "en",
                "numberFormat": "en-US",
                "currencyCode": "USD",
                "firstDayOfWeek": "monday"
              },
              "appearance": {
                "theme": "light",
                "primaryColor": "emerald",
                "compactMode": false,
                "showBreadcrumbs": true,
                "sidebarDefaultCollapsed": false,
                "animationsEnabled": true,
                "knowledgeExplorerEnabled": false
              }
            }
            """));
        config.setSecurityConfig(parse("""
            {
              "passwordMinLength": 12,
              "requireSpecialChars": true,
              "requireNumbers": true,
              "requireUppercase": true,
              "requireLowercase": true,
              "passwordExpiryDays": 90,
              "enablePasswordExpiry": true,
              "preventPasswordReuse": true,
              "passwordHistoryCount": 5,
              "sessionTimeoutMinutes": 30,
              "enable2FA": true,
              "enableAccountLockout": true,
              "maxLoginAttempts": 5
            }
            """));
        config.setDocumentsConfig(parse("""
            {
              "enableWatermark": true,
              "allowDownload": false,
              "maxFileSizeMB": 25,
              "revisionNumberSeed": "0.0.1"
            }
            """));
        config.setNotificationsConfig(parse("""
            {
              "enableEmailNotifications": true,
              "enableInAppNotifications": true,
              "enableTelegramNotifications": false,
              "enableWhatsAppNotifications": false,
              "emailDigestFrequency": "daily",
              "publicAppUrl": "http://localhost:3000",
              "emailConfig": {
                "smtpHost": "smtp.gmail.com",
                "smtpPort": 587,
                "smtpUsername": "noreply@example.com",
                "smtpPassword": "••••••••••••",
                "senderEmail": "noreply@example.com",
                "senderName": "EQMS Notification",
                "useSSL": true
              },
              "telegramConfig": {
                "botToken": "",
                "chatId": ""
              },
              "whatsappConfig": {
                "phoneNumberId": "",
                "accessToken": "",
                "businessAccountId": ""
              },
              "smsConfig": {
                "enableSms": false,
                "provider": "twilio",
                "accountSid": "",
                "authToken": "",
                "fromNumber": "",
                "rateLimitPerHour": 100
              },
              "enableCustomTemplates": false,
              "templates": [],
              "triggers": {
                "documentApproval": true,
                "taskAssignment": true,
                "systemAlerts": true,
                "capaDue": true
              }
            }
            """));
        String integrationsConfigJson = String.format(Locale.ROOT, """
            {
              "sso": {
                "enableSso": false,
                "provider": "azure-ad",
                "entityId": "",
                "ssoUrl": "",
                "certificate": "",
                "autoProvisionUsers": false,
                "defaultRole": "viewer"
              },
              "ldap": {
                "enableLdap": false,
                "serverUrl": "",
                "baseDn": "",
                "bindDn": "",
                "bindPassword": "",
                "userSearchFilter": "(sAMAccountName={username})",
                "groupSearchFilter": "(member={dn})",
                "syncSchedule": "daily",
                "lastSyncDate": ""
              },
              "webhooks": [],
              "storage": {
                "provider": "minio",
                "minioEndpoint": "%s",
                "minioBucket": "%s",
                "minioAccessKeyId": "%s",
                "minioSecretAccessKey": "%s",
                "basePath": "",
                "documentsPrefix": "%s",
                "controlledCopiesPrefix": "%s",
                "templatesPrefix": "%s",
                "trainingPrefix": "%s",
                "auditPrefix": "%s",
                "tempPrefix": "%s",
                "minioRetentionYears": %d,
                "enableCdn": false,
                "cdnUrl": ""
              },
              "enableApiKeyAuth": true,
              "apiRateLimitPerMinute": 60,
              "corsAllowedOrigins": [
                "https://eqms.company.com",
                "https://admin.eqms.company.com"
              ]
            }
            """,
                defaultMinioEndpoint,
                defaultMinioBucket,
                defaultMinioAccessKeyId,
                defaultMinioSecretAccessKey,
                defaultMinioDocumentsPrefix,
                defaultMinioControlledCopiesPrefix,
                defaultMinioTemplatesPrefix,
                defaultMinioTrainingPrefix,
                defaultMinioAuditPrefix,
                defaultMinioTempPrefix,
                Math.max(defaultMinioRetentionYears, 1)
        );
        config.setIntegrationsConfig(parse(integrationsConfigJson));
        config.setFeaturesConfig(buildDefaultFeaturesJson());
        return config;
    }

    @org.springframework.beans.factory.annotation.Autowired
    private OnlyOfficeConfigurationService onlyOfficeConfigurationService;

    private SystemConfigurationResponse toResponse(SystemConfiguration config) {
        return new SystemConfigurationResponse(
                onlyOfficeConfigurationService.sanitizeGeneralConfigForResponse(config.getGeneralConfig()),
                config.getSecurityConfig(),
                config.getDocumentsConfig(),
                config.getNotificationsConfig(),
                sanitizeIntegrationsConfigForResponse(config.getIntegrationsConfig()),
                config.getFeaturesConfig()
        );
    }

    /**
     * Masks secret material (MinIO secret access key, LDAP bind password) before the
     * integrations configuration is sent to the frontend. Never return this raw config
     * to a client - use this method for every response path.
     */
    private JsonNode sanitizeIntegrationsConfigForResponse(JsonNode integrationsConfig) {
        if (!(integrationsConfig instanceof ObjectNode integrationsObject)) {
            return integrationsConfig;
        }
        ObjectNode copy = integrationsObject.deepCopy();

        ObjectNode storage = childObject(copy, "storage");
        if (storage != null) {
            String secret = text(storage, "minioSecretAccessKey");
            storage.put("minioSecretAccessKeyConfigured", org.springframework.util.StringUtils.hasText(secret));
            storage.put("minioSecretAccessKey", org.springframework.util.StringUtils.hasText(secret) ? SECRET_MASK : "");
        }

        ObjectNode ldap = childObject(copy, "ldap");
        if (ldap != null) {
            String bindPassword = text(ldap, "bindPassword");
            ldap.put("bindPasswordConfigured", org.springframework.util.StringUtils.hasText(bindPassword));
            ldap.put("bindPassword", org.springframework.util.StringUtils.hasText(bindPassword) ? SECRET_MASK : "");
        }

        ObjectNode sso = childObject(copy, "sso");
        if (sso != null) {
            String certificate = text(sso, "certificate");
            sso.put("certificateConfigured", org.springframework.util.StringUtils.hasText(certificate));
            sso.put("certificate", org.springframework.util.StringUtils.hasText(certificate) ? SECRET_MASK : "");
        }

        return copy;
    }

    /**
     * Reconciles an incoming integrations config from the UI with the existing stored one,
     * so that a masked placeholder (SECRET_MASK) submitted back by the frontend does not
     * overwrite the real MinIO secret key / LDAP bind password / SSO certificate in storage.
     */
    private JsonNode mergeIntegrationsConfigForStorage(JsonNode incomingIntegrations, JsonNode existingIntegrations) {
        if (!(incomingIntegrations instanceof ObjectNode incomingObject)) {
            return incomingIntegrations;
        }
        ObjectNode merged = existingIntegrations instanceof ObjectNode existingObject
                ? existingObject.deepCopy()
                : objectMapper.createObjectNode();
        merged.setAll(incomingObject);

        mergeSecretField(merged, incomingObject, existingIntegrations, "storage", "minioSecretAccessKey");
        mergeSecretField(merged, incomingObject, existingIntegrations, "ldap", "bindPassword");
        mergeSecretField(merged, incomingObject, existingIntegrations, "sso", "certificate");

        return merged;
    }

    private void mergeSecretField(ObjectNode merged, ObjectNode incomingRoot, JsonNode existingRoot, String section, String field) {
        ObjectNode incomingSection = childObject(incomingRoot, section);
        if (incomingSection == null) {
            return;
        }
        JsonNode existingSectionNode = existingRoot == null ? null : existingRoot.get(section);
        ObjectNode existingSection = existingSectionNode instanceof ObjectNode existingObjectNode ? existingObjectNode : null;

        ObjectNode mergedSection = existingSection == null ? objectMapper.createObjectNode() : existingSection.deepCopy();
        mergedSection.setAll(incomingSection);

        String incomingValue = text(incomingSection, field);
        String existingValue = text(existingSection, field);
        String resolved = (org.springframework.util.StringUtils.hasText(incomingValue) && !SECRET_MASK.equals(incomingValue.trim()))
                ? incomingValue.trim()
                : existingValue;
        mergedSection.put(field, resolved == null ? "" : resolved);
        mergedSection.remove(field + "Configured");

        merged.set(section, mergedSection);
    }

    private ObjectNode childObject(JsonNode node, String field) {
        JsonNode child = node == null ? null : node.get(field);
        return child instanceof ObjectNode objectNode ? objectNode : null;
    }

    private String text(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        return value == null || value.isNull() ? null : value.asText();
    }

    private JsonNode defaultIfNull(JsonNode incoming, JsonNode existing) {
        return incoming != null ? incoming : existing;
    }

    /**
     * Two screens (Configuration and Document Properties) write this section, and other features add keys of their own
     * (e.g. pdfPreview). A shallow merge keeps every key the caller did not send instead of silently dropping it.
     */
    private JsonNode mergeDocumentsConfig(JsonNode incoming, JsonNode existing) {
        if (incoming == null) {
            return existing;
        }
        if (!incoming.isObject() || existing == null || !existing.isObject()) {
            return incoming;
        }
        com.fasterxml.jackson.databind.node.ObjectNode merged = ((com.fasterxml.jackson.databind.node.ObjectNode) existing).deepCopy();
        incoming.fields().forEachRemaining(entry -> merged.set(entry.getKey(), entry.getValue()));
        // These controls belonged to the retired PDF.js viewer. Do not retain
        // stale configuration that EmbedPDF neither exposes nor honours.
        JsonNode preview = merged.get("pdfPreview");
        if (preview instanceof com.fasterxml.jackson.databind.node.ObjectNode previewObject) {
            previewObject.remove(java.util.List.of("showPanTool", "showRotateControls", "showThemeSwitch"));
        }
        return merged;
    }

    /** Server-side limits for the Documents policy (the screens clamp too, but the API is also called directly). */
    private void validateDocumentsConfig(JsonNode documents) {
        if (!documents.isObject()) {
            throw new IllegalArgumentException("Documents configuration must be an object");
        }
        requireIntInRange(documents, "maxFileSizeMB", 1, 100, "Max File Size (MB)");
        requireIntInRange(documents, "serialNumberDigits", 1, 9, "Serial Number digits");
        requireIntInRange(documents, "workflowReminderAfterDays", 0, 365, "Reminder days");
        requireIntInRange(documents, "workflowEscalationAfterDays", 0, 365, "Escalation days");
        requireIntInRange(documents, "knowledgePortalTopCount", 1, 20, "Knowledge portal list size");
        requireIntInRange(documents, "knowledgePortalViewsWindowDays", 1, 365, "Most Viewed window (days)");
        requireIntInRange(documents, "effectiveDateOffsetDays", 0, 365, "Effective Date offset");
        requireIntInRange(documents, "effectiveDateOffsetDaysTrainingRequired", 0, 365, "Effective Date offset (Required Training)");
        requireIntInRange(documents, "effectiveDateOffsetDaysTrainingNotRequired", 0, 365, "Effective Date offset (Non-Required Training)");
        requireIntInRange(documents, "defaultRetentionPeriodDays", 0, 36500, "Default retention period");
        JsonNode basisRequired = documents.get("effectiveDateBasisTrainingRequired");
        if (basisRequired != null && !basisRequired.isNull()
                && !java.util.Set.of(EFFECTIVE_DATE_AFTER_APPROVAL, EFFECTIVE_DATE_AFTER_TRAINING, EFFECTIVE_DATE_AFTER_PUBLISH).contains(basisRequired.asText())) {
            throw new IllegalArgumentException("Effective Date basis (Required Training) must be AFTER_APPROVAL, AFTER_TRAINING or AFTER_PUBLISH");
        }
        JsonNode basisNotRequired = documents.get("effectiveDateBasisTrainingNotRequired");
        if (basisNotRequired != null && !basisNotRequired.isNull()
                && !java.util.Set.of(EFFECTIVE_DATE_AFTER_APPROVAL, EFFECTIVE_DATE_AFTER_PUBLISH).contains(basisNotRequired.asText())) {
            throw new IllegalArgumentException("Effective Date basis (Non-Required Training) must be AFTER_APPROVAL or AFTER_PUBLISH");
        }
        JsonNode seed = documents.get("revisionNumberSeed");
        if (seed != null && !seed.isNull() && !java.util.Set.of("0.0.1", "0.1").contains(seed.asText())) {
            throw new IllegalArgumentException("Revision number seed must be 0.0.1 or 0.1");
        }
        for (String flag : java.util.List.of("enableWatermark", "allowDownload", "parallelReviewEnabled", "parallelApprovalEnabled",
                "retainVisibilityForRemovedAuthor", "retainVisibilityForRemovedCoAuthor",
                "retainVisibilityForRemovedReviewer", "retainVisibilityForRemovedApprover")) {
            JsonNode value = documents.get(flag);
            if (value != null && !value.isNull() && !value.isBoolean()) {
                throw new IllegalArgumentException(flag + " must be true or false");
            }
        }
        JsonNode pdfPreview = documents.get("pdfPreview");
        if (pdfPreview != null && !pdfPreview.isNull()) {
            if (!pdfPreview.isObject()) throw new IllegalArgumentException("PDF preview configuration must be an object");
            JsonNode text = pdfPreview.get("watermarkText");
            if (text != null && !text.isNull() && (!text.isTextual() || text.asText().trim().length() > 120)) {
                throw new IllegalArgumentException("PDF preview watermark text must be at most 120 characters");
            }
            for (String flag : java.util.List.of(
                    "watermarkShowViewerName", "watermarkShowOpenedAt",
                    "showThumbnailSidebar", "showSearch", "showPageNavigation",
                    "showZoomControls", "showFullScreen", "showInsertTools", "allowAnnotations",
                    "showOpenDocumentAction", "showCloseDocumentAction", "showSecurityAction",
                    "showScreenshotAction", "allowTextSelection")) {
                JsonNode value = pdfPreview.get(flag);
                if (value != null && !value.isNull() && !value.isBoolean()) throw new IllegalArgumentException(flag + " must be true or false");
            }
            JsonNode defaultZoom = pdfPreview.get("defaultZoom");
            if (defaultZoom != null && !defaultZoom.isNull()
                    && (!defaultZoom.isTextual() || !java.util.Set.of("page-fit", "page-width", "actual-size").contains(defaultZoom.asText()))) {
                throw new IllegalArgumentException("PDF preview default zoom must be page-fit, page-width, or actual-size");
            }
        }
    }

    private static void requireIntInRange(JsonNode config, String key, int min, int max, String label) {
        JsonNode node = config.get(key);
        if (node == null || node.isNull()) {
            return;
        }
        if (!node.isInt() || node.asInt() < min || node.asInt() > max) {
            throw new IllegalArgumentException(label + " must be an integer between " + min + " and " + max);
        }
    }

    private void validateSecurityConfig(JsonNode securityConfig) {
        if (securityConfig == null || securityConfig.get("sessionTimeoutMinutes") == null || securityConfig.get("sessionTimeoutMinutes").isNull()) {
            return;
        }
        JsonNode passwordMinLengthNode = securityConfig.get("passwordMinLength");
        if (passwordMinLengthNode != null && !passwordMinLengthNode.isNull()) {
            if (!passwordMinLengthNode.isNumber()) {
                throw new IllegalArgumentException("Minimum Password Length must be an integer");
            }
            int minLength = passwordMinLengthNode.asInt();
            if (minLength < 8 || minLength > 128) {
                throw new IllegalArgumentException("Minimum Password Length must be between 8 and 128");
            }
        }
        requireIntInRange(securityConfig, "minUniqueChars", 0, 64, "Minimum Unique Characters");
        requireIntInRange(securityConfig, "maxRepeatedChars", 0, 10, "Maximum Repeated Characters");
        JsonNode passwordExpiryDaysNode = securityConfig.get("passwordExpiryDays");
        if (securityConfig.path("enablePasswordExpiry").asBoolean(false) || passwordExpiryDaysNode != null) {
            if (passwordExpiryDaysNode == null || passwordExpiryDaysNode.isNull()) {
                throw new IllegalArgumentException("Password Expiry Period is required when password expiration is enabled");
            }
            if (!passwordExpiryDaysNode.isNumber()) {
                throw new IllegalArgumentException("Password Expiry Period must be an integer");
            }
            int expiryDays = passwordExpiryDaysNode.asInt();
            if (expiryDays < 30 || expiryDays > 365) {
                throw new IllegalArgumentException("Password Expiry Period must be between 30 and 365");
            }
        }
        JsonNode passwordHistoryCountNode = securityConfig.get("passwordHistoryCount");
        if (securityConfig.path("preventPasswordReuse").asBoolean(false) || passwordHistoryCountNode != null) {
            if (passwordHistoryCountNode == null || passwordHistoryCountNode.isNull()) {
                throw new IllegalArgumentException("Password History Count is required when password reuse prevention is enabled");
            }
            if (!passwordHistoryCountNode.isNumber()) {
                throw new IllegalArgumentException("Password History Count must be an integer");
            }
            int historyCount = passwordHistoryCountNode.asInt();
            if (historyCount < 3 || historyCount > 24) {
                throw new IllegalArgumentException("Password History Count must be between 3 and 24");
            }
        }
        if (!securityConfig.get("sessionTimeoutMinutes").isNumber()) {
            throw new IllegalArgumentException("Session Timeout (Minutes) must be an integer");
        }
        int value = securityConfig.get("sessionTimeoutMinutes").asInt();
        if (value < 1 || value > 1440) {
            throw new IllegalArgumentException("Session Timeout (Minutes) must be between 1 and 1440");
        }
        JsonNode maxLoginAttemptsNode = securityConfig.get("maxLoginAttempts");
        if (maxLoginAttemptsNode != null && !maxLoginAttemptsNode.isNull()) {
            if (!maxLoginAttemptsNode.isNumber()) {
                throw new IllegalArgumentException("Maximum Login Attempts must be an integer");
            }
            int maxLoginAttempts = maxLoginAttemptsNode.asInt();
            if (maxLoginAttempts < 3 || maxLoginAttempts > 10) {
                throw new IllegalArgumentException("Maximum Login Attempts must be between 3 and 10");
            }
        }

    }

    private String summarizeConfig(SystemConfiguration config) {
        if (config == null) {
            return null;
        }
        String displayName = config.getGeneralConfig() == null ? null : textValue(config.getGeneralConfig(), "systemDisplayName");
        String sessionTimeout = config.getSecurityConfig() == null ? null : textValue(config.getSecurityConfig(), "sessionTimeoutMinutes");
        return "Display Name=" + safe(displayName) + "; Session Timeout=" + safe(sessionTimeout) + " minutes";
    }

    private String summarizeConfigFromSections(
            JsonNode general,
            JsonNode security,
            JsonNode documents,
            JsonNode notifications,
            JsonNode integrations,
            JsonNode features
    ) {
        String displayName = general == null ? null : textValue(general, "systemDisplayName");
        String sessionTimeout = security == null ? null : textValue(security, "sessionTimeoutMinutes");
        String documentsState = documents == null ? null : (documents.path("enableWatermark").asBoolean(true) ? "Watermark Enabled" : "Watermark Disabled");
        String notificationsState = notifications == null ? null : (notifications.path("enableEmailNotifications").asBoolean(false) ? "Email Notifications Enabled" : "Email Notifications Disabled");
        return "Display Name=" + safe(displayName)
                + "; Session Timeout=" + safe(sessionTimeout) + " minutes"
                + "; Documents=" + safe(documentsState)
                + "; Notifications=" + safe(notificationsState)
                + "; Integrations=" + (integrations == null ? "" : "Configured")
                + "; Features=" + (features == null ? "" : "Configured");
    }

    private List<AuditTrailChangeResponse> buildConfigurationChanges(
            JsonNode previousGeneral,
            JsonNode previousSecurity,
            JsonNode previousDocuments,
            JsonNode previousNotifications,
            JsonNode previousIntegrations,
            JsonNode previousFeatures,
            SystemConfiguration current
    ) {
        List<AuditTrailChangeResponse> changes = new ArrayList<>();
        addConfigurationChange(changes, "General Configuration", sanitizeGeneralForAudit(previousGeneral), sanitizeGeneralForAudit(current.getGeneralConfig()));
        addConfigurationChange(changes, "Security Configuration", sanitizeForAudit(previousSecurity), sanitizeForAudit(current.getSecurityConfig()));
        addConfigurationChange(changes, "Documents Configuration", sanitizeForAudit(previousDocuments), sanitizeForAudit(current.getDocumentsConfig()));
        addConfigurationChange(changes, "Notification Configuration", sanitizeForAudit(previousNotifications), sanitizeForAudit(current.getNotificationsConfig()));
        addConfigurationChange(changes, "Integration Configuration", sanitizeForAudit(previousIntegrations), sanitizeForAudit(current.getIntegrationsConfig()));
        addConfigurationChange(changes, "Feature Flags", sanitizeForAudit(previousFeatures), sanitizeForAudit(current.getFeaturesConfig()));
        if (changes.isEmpty()) {
            changes.add(new AuditTrailChangeResponse("System Configuration", summarizeConfigFromSections(previousGeneral, previousSecurity, previousDocuments, previousNotifications, previousIntegrations, previousFeatures), summarizeConfig(current)));
        }
        return changes;
    }

    private void addConfigurationChange(List<AuditTrailChangeResponse> changes, String label, JsonNode previous, JsonNode next) {
        if (!Objects.equals(previous, next)) {
            changes.add(new AuditTrailChangeResponse(label, stringifyJson(previous), stringifyJson(next)));
        }
    }

    private JsonNode sanitizeGeneralForAudit(JsonNode generalConfig) {
        if (generalConfig == null || generalConfig.isNull()) {
            return null;
        }
        JsonNode sanitized = generalConfig.deepCopy();
        if (sanitized != null && sanitized.isObject()) {
            JsonNode backupSettings = sanitized.get("backupSettings");
            if (backupSettings != null && backupSettings.isObject()) {
                JsonNode officeOnline = backupSettings.get("officeOnline");
                if (officeOnline != null && officeOnline.isObject()) {
                    ObjectNode officeOnlineCopy = (ObjectNode) officeOnline.deepCopy();
                    redactSensitiveFields(officeOnlineCopy);
                    ((ObjectNode) backupSettings).set("officeOnline", officeOnlineCopy);
                }
            }
        }
        return sanitized;
    }

    private JsonNode sanitizeForAudit(JsonNode node) {
        if (node == null || node.isNull()) {
            return null;
        }
        JsonNode copy = node.deepCopy();
        if (copy.isObject()) {
            redactSensitiveFields((ObjectNode) copy);
        } else if (copy.isArray()) {
            ArrayNode array = (ArrayNode) copy;
            for (int i = 0; i < array.size(); i++) {
                JsonNode child = array.get(i);
                if (child != null && child.isObject()) {
                    redactSensitiveFields((ObjectNode) child);
                }
            }
        }
        return copy;
    }

    private void redactSensitiveFields(ObjectNode objectNode) {
        objectNode.fieldNames().forEachRemaining(field -> {
            JsonNode value = objectNode.get(field);
            if (isSensitiveField(field)) {
                objectNode.put(field, "[redacted]");
                return;
            }
            if (value != null && value.isObject()) {
                redactSensitiveFields((ObjectNode) value);
            } else if (value != null && value.isArray()) {
                ArrayNode array = (ArrayNode) value;
                for (int i = 0; i < array.size(); i++) {
                    JsonNode child = array.get(i);
                    if (child != null && child.isObject()) {
                        redactSensitiveFields((ObjectNode) child);
                    }
                }
            }
        });
    }

    private boolean isSensitiveField(String fieldName) {
        if (fieldName == null) {
            return false;
        }
        String normalized = fieldName.toLowerCase(Locale.ROOT);
        return normalized.contains("password")
                || normalized.contains("secret")
                || normalized.contains("token")
                || normalized.contains("key")
                || normalized.contains("clientid")
                || normalized.contains("tenantid")
                || normalized.contains("accesskey")
                || normalized.contains("refresh");
    }

    private String stringifyJson(JsonNode node) {
        if (node == null || node.isNull()) {
            return "";
        }
        try {
            return objectMapper.writeValueAsString(node);
        } catch (Exception ex) {
            return node.toString();
        }
    }

    private String textValue(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        return value == null || value.isNull() ? null : value.asText();
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }

    private void requireText(JsonNode node, String field, String message) {
        String value = textValue(node, field);
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(message);
        }
    }

    public int getSessionTimeoutMinutes() {
        return getSessionTimeoutMinutes(requireConfiguration());
    }

    @Transactional(readOnly = true)
    public boolean isMfaRequiredGlobally() {
        JsonNode security = requireConfiguration().getSecurityConfig();
        return security != null && security.path("enable2FA").asBoolean(false);
    }

    @Transactional(readOnly = true)
    public boolean isPasswordExpiryEnabled() {
        JsonNode security = requireConfiguration().getSecurityConfig();
        return security != null && security.path("enablePasswordExpiry").asBoolean(false);
    }

    @Transactional(readOnly = true)
    public int getPasswordExpiryDays() {
        JsonNode security = requireConfiguration().getSecurityConfig();
        if (security == null) {
            return 90;
        }
        JsonNode value = security.get("passwordExpiryDays");
        if (value == null || value.isNull()) {
            return 90;
        }
        try {
            int days = Integer.parseInt(value.asText());
            return days > 0 ? days : 90;
        } catch (NumberFormatException ex) {
            return 90;
        }
    }

    @Transactional(readOnly = true)
    public boolean isPasswordExpired(UserAccount user) {
        if (user == null) {
            return false;
        }
        if (user.isMustChangePassword()) {
            return true;
        }
        if (!isPasswordExpiryEnabled()) {
            return false;
        }
        Instant passwordChangedAt = user.getPasswordChangedAt();
        if (passwordChangedAt == null) {
            return true;
        }
        int expiryDays = getPasswordExpiryDays();
        if (expiryDays <= 0) {
            return false;
        }
        Instant expiryAt = passwordChangedAt.plusSeconds(expiryDays * 24L * 60L * 60L);
        return !expiryAt.isAfter(Instant.now());
    }

    private int getSessionTimeoutMinutes(SystemConfiguration config) {
        String sessionTimeout = config.getSecurityConfig() == null ? null : textValue(config.getSecurityConfig(), "sessionTimeoutMinutes");
        try {
            int value = sessionTimeout == null ? 30 : Integer.parseInt(sessionTimeout);
            return value > 0 ? value : 30;
        } catch (NumberFormatException ex) {
            return 30;
        }
    }

    private void sendPreferenceUpdateNotification(String section, String previousSummary, String currentSummary) {
        try {
            UserAccount currentUser = currentUserService.requireCurrentUser();
            if (currentUser == null || currentUser.getEmail() == null || currentUser.getEmail().isBlank()) {
                return;
            }
            emailNotificationService.sendPreferenceNotification(
                    currentUser,
                    emailNotificationService.buildPreferenceVariables(
                            currentUser,
                            currentUser,
                            section,
                            "Save Changes",
                            buildPreferenceComment(previousSummary, currentSummary),
                            Map.of(
                                    "previousValue", previousSummary == null ? "" : previousSummary,
                                    "newValue", currentSummary == null ? "" : currentSummary
                            )
                    )
            );
        } catch (Exception ex) {
            // best effort only
        }
    }

    private String buildPreferenceComment(String previousSummary, String currentSummary) {
        if (previousSummary == null && currentSummary == null) {
            return "Preferences were updated";
        }
        if (previousSummary == null) {
            return currentSummary;
        }
        if (currentSummary == null) {
            return previousSummary;
        }
        return previousSummary + " -> " + currentSummary;
    }

    public com.eqms.dto.auth.PasswordPolicyResponse getPasswordPolicy() {
        JsonNode security = requireConfiguration().getSecurityConfig();
        if (security == null) {
            return new com.eqms.dto.auth.PasswordPolicyResponse(12, true, true, true, true, 0, 0, false, false, false, false);
        }
        return new com.eqms.dto.auth.PasswordPolicyResponse(
                security.path("passwordMinLength").asInt(12),
                security.path("requireUppercase").asBoolean(true),
                security.path("requireLowercase").asBoolean(true),
                security.path("requireNumbers").asBoolean(true),
                security.path("requireSpecialChars").asBoolean(true),
                security.path("minUniqueChars").asInt(0),
                security.path("maxRepeatedChars").asInt(0),
                security.path("disallowSequentialChars").asBoolean(false),
                security.path("disallowCommonPasswords").asBoolean(false),
                security.path("disallowUserInfo").asBoolean(false),
                security.path("disallowWhitespace").asBoolean(false)
        );
    }

    private static final java.util.Set<String> COMMON_PASSWORDS = java.util.Set.of(
            "password", "password1", "password123", "passw0rd", "p@ssw0rd", "p@ssword", "admin", "admin123",
            "administrator", "welcome", "welcome1", "welcome123", "letmein", "qwerty", "qwerty123", "qwertyuiop",
            "abc123", "abcd1234", "iloveyou", "monkey", "dragon", "master", "login", "changeme", "changeme123",
            "123456", "1234567", "12345678", "123456789", "1234567890", "111111", "000000", "123123", "654321",
            "trustno1", "sunshine", "football", "baseball", "superman", "internet", "eqms", "eqms123");

    public void validatePasswordPolicy(String password) {
        validatePasswordPolicy(password, null);
    }

    /** {@code user} may be null; the user-information rule is then skipped. */
    public void validatePasswordPolicy(String password, com.eqms.entity.UserAccount user) {
        JsonNode security = requireConfiguration().getSecurityConfig();
        if (security == null) return;
        int minLength = security.path("passwordMinLength").asInt(12);
        if (password.length() < minLength) {
            throw new IllegalArgumentException("Password must be at least " + minLength + " characters long");
        }
        if (security.path("requireUppercase").asBoolean(true) && !password.matches(".*[A-Z].*")) {
            throw new IllegalArgumentException("Password must contain at least one uppercase letter (A-Z)");
        }
        if (security.path("requireLowercase").asBoolean(true) && !password.matches(".*[a-z].*")) {
            throw new IllegalArgumentException("Password must contain at least one lowercase letter (a-z)");
        }
        if (security.path("requireNumbers").asBoolean(true) && !password.matches(".*[0-9].*")) {
            throw new IllegalArgumentException("Password must contain at least one number (0-9)");
        }
        if (security.path("requireSpecialChars").asBoolean(true) && !password.matches(".*[^a-zA-Z0-9].*")) {
            throw new IllegalArgumentException("Password must contain at least one special character (@, #, $, etc.)");
        }
        if (security.path("disallowWhitespace").asBoolean(false) && password.chars().anyMatch(Character::isWhitespace)) {
            throw new IllegalArgumentException("Password must not contain spaces");
        }
        int minUnique = security.path("minUniqueChars").asInt(0);
        if (minUnique > 0 && password.chars().distinct().count() < minUnique) {
            throw new IllegalArgumentException("Password must contain at least " + minUnique + " different characters");
        }
        int maxRepeated = security.path("maxRepeatedChars").asInt(0);
        if (maxRepeated > 0 && hasRepeatedRun(password, maxRepeated)) {
            throw new IllegalArgumentException("Password must not repeat the same character more than " + maxRepeated + " times in a row");
        }
        if (security.path("disallowSequentialChars").asBoolean(false) && hasSequentialRun(password)) {
            throw new IllegalArgumentException("Password must not contain sequences such as abc, 123 or cba");
        }
        if (security.path("disallowCommonPasswords").asBoolean(false)
                && COMMON_PASSWORDS.contains(password.toLowerCase(java.util.Locale.ROOT))) {
            throw new IllegalArgumentException("Password is too common. Choose a less predictable password");
        }
        if (security.path("disallowUserInfo").asBoolean(false) && user != null && containsUserInfo(password, user)) {
            throw new IllegalArgumentException("Password must not contain your username, e-mail name or name");
        }
    }

    private static boolean hasRepeatedRun(String password, int maxRun) {
        int run = 1;
        for (int i = 1; i < password.length(); i++) {
            run = password.charAt(i) == password.charAt(i - 1) ? run + 1 : 1;
            if (run > maxRun) {
                return true;
            }
        }
        return false;
    }

    /** Three or more consecutive letters/digits, each one code point above (or below) the previous, case-insensitive. */
    private static boolean hasSequentialRun(String password) {
        String p = password.toLowerCase(java.util.Locale.ROOT);
        int up = 1;
        int down = 1;
        for (int i = 1; i < p.length(); i++) {
            char prev = p.charAt(i - 1);
            char cur = p.charAt(i);
            boolean alnum = Character.isLetterOrDigit(cur) && Character.isLetterOrDigit(prev);
            up = alnum && cur == prev + 1 ? up + 1 : 1;
            down = alnum && cur == prev - 1 ? down + 1 : 1;
            if (up >= 3 || down >= 3) {
                return true;
            }
        }
        return false;
    }

    private static boolean containsUserInfo(String password, com.eqms.entity.UserAccount user) {
        String lower = password.toLowerCase(java.util.Locale.ROOT);
        java.util.List<String> tokens = new java.util.ArrayList<>();
        tokens.add(user.getUsername());
        String email = user.getEmail();
        if (email != null && email.contains("@")) {
            tokens.add(email.substring(0, email.indexOf('@')));
        }
        if (user.getFullName() != null) {
            tokens.addAll(java.util.Arrays.asList(user.getFullName().split("\\s+")));
        }
        return tokens.stream()
                .filter(t -> t != null && t.trim().length() >= 3)
                .anyMatch(t -> lower.contains(t.trim().toLowerCase(java.util.Locale.ROOT)));
    }

    public void validatePasswordHistory(String newPassword, String historyStr, int historyCount, PasswordEncoder passwordEncoder) {
        if (historyStr == null || historyStr.isBlank() || historyCount <= 0) {
            return;
        }
        String[] hashes = historyStr.split(",");
        int limit = Math.min(hashes.length, historyCount);
        for (int i = 0; i < limit; i++) {
            if (passwordEncoder.matches(newPassword, hashes[i].trim())) {
                throw new IllegalArgumentException("You cannot reuse any of your last " + historyCount + " passwords");
            }
        }
    }

    public String updatePasswordHistory(String currentHistory, String newHash, int historyCount) {
        if (historyCount <= 0) return "";
        if (currentHistory == null || currentHistory.isBlank()) {
            return newHash;
        }
        String[] hashes = currentHistory.split(",");
        List<String> list = new ArrayList<>();
        list.add(newHash);
        for (String h : hashes) {
            if (!h.isBlank()) {
                list.add(h.trim());
            }
        }
        if (list.size() > historyCount) {
            list = list.subList(0, historyCount);
        }
        return String.join(",", list);
    }

    private JsonNode parse(String json) {
        try {
            return objectMapper.readTree(json);
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to parse default system configuration", ex);
        }
    }
}
