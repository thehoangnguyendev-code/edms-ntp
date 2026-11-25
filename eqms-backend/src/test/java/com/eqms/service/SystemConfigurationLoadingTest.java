package com.eqms.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.dto.user.SystemConfigurationRequest;
import com.eqms.entity.SystemConfiguration;
import com.eqms.entity.UserAccount;
import com.eqms.repository.SystemConfigurationRepository;
import com.eqms.util.ConfigurationAuditPage;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

class SystemConfigurationLoadingTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private SystemConfigurationRepository repository;
    private AuditTrailService audit;
    private NotificationRealtimeService realtime;
    private SystemConfigurationService service;
    private SystemConfiguration config;

    @BeforeEach
    void setUp() throws Exception {
        TransactionSynchronizationManager.initSynchronization();
        repository = mock(SystemConfigurationRepository.class);
        audit = mock(AuditTrailService.class);
        realtime = mock(NotificationRealtimeService.class);
        var user = mock(CurrentUserService.class);
        when(user.requireCurrentUser()).thenReturn(new UserAccount());
        config = new SystemConfiguration();
        var general = mapper.createObjectNode();
        general.put("systemDisplayName", "EQMS");
        general.put("dateTimeFormat", com.eqms.util.DateTimeFormatUtils.DISPLAY_FORMAT_CODE);
        general.put("timeZone", com.eqms.util.DateTimeFormatUtils.ZONE_ID);
        general.putObject("appearance").put("loadingStyle", "system").put("loadingColor", "#059669");
        config.setGeneralConfig(general);
        config.setSecurityConfig(mapper.readTree("{\"sessionTimeoutMinutes\":30}"));
        config.setDocumentsConfig(mapper.readTree("{\"maxUploadSizeMb\":25}"));
        config.setNotificationsConfig(mapper.createObjectNode());
        config.setIntegrationsConfig(mapper.createObjectNode());
        config.setFeaturesConfig(mapper.createArrayNode());
        when(repository.findByConfigKey("default")).thenReturn(Optional.of(config));
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        service = new SystemConfigurationService(repository, null, mapper, audit, user, null, null, null,
                "http://localhost:9000", "bucket", "key", "secret", "documents", "controlled-copies", "templates", "training", "audit", "temp", 5);
        var office = mock(OnlyOfficeConfigurationService.class);
        when(office.mergeGeneralConfigForStorage(any(), any())).thenAnswer(inv -> inv.getArgument(0));
        when(office.sanitizeGeneralConfigForResponse(any())).thenAnswer(inv -> inv.getArgument(0));
        ReflectionTestUtils.setField(service, "onlyOfficeConfigurationService", office);
        ReflectionTestUtils.setField(service, "notificationRealtimeService", realtime);
    }

    @AfterEach
    void tearDown() { TransactionSynchronizationManager.clearSynchronization(); }

    private SystemConfigurationRequest request(String style, String color) {
        ObjectNode next = config.getGeneralConfig().deepCopy();
        ((ObjectNode) next.get("appearance")).put("loadingStyle", style).put("loadingColor", color);
        return new SystemConfigurationRequest(next, null, null, null, null, null);
    }

    @Test
    void publicBrandingReturnsOnlyTheSavedChoiceAndSafeDefaultsForOldSettings() {
        assertEquals("system", service.getPublicBranding().loadingStyle());
        ((ObjectNode) config.getGeneralConfig().get("appearance")).put("loadingStyle", "dots").put("loadingColor", "#123456");
        assertEquals("dots", service.getPublicBranding().loadingStyle());
        assertEquals("#123456", service.getPublicBranding().loadingColor());
        ((ObjectNode) config.getGeneralConfig().get("appearance")).put("loadingStyle", "invalid").put("loadingColor", "url(evil)");
        assertEquals("system", service.getPublicBranding().loadingStyle());
        assertEquals("#059669", service.getPublicBranding().loadingColor());
    }

    @Test
    void invalidSettingsAreRejectedBeforeTheRowOrAuditIsWritten() {
        assertThrows(IllegalArgumentException.class, () -> service.updateConfiguration(request("unknown", "#123456"), page -> true));
        assertThrows(IllegalArgumentException.class, () -> service.updateConfiguration(request("ring", "url(evil)"), page -> true));
        verify(repository, never()).save(any());
        verifyNoInteractions(audit, realtime);
    }

    @Test
    void changingTheLoadingChoiceStillRequiresGeneralManagePermission() {
        assertThrows(AccessDeniedException.class, () -> service.updateConfiguration(request("ring", "#123456"), page -> page == ConfigurationAuditPage.SECURITY));
        verifyNoInteractions(audit, realtime);
        assertTrue(TransactionSynchronizationManager.getSynchronizations().isEmpty());
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void successfulSaveAuditsBeforeAfterAndOnlyNotifiesOtherUsersAfterCommit() {
        service.updateConfiguration(request("ring", "#123456"), page -> page == ConfigurationAuditPage.GENERAL);
        var changes = (ArgumentCaptor<List<AuditTrailChangeResponse>>) (ArgumentCaptor) ArgumentCaptor.forClass(List.class);
        verify(audit).logAs(any(), eq(ConfigurationAuditPage.GENERAL.entityType()), anyString(), any(), anyString(), any(), any(), anyString(), changes.capture());
        assertTrue(changes.getValue().stream().anyMatch(c -> c.field().contains("Loading Style") && "system".equals(c.oldValue()) && "ring".equals(c.newValue())));
        assertTrue(changes.getValue().stream().anyMatch(c -> c.field().contains("Loading Color") && "#059669".equals(c.oldValue()) && "#123456".equals(c.newValue())));
        assertEquals("ring", service.getPublicBranding().loadingStyle());
        verifyNoInteractions(realtime);
        TransactionSynchronizationManager.getSynchronizations().forEach(TransactionSynchronization::afterCommit);
        verify(realtime).publishGlobalEvent("branding-updated");
    }

    @Test
    void rollbackAndAuditFailureDoNotBroadcastAnUnsavedChoice() {
        service.updateConfiguration(request("bars", "#123456"), page -> true);
        TransactionSynchronizationManager.getSynchronizations().forEach(s -> s.afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK));
        verifyNoInteractions(realtime);
        TransactionSynchronizationManager.clearSynchronization();
        TransactionSynchronizationManager.initSynchronization();
        doThrow(new IllegalStateException("audit unavailable")).when(audit).logAs(any(), anyString(), anyString(), any(), anyString(), any(), any(), anyString(), any());
        assertThrows(IllegalStateException.class, () -> service.updateConfiguration(request("dots", "#abcdef"), page -> true));
        assertTrue(TransactionSynchronizationManager.getSynchronizations().isEmpty());
        verifyNoInteractions(realtime);
    }
}
