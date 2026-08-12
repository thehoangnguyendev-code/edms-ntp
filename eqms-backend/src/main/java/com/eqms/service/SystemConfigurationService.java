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
    private static final String SECRET_MASK = OfficeOnlineConfigurationService.SECRET_MASK;

    private final SystemConfigurationRepository repository;
    private final UserAccountRepository userRepository;
    private final ObjectMapper objectMapper;
    private final AuditTrailService auditTrailService;
    private final CurrentUserService currentUserService;

    @org.springframework.beans.factory.annotation.Autowired
    private PermissionEvaluationService permissionEvaluationService;
    private final EmailNotificationService emailNotificationService;
    private final OfficeOnlineConfigurationService officeOnlineConfigurationService;
    private final StoragePathBuilder storagePathBuilder;
    private final SharePointPathBuilder sharePointPathBuilder;
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
            EmailNotificationService emailNotificationService,
            OfficeOnlineConfigurationService officeOnlineConfigurationService,
            StoragePathBuilder storagePathBuilder,
            SharePointPathBuilder sharePointPathBuilder,
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
        this.emailNotificationService = emailNotificationService;
        this.officeOnlineConfigurationService = officeOnlineConfigurationService;
        this.storagePathBuilder = storagePathBuilder;
        this.sharePointPathBuilder = sharePointPathBuilder;
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

    public OfficeOnlineConfigurationService.OfficeOnlineConfiguration getOfficeOnlineConfiguration() {
        return officeOnlineConfigurationService.getConfigurationForResponse();
    }

    @Transactional
    public OfficeOnlineConfigurationService.OfficeOnlineConfiguration updateOfficeOnlineConfiguration(
            com.eqms.dto.user.OfficeOnlineConfigurationTestRequest request) {
        SystemConfiguration config = requireConfiguration();
        ObjectNode general = config.getGeneralConfig() instanceof ObjectNode object
                ? object.deepCopy() : objectMapper.createObjectNode();
        ObjectNode backup = general.get("backupSettings") instanceof ObjectNode object
                ? object : general.putObject("backupSettings");
        ObjectNode office = backup.get("officeOnline") instanceof ObjectNode object
                ? object.deepCopy() : objectMapper.createObjectNode();
        if (request.enabled() != null) office.put("enabled", request.enabled());
        putIfText(office, "graphBaseUrl", request.graphBaseUrl());
        putIfText(office, "tenantId", request.tenantId());
        putIfText(office, "clientId", request.clientId());
        putIfText(office, "siteId", request.siteId());
        putIfText(office, "driveId", request.driveId());
        putIfText(office, "libraryFolder", request.libraryFolder());
        putIfText(office, "shareLinkScope", request.shareLinkScope());
        if (request.reviewLinksEnabled() != null) office.put("reviewLinksEnabled", request.reviewLinksEnabled());
        if (request.clientSecret() != null && !request.clientSecret().isBlank()
                && !OfficeOnlineConfigurationService.SECRET_MASK.equals(request.clientSecret().trim())) {
            office.put("clientSecret", request.clientSecret().trim());
        }
        backup.set("officeOnline", office);
        general.set("backupSettings", backup);
        updateConfiguration(new com.eqms.dto.user.SystemConfigurationRequest(general, null, null, null, null, null));
        return officeOnlineConfigurationService.getConfigurationForResponse();
    }

    private void putIfText(ObjectNode node, String field, String value) {
        if (value != null && !value.isBlank()) node.put(field, value.trim());
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
                replacePreviewTokens(sharePointPathBuilder.editOnlineFolderV2(
                        officeOnlineConfigurationService.getEffectiveConfiguration(), document, previewId), previewId),
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
                : officeOnlineConfigurationService.mergeGeneralConfigForStorage(request.general(), config.getGeneralConfig());
        validateOfficeOnlineConfig(nextGeneral);
        config.setGeneralConfig(nextGeneral);
        config.setSecurityConfig(defaultIfNull(request.security(), config.getSecurityConfig()));
        config.setDocumentsConfig(defaultIfNull(request.documents(), config.getDocumentsConfig()));
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
        return toResponse(saved);
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
                textValue(general, "systemFavicon"),
                appearance == null ? null : textValue(appearance, "systemFooter"),
                readStringMap(general == null ? null : general.get("navigationLabelOverrides"))
        );
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
        if (!permissionEvaluationService.isSuperAdmin(currentUser)) {
            throw new org.springframework.security.access.AccessDeniedException("Only Super Admin can update security configuration");
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
                "animationsEnabled": true
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
              "defaultRetentionPeriodDays": 365,
              "enableWatermark": true,
              "allowDownload": false,
              "maxFileSizeMB": 25,
              "versionControl": {
                "enableAutoVersioning": true,
                "maxVersionsToKeep": 10,
                "compareVersionsEnabled": true,
                "requireVersionNotes": true,
                "majorMinorVersioning": true
              },
              "eSignature": {
                "enableESignature": true,
                "requirePasswordForSigning": true,
                "allowDigitalCertificates": false,
                "signingMethods": ["password", "otp"],
                "enforceSigningOrder": true,
                "signatureValidityDays": 365
              }
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

    private SystemConfigurationResponse toResponse(SystemConfiguration config) {
        return new SystemConfigurationResponse(
                officeOnlineConfigurationService.sanitizeGeneralConfigForResponse(config.getGeneralConfig()),
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

    private void validateOfficeOnlineConfig(JsonNode generalConfig) {
        JsonNode backupSettings = generalConfig == null ? null : generalConfig.get("backupSettings");
        JsonNode officeOnline = backupSettings == null ? null : backupSettings.get("officeOnline");
        if (officeOnline == null || officeOnline.isNull() || !officeOnline.path("enabled").asBoolean(false)) {
            return;
        }
        requireText(officeOnline, "graphBaseUrl", "Microsoft Graph Base URL is required when Office Online sync is enabled");
        requireText(officeOnline, "tenantId", "Tenant ID is required when Office Online sync is enabled");
        requireText(officeOnline, "clientId", "Client ID is required when Office Online sync is enabled");
        requireText(officeOnline, "siteId", "Site ID is required when Office Online sync is enabled");
        requireText(officeOnline, "driveId", "Drive ID is required when Office Online sync is enabled");
        requireText(officeOnline, "libraryFolder", "Library Folder is required when Office Online sync is enabled");
        String clientSecret = textValue(officeOnline, "clientSecret");
        boolean clientSecretConfigured = officeOnline.path("clientSecretConfigured").asBoolean(false);
        boolean clearClientSecret = officeOnline.path("clearClientSecret").asBoolean(false);
        if ((!clientSecretConfigured || clearClientSecret) && (clientSecret == null || clientSecret.isBlank())) {
            throw new IllegalArgumentException("Client Secret is required when Office Online sync is enabled");
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
            return new com.eqms.dto.auth.PasswordPolicyResponse(12, true, true, true, true);
        }
        return new com.eqms.dto.auth.PasswordPolicyResponse(
                security.path("passwordMinLength").asInt(12),
                security.path("requireUppercase").asBoolean(true),
                security.path("requireLowercase").asBoolean(true),
                security.path("requireNumbers").asBoolean(true),
                security.path("requireSpecialChars").asBoolean(true)
        );
    }

    public void validatePasswordPolicy(String password) {
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
