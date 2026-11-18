package com.eqms.service;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.user.SystemConfigurationRequest;
import com.eqms.entity.SystemConfiguration;
import com.eqms.entity.UserAccount;
import com.eqms.repository.SystemConfigurationRepository;
import com.eqms.util.ConfigurationAuditPage;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Optional;
import java.util.function.Predicate;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * V806: one View and one Manage permission for each page of Configuration. The save of the Configuration screen refuses (and, being one transaction, rolls back) a save that changes
 * a page the person may not manage, and the read of it leaves out the sections of the pages the person may not open.
 */
class SystemConfigurationServicePageAuthorizationTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private SystemConfigurationRepository repository;
    private AuditTrailService audit;
    private SystemConfigurationService service;

    @AfterEach
    void clearSynchronization() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) TransactionSynchronizationManager.clearSynchronization();
    }

    @BeforeEach
    void setUp() throws Exception {
        // the after-commit notices of the save register themselves with the transaction; there is none here
        if (!TransactionSynchronizationManager.isSynchronizationActive()) TransactionSynchronizationManager.initSynchronization();
        repository = mock(SystemConfigurationRepository.class);
        audit = mock(AuditTrailService.class);
        CurrentUserService currentUser = mock(CurrentUserService.class);
        when(currentUser.requireCurrentUser()).thenReturn(new UserAccount());
        SystemConfiguration config = new SystemConfiguration();
        // the saved general section always carries the display format of the whole system (withDisplayFormat), so a save that does not touch it leaves it as it is
        var general = (com.fasterxml.jackson.databind.node.ObjectNode) mapper.readTree("{\"systemDisplayName\":\"EQMS\",\"backupSettings\":{\"onlyOffice\":{\"documentServerUrl\":\"http://oo\"}}}");
        general.put("dateTimeFormat", com.eqms.util.DateTimeFormatUtils.DISPLAY_FORMAT_CODE);
        general.put("timeZone", com.eqms.util.DateTimeFormatUtils.ZONE_ID);
        config.setGeneralConfig(general);
        config.setSecurityConfig(mapper.readTree("{\"sessionTimeoutMinutes\":30}"));
        config.setDocumentsConfig(mapper.readTree("{\"maxUploadSizeMb\":25}"));
        config.setNotificationsConfig(mapper.readTree("{\"emailConfig\":{\"senderEmail\":\"a@b.c\"}}"));
        config.setIntegrationsConfig(mapper.readTree("{\"storage\":{\"provider\":\"minio\"}}"));
        config.setFeaturesConfig(mapper.readTree("[{\"id\":\"feat-x\",\"enabled\":true}]"));
        when(repository.findByConfigKey("default")).thenReturn(Optional.of(config));
        when(repository.save(any(SystemConfiguration.class))).thenAnswer(invocation -> invocation.getArgument(0));
        service = new SystemConfigurationService(repository, null, mapper, audit, currentUser, null, null, null,
                "http://localhost:9000", "bucket", "key", "secret", "documents", "controlled-copies",
                "templates", "training", "audit", "temp", 5);
        OnlyOfficeConfigurationService onlyOffice = mock(OnlyOfficeConfigurationService.class);
        when(onlyOffice.sanitizeGeneralConfigForResponse(any())).thenAnswer(invocation -> invocation.getArgument(0));
        ReflectionTestUtils.setField(service, "onlyOfficeConfigurationService", onlyOffice);
    }

    private SystemConfigurationRequest featuresRequest() throws Exception {
        JsonNode features = mapper.readTree("[{\"id\":\"feat-x\",\"enabled\":false}]");
        return new SystemConfigurationRequest(null, null, null, null, null, features);
    }

    @Test
    void aSaveThatChangesAPageThePersonMayNotManageIsRefusedBeforeAnythingIsWritten() throws Exception {
        Predicate<ConfigurationAuditPage> onlyGeneral = page -> page == ConfigurationAuditPage.GENERAL;
        assertThrows(AccessDeniedException.class, () -> service.updateConfiguration(featuresRequest(), onlyGeneral));
        // refused before the audit record; the transaction that wraps the method rolls back the save of the row
        verify(audit, never()).logAs(any(), anyString(), anyString(), any(), anyString(), any(), any(), anyString(), any());
    }

    @Test
    void aSaveThatChangesOnlyPagesThePersonMayManageIsAccepted() throws Exception {
        Predicate<ConfigurationAuditPage> features = page -> page == ConfigurationAuditPage.FEATURES;
        assertDoesNotThrow(() -> service.updateConfiguration(featuresRequest(), features));
    }

    @Test
    void aSaveThatChangesNothingNeedsNoPermissionOfAnyPage() throws Exception {
        SystemConfigurationRequest same = new SystemConfigurationRequest(null, null, null, null, null, mapper.readTree("[{\"id\":\"feat-x\",\"enabled\":true}]"));
        assertDoesNotThrow(() -> service.updateConfiguration(same, page -> false));
    }

    @Test
    void anotherCallerWithAPermissionOfItsOwnPassesNoPredicateAndIsNotAskedForAPage() throws Exception {
        assertDoesNotThrow(() -> service.updateConfiguration(featuresRequest()));
    }

    @Test
    void theReadLeavesOutTheSectionsOfThePagesThePersonMayNotOpen() {
        var onlyGeneral = service.getConfiguration(page -> page == ConfigurationAuditPage.GENERAL);
        assertEquals("EQMS", onlyGeneral.general().path("systemDisplayName").asText());
        assertTrue(onlyGeneral.general().path("backupSettings").path("onlyOffice").isMissingNode(), "the OnlyOffice connection belongs to Integrations and Preview File");
        assertTrue(onlyGeneral.security().isEmpty(), "Security");
        assertTrue(onlyGeneral.integrations().isEmpty(), "Integrations");
        assertTrue(onlyGeneral.notifications().isEmpty(), "Notifications");
        assertTrue(onlyGeneral.features().isArray() && onlyGeneral.features().isEmpty(), "Features");
        assertEquals(25, onlyGeneral.documents().path("maxUploadSizeMb").asInt(), "operational policy that every document user reads anyway");
    }

    @Test
    void theHolderOfIntegrationsSeesTheIntegrationsAndTheOnlyOfficeConnectionButNotSecurity() {
        var integrations = service.getConfiguration(page -> page == ConfigurationAuditPage.INTEGRATIONS || page == ConfigurationAuditPage.GENERAL);
        assertEquals("minio", integrations.integrations().path("storage").path("provider").asText());
        assertEquals("http://oo", integrations.general().path("backupSettings").path("onlyOffice").path("documentServerUrl").asText());
        assertTrue(integrations.security().isEmpty());
    }

    @Test
    void theHolderOfIntegrationsAloneGetsTheOnlyOfficeConnectionAndNothingElseOfGeneral() {
        var integrations = service.getConfiguration(page -> page == ConfigurationAuditPage.INTEGRATIONS);
        assertEquals("http://oo", integrations.general().path("backupSettings").path("onlyOffice").path("documentServerUrl").asText());
        assertTrue(integrations.general().path("systemDisplayName").isMissingNode(), "the branding belongs to the General page");
    }

    @Test
    void theHolderOfSecurityAloneGetsNoGeneralSectionAtAll() {
        var security = service.getConfiguration(page -> page == ConfigurationAuditPage.SECURITY);
        assertEquals(30, security.security().path("sessionTimeoutMinutes").asInt());
        assertTrue(security.general().isEmpty());
    }
}
