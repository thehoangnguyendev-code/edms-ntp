package com.eqms.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.eqms.entity.SystemConfiguration;
import com.eqms.repository.SystemConfigurationRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class SystemConfigurationServiceBrandingTest {

    @Test
    void compactFiltersAreOptInAndIncludedInUserBranding() throws Exception {
        assertFalse(serviceWithGeneral("{}").getPublicBranding().compactDesktopFilters());
        assertTrue(serviceWithGeneral("{\"appearance\":{\"compactDesktopFilters\":true}}")
                .getPublicBranding().compactDesktopFilters());
        assertFalse(serviceWithGeneral("{\"appearance\":{\"compactDesktopFilters\":false}}")
                .getPublicBranding().compactDesktopFilters());
    }

    private final ObjectMapper mapper = new ObjectMapper();

    private SystemConfigurationService serviceWithGeneral(String generalJson) throws Exception {
        SystemConfigurationRepository repository = mock(SystemConfigurationRepository.class);
        SystemConfiguration config = new SystemConfiguration();
        config.setGeneralConfig(mapper.readTree(generalJson));
        config.setFeaturesConfig(mapper.readTree("[]"));
        when(repository.findByConfigKey("default")).thenReturn(Optional.of(config));
        return new SystemConfigurationService(repository, null, mapper, null, null, null, null, null,
                "http://localhost:9000", "bucket", "key", "secret", "documents", "controlled-copies",
                "templates", "training", "audit", "temp", 5);
    }

    @Test
    void knowledgeExplorerIsOffWhenTheSettingIsMissing() throws Exception {
        var branding = serviceWithGeneral("{\"appearance\":{\"showSidebarUserProfile\":true}}").getPublicBranding();
        assertFalse(branding.knowledgeExplorerEnabled());
        assertTrue(branding.showSidebarUserProfile());
    }

    @Test
    void knowledgeExplorerIsOffWhenThereIsNoAppearanceSection() throws Exception {
        assertFalse(serviceWithGeneral("{}").getPublicBranding().knowledgeExplorerEnabled());
    }

    @Test
    void knowledgeExplorerFollowsTheAdministratorSetting() throws Exception {
        assertTrue(serviceWithGeneral("{\"appearance\":{\"knowledgeExplorerEnabled\":true}}")
                .getPublicBranding().knowledgeExplorerEnabled());
        assertFalse(serviceWithGeneral("{\"appearance\":{\"knowledgeExplorerEnabled\":false}}")
                .getPublicBranding().knowledgeExplorerEnabled());
    }

    @Test
    void onlyOfficeViewerInvalidationIsLimitedToViewerSettings() throws Exception {
        var previous = mapper.readTree("""
                {"appearance":{"theme":"light"},"backupSettings":{"onlyOffice":{"viewer":{"showPluginsTab":false}}}}
                """);
        var unrelatedGeneralChange = mapper.readTree("""
                {"appearance":{"theme":"dark"},"backupSettings":{"onlyOffice":{"viewer":{"showPluginsTab":false}}}}
                """);
        var viewerChange = mapper.readTree("""
                {"appearance":{"theme":"light"},"backupSettings":{"onlyOffice":{"viewer":{"showPluginsTab":true}}}}
                """);

        assertFalse(SystemConfigurationService.hasOnlyOfficeViewerChange(previous, unrelatedGeneralChange));
        assertTrue(SystemConfigurationService.hasOnlyOfficeViewerChange(previous, viewerChange));
    }

    @Test
    void documentsPreviewInvalidationIsLimitedToPdfPolicy() throws Exception {
        var previous = mapper.readTree("{\"maxFileSizeMB\":20,\"enableWatermark\":true,\"pdfPreview\":{\"watermarkText\":\"PREVIEW\"}}");
        var unrelated = mapper.readTree("{\"maxFileSizeMB\":30,\"enableWatermark\":true,\"pdfPreview\":{\"watermarkText\":\"PREVIEW\"}}");
        var changed = mapper.readTree("{\"maxFileSizeMB\":20,\"enableWatermark\":true,\"pdfPreview\":{\"watermarkText\":\"CONFIDENTIAL\"}}");
        assertFalse(SystemConfigurationService.hasDocumentsPreviewChange(previous, unrelated));
        assertTrue(SystemConfigurationService.hasDocumentsPreviewChange(previous, changed));
    }

    @Test
    void documentsPreviewInvalidationIncludesEmbedPdfViewerPolicy() throws Exception {
        var previous = mapper.readTree("""
                {"enableWatermark":true,"allowDownload":false,
                 "pdfPreview":{"defaultZoom":"page-fit","showSearch":true,"showPanTool":true}}
                """);
        var changed = mapper.readTree("""
                {"enableWatermark":true,"allowDownload":false,
                 "pdfPreview":{"defaultZoom":"page-width","showSearch":false,"showPanTool":false,
                 "showOpenDocumentAction":false,"showCloseDocumentAction":false,
                 "showSecurityAction":false,"showScreenshotAction":false}}
                """);

        assertTrue(SystemConfigurationService.hasDocumentsPreviewChange(previous, changed));
    }
}
