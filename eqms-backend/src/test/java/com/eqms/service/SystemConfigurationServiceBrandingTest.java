package com.eqms.service;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
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
    void pageBackgroundsArePublicAndInvalidLegacyValuesFallBack() throws Exception {
        assertNull(serviceWithGeneral("{}").getPublicBranding().mainBackground());
        var branding = serviceWithGeneral("{\"appearance\":{\"authBackground\":{\"mode\":\"linear\",\"colors\":[\"#FFFFFF\",\"#123456\"],\"angle\":45,\"extra\":\"not public\"}}}").getPublicBranding();
        assertEquals("linear", branding.authBackground().path("mode").asText());
        assertFalse(branding.authBackground().has("extra"));
        assertNull(serviceWithGeneral("{\"appearance\":{\"authBackground\":{\"mode\":\"url(evil)\"}}}").getPublicBranding().authBackground());
    }

    @Test
    void publicBrandingContainsVideoReferenceAndRepeatOnly() throws Exception {
        var branding = serviceWithGeneral("{\"appearance\":{\"authBackground\":{\"mode\":\"video\",\"colors\":[\"#FFFFFF\",\"#123456\"],\"angle\":45,\"videoId\":\"00000000-0000-0000-0000-000000000001\",\"videoLoop\":false,\"private\":\"secret\"}}}").getPublicBranding();
        assertEquals("00000000-0000-0000-0000-000000000001", branding.authBackground().path("videoId").asText());
        assertFalse(branding.authBackground().path("videoLoop").asBoolean());
        assertFalse(branding.authBackground().has("private"));
    }

    @Test
    void tableColumnDividersAreOffByDefaultAndMustBeABoolean() throws Exception {
        assertFalse(serviceWithGeneral("{}").getPublicBranding().tableColumnDividers());
        assertTrue(serviceWithGeneral("{\"appearance\":{\"tableColumnDividers\":true}}").getPublicBranding().tableColumnDividers());
        var rejected = new com.fasterxml.jackson.databind.ObjectMapper().readTree("{\"appearance\":{\"tableColumnDividers\":\"yes\"}}");
        assertThrows(IllegalArgumentException.class, () -> SystemConfigurationService.validateTableColumnDividers(rejected));
    }

    @Test
    void alternatingRecordsAreOptInAndColorIsSanitizedForPublicBranding() throws Exception {
        var defaults = serviceWithGeneral("{}").getPublicBranding();
        assertFalse(defaults.alternatingRecordColors());
        assertEquals("#F8FAFC", defaults.alternatingRecordColor());
        var enabled = serviceWithGeneral("{\"appearance\":{\"alternatingRecordColors\":true,\"alternatingRecordColor\":\"#E5F1F2\"}}").getPublicBranding();
        assertTrue(enabled.alternatingRecordColors());
        assertEquals("#E5F1F2", enabled.alternatingRecordColor());
        assertEquals("#F8FAFC", serviceWithGeneral("{\"appearance\":{\"alternatingRecordColor\":\"red;display:none\"}}").getPublicBranding().alternatingRecordColor());
    }

    @Test
    void compactFiltersAreOptInAndIncludedInUserBranding() throws Exception {
        assertFalse(serviceWithGeneral("{}").getPublicBranding().compactDesktopFilters());
        assertTrue(serviceWithGeneral("{\"appearance\":{\"compactDesktopFilters\":true}}")
                .getPublicBranding().compactDesktopFilters());
        assertFalse(serviceWithGeneral("{\"appearance\":{\"compactDesktopFilters\":false}}")
                .getPublicBranding().compactDesktopFilters());
    }

    /** REPORT/AUDIT-TAB-TIMELINE-2026-11-15: the Audit Trail tab of a record is a table until the administrator chooses a timeline; the module itself is not affected. */
    @Test
    void theAuditTabIsATableUnlessTheAdministratorChoosesATimelineAndOnlyKnownValuesAreSaved() throws Exception {
        assertEquals("TABLE", serviceWithGeneral("{}").getPublicBranding().auditTabView());
        assertEquals("COMPACT", serviceWithGeneral("{}").getPublicBranding().auditTabTimelineStyle());
        var chosen = serviceWithGeneral("{\"appearance\":{\"auditTabView\":\"TIMELINE\",\"auditTabTimelineStyle\":\"SCROLL_LIT\"}}").getPublicBranding();
        assertEquals("TIMELINE", chosen.auditTabView());
        assertEquals("SCROLL_LIT", chosen.auditTabTimelineStyle());
        assertEquals("TABLE", serviceWithGeneral("{\"appearance\":{\"auditTabView\":\"list\"}}").getPublicBranding().auditTabView());
        assertEquals("COMPACT", serviceWithGeneral("{\"appearance\":{\"auditTabTimelineStyle\":\"zigzag\"}}").getPublicBranding().auditTabTimelineStyle());
        for (String style : new String[] {"RAIL", "CENTER", "COMPACT", "SCROLL_LIT"}) {
            var general = mapper.readTree("{\"appearance\":{\"auditTabView\":\"TIMELINE\",\"auditTabTimelineStyle\":\"" + style + "\"}}");
            assertDoesNotThrow(() -> SystemConfigurationService.validateAuditTabView(general), style);
        }
        for (String bad : new String[] {"\"list\"", "\"timeline\"", "1", "true"}) {
            var general = mapper.readTree("{\"appearance\":{\"auditTabView\":" + bad + "}}");
            assertThrows(IllegalArgumentException.class, () -> SystemConfigurationService.validateAuditTabView(general), bad);
            var other = mapper.readTree("{\"appearance\":{\"auditTabTimelineStyle\":" + bad + "}}");
            assertThrows(IllegalArgumentException.class, () -> SystemConfigurationService.validateAuditTabView(other), bad);
        }
    }

    @Test
    void trainingMaterialsLayoutIsATableUnlessTheAdministratorChoosesTilesAndOnlyKnownValuesAreSaved() throws Exception {
        assertEquals("TABLE", serviceWithGeneral("{}").getPublicBranding().trainingMaterialsLayout());
        assertEquals("TILES", serviceWithGeneral("{\"appearance\":{\"trainingMaterialsLayout\":\"TILES\"}}").getPublicBranding().trainingMaterialsLayout());
        assertEquals("TABLE", serviceWithGeneral("{\"appearance\":{\"trainingMaterialsLayout\":\"grid\"}}").getPublicBranding().trainingMaterialsLayout());
        for (String ok : new String[] {"\"TABLE\"", "\"TILES\"", "null"}) {
            var general = mapper.readTree("{\"appearance\":{\"trainingMaterialsLayout\":" + ok + "}}");
            assertDoesNotThrow(() -> SystemConfigurationService.validateTrainingMaterialsLayout(general), ok);
        }
        for (String bad : new String[] {"\"grid\"", "\"tiles\"", "1", "true"}) {
            var general = mapper.readTree("{\"appearance\":{\"trainingMaterialsLayout\":" + bad + "}}");
            assertThrows(IllegalArgumentException.class, () -> SystemConfigurationService.validateTrainingMaterialsLayout(general), bad);
        }
    }

    @Test
    void loginLayoutIsClassicUnlessTheAdministratorChoosesSplitAndOnlyKnownValuesAreSaved() throws Exception {
        assertEquals("CLASSIC", serviceWithGeneral("{}").getPublicBranding().loginLayout());
        assertEquals("SPLIT", serviceWithGeneral("{\"appearance\":{\"loginLayout\":\"SPLIT\"}}").getPublicBranding().loginLayout());
        assertEquals("CLASSIC", serviceWithGeneral("{\"appearance\":{\"loginLayout\":\"modern\"}}").getPublicBranding().loginLayout());
        for (String ok : new String[] {"\"CLASSIC\"", "\"SPLIT\"", "null"}) {
            var general = mapper.readTree("{\"appearance\":{\"loginLayout\":" + ok + "}}");
            assertDoesNotThrow(() -> SystemConfigurationService.validateLoginLayout(general), ok);
        }
        for (String bad : new String[] {"\"split\"", "\"MODERN\"", "1", "true"}) {
            var general = mapper.readTree("{\"appearance\":{\"loginLayout\":" + bad + "}}");
            assertThrows(IllegalArgumentException.class, () -> SystemConfigurationService.validateLoginLayout(general), bad);
        }
    }

    private static final String PNG_PIXEL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

    @Test
    void theSignInCarouselIsPassedOnWithOnlyItsKnownFieldsAndOnlyValidSlidesAreSaved() throws Exception {
        assertNull(serviceWithGeneral("{}").getPublicBranding().loginCarousel());
        assertNull(serviceWithGeneral("{\"appearance\":{\"loginCarousel\":{\"slides\":[]}}}").getPublicBranding().loginCarousel());
        var shown = serviceWithGeneral("{\"appearance\":{\"loginCarousel\":{\"intervalSeconds\":8,\"secret\":\"x\",\"slides\":[{\"title\":\"A\",\"subtitle\":\"B\",\"image\":\"" + PNG_PIXEL + "\",\"note\":\"hidden\"}]}}}").getPublicBranding().loginCarousel();
        assertEquals(8, shown.get("intervalSeconds").asInt());
        assertEquals("A", shown.get("slides").get(0).get("title").asText());
        assertFalse(shown.has("secret"));
        assertFalse(shown.get("slides").get(0).has("note"));

        String slide = "{\"title\":\"A\",\"subtitle\":\"B\",\"image\":\"" + PNG_PIXEL + "\"}";
        for (String ok : new String[] {"null", "{\"intervalSeconds\":3,\"slides\":[" + slide + "]}", "{\"intervalSeconds\":30,\"slides\":[]}"}) {
            var general = mapper.readTree("{\"appearance\":{\"loginCarousel\":" + ok + "}}");
            assertDoesNotThrow(() -> SystemConfigurationService.validateLoginCarousel(general), ok);
        }
        String seven = String.join(",", java.util.Collections.nCopies(7, slide));
        for (String bad : new String[] {"[]", "{\"intervalSeconds\":2,\"slides\":[" + slide + "]}", "{\"intervalSeconds\":31,\"slides\":[" + slide + "]}",
                "{\"slides\":[" + seven + "]}", "{\"slides\":[{\"title\":\"A\"}]}", "{\"slides\":[{\"image\":\"https://x/y.png\"}]}",
                "{\"slides\":[{\"image\":\"data:image/svg+xml;base64,AAAA\"}]}", "{\"slides\":[{\"title\":\"" + "t".repeat(81) + "\",\"image\":\"" + PNG_PIXEL + "\"}]}",
                "{\"slides\":[{\"subtitle\":\"" + "s".repeat(201) + "\",\"image\":\"" + PNG_PIXEL + "\"}]}"}) {
            var general = mapper.readTree("{\"appearance\":{\"loginCarousel\":" + bad + "}}");
            assertThrows(IllegalArgumentException.class, () -> SystemConfigurationService.validateLoginCarousel(general), bad);
        }
    }

    @Test
    void knowledgeFolderNamesAreFullUnlessTheAdministratorChoosesAbbreviationAndOnlyKnownValuesAreSaved() throws Exception {
        assertEquals("FULL", serviceWithGeneral("{}").getPublicBranding().knowledgeFolderNames());
        assertEquals("ABBREVIATION", serviceWithGeneral("{\"appearance\":{\"knowledgeFolderNames\":\"ABBREVIATION\"}}").getPublicBranding().knowledgeFolderNames());
        assertEquals("FULL", serviceWithGeneral("{\"appearance\":{\"knowledgeFolderNames\":\"short\"}}").getPublicBranding().knowledgeFolderNames());
        for (String ok : new String[] {"\"FULL\"", "\"ABBREVIATION\"", "null"}) {
            var general = mapper.readTree("{\"appearance\":{\"knowledgeFolderNames\":" + ok + "}}");
            assertDoesNotThrow(() -> SystemConfigurationService.validateKnowledgeFolderNames(general), ok);
        }
        for (String bad : new String[] {"\"short\"", "\"full\"", "1", "true"}) {
            var general = mapper.readTree("{\"appearance\":{\"knowledgeFolderNames\":" + bad + "}}");
            assertThrows(IllegalArgumentException.class, () -> SystemConfigurationService.validateKnowledgeFolderNames(general), bad);
        }
    }

    @Test
    void knowledgeBaseOpensInANewTabUnlessTheAdministratorTurnedItOff() throws Exception {
        assertTrue(serviceWithGeneral("{}").getPublicBranding().knowledgeOpenInNewTab());
        assertTrue(serviceWithGeneral("{\"appearance\":{\"showSidebarUserProfile\":true}}").getPublicBranding().knowledgeOpenInNewTab());
        assertTrue(serviceWithGeneral("{\"appearance\":{\"knowledgeOpenInNewTab\":true}}").getPublicBranding().knowledgeOpenInNewTab());
        assertFalse(serviceWithGeneral("{\"appearance\":{\"knowledgeOpenInNewTab\":false}}").getPublicBranding().knowledgeOpenInNewTab());
    }

    @Test
    void theSidebarNamesItsFoldersOnItsOwnAndFollowsTheLayoutUntilTheAdministratorChoosesForIt() throws Exception {
        assertEquals("FULL", serviceWithGeneral("{}").getPublicBranding().knowledgeSidebarFolderNames());
        // nothing chosen for the sidebar: it follows the layout
        assertEquals("ABBREVIATION", serviceWithGeneral("{\"appearance\":{\"knowledgeFolderNames\":\"ABBREVIATION\"}}").getPublicBranding().knowledgeSidebarFolderNames());
        // its own choice wins, either way
        var layoutAbbreviated = serviceWithGeneral("{\"appearance\":{\"knowledgeFolderNames\":\"ABBREVIATION\",\"knowledgeSidebarFolderNames\":\"FULL\"}}").getPublicBranding();
        assertEquals("ABBREVIATION", layoutAbbreviated.knowledgeFolderNames());
        assertEquals("FULL", layoutAbbreviated.knowledgeSidebarFolderNames());
        assertEquals("ABBREVIATION", serviceWithGeneral("{\"appearance\":{\"knowledgeSidebarFolderNames\":\"ABBREVIATION\"}}").getPublicBranding().knowledgeSidebarFolderNames());
        for (String bad : new String[] {"\"short\"", "1"}) {
            var general = mapper.readTree("{\"appearance\":{\"knowledgeSidebarFolderNames\":" + bad + "}}");
            assertThrows(IllegalArgumentException.class, () -> SystemConfigurationService.validateKnowledgeFolderNames(general), bad);
        }
    }

    @Test
    void knowledgeBackgroundIsAColourOrGradientTheAdministratorSetAndNeverAnImageOrVideo() throws Exception {
        assertNull(serviceWithGeneral("{}").getPublicBranding().knowledgeBackground());
        String solid = "{\"mode\":\"solid\",\"colors\":[\"#f0fdf4\",\"#ffffff\"],\"angle\":0}";
        assertEquals("solid", serviceWithGeneral("{\"appearance\":{\"knowledgeBackground\":" + solid + "}}").getPublicBranding().knowledgeBackground().get("mode").asText());
        var general = mapper.readTree("{\"appearance\":{\"knowledgeBackground\":" + solid + "}}");
        assertDoesNotThrow(() -> SystemConfigurationService.validatePageBackgrounds(general));
        for (String mode : new String[] {"image", "video"}) {
            var bad = mapper.readTree("{\"appearance\":{\"knowledgeBackground\":{\"mode\":\"" + mode + "\",\"colors\":[\"#ffffff\",\"#000000\"],\"angle\":0}}}");
            assertThrows(IllegalArgumentException.class, () -> SystemConfigurationService.validatePageBackgrounds(bad), mode);
        }
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
    void headerTitleIsTheAdministratorsTextOrNothingAtAll() throws Exception {
        assertNull(serviceWithGeneral("{}").getPublicBranding().systemHeaderTitle());
        assertNull(serviceWithGeneral("{\"systemHeaderTitle\":null}").getPublicBranding().systemHeaderTitle());
        assertNull(serviceWithGeneral("{\"systemHeaderTitle\":\"   \"}").getPublicBranding().systemHeaderTitle());
        assertEquals("Quality Hub", serviceWithGeneral("{\"systemHeaderTitle\":\"  Quality Hub \"}").getPublicBranding().systemHeaderTitle());
    }

    @Test
    void headerTitleIsReadFromTheGeneralSettingsNotFromTheAppearanceSection() throws Exception {
        assertNull(serviceWithGeneral("{\"appearance\":{\"systemHeaderTitle\":\"Hidden\"}}").getPublicBranding().systemHeaderTitle());
    }

    @Test
    void headerTitleValidationAcceptsMissingBlankAndOneShortLine() throws Exception {
        for (String json : new String[] {"{}", "{\"systemHeaderTitle\":null}", "{\"systemHeaderTitle\":\"\"}",
                "{\"systemHeaderTitle\":\"Electronic Quality Management Software\"}", "{\"systemHeaderTitle\":\"Phần mềm quản lý chất lượng điện tử\"}"}) {
            assertDoesNotThrow(() -> SystemConfigurationService.validateSystemHeaderTitle(mapper.readTree(json)), json);
        }
        assertDoesNotThrow(() -> SystemConfigurationService.validateSystemHeaderTitle(null));
    }

    @Test
    void headerTitleValidationRefusesWhatCannotBeATitle() throws Exception {
        String tooLong = "x".repeat(SystemConfigurationService.SYSTEM_HEADER_TITLE_MAX_LENGTH + 1);
        assertDoesNotThrow(() -> SystemConfigurationService.validateSystemHeaderTitle(
                mapper.readTree("{\"systemHeaderTitle\":\"" + "x".repeat(SystemConfigurationService.SYSTEM_HEADER_TITLE_MAX_LENGTH) + "\"}")));
        for (String json : new String[] {"{\"systemHeaderTitle\":\"" + tooLong + "\"}", "{\"systemHeaderTitle\":123}",
                "{\"systemHeaderTitle\":{\"a\":1}}", "{\"systemHeaderTitle\":\"two\\nlines\"}", "{\"systemHeaderTitle\":\"tab\\there\"}"}) {
            assertThrows(IllegalArgumentException.class, () -> SystemConfigurationService.validateSystemHeaderTitle(mapper.readTree(json)), json);
        }
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

    @Test
    void footerHasALeftAndARightTextAndKeepsTheOldBehaviourUntilTheSwitchesAreSet() throws Exception {
        var defaults = serviceWithGeneral("{}").getPublicBranding();
        assertNull(defaults.systemFooterLeft());
        assertNull(defaults.systemFooterRight());
        assertTrue(defaults.footerShowOnDesktop());
        assertFalse(defaults.footerShowOnMobile());
        var set = serviceWithGeneral("{\"systemFooterLeft\":\"Left\",\"systemFooterRight\":\"Right\",\"footerShowOnDesktop\":false,\"footerShowOnMobile\":true}").getPublicBranding();
        assertEquals("Left", set.systemFooterLeft());
        assertEquals("Right", set.systemFooterRight());
        assertFalse(set.footerShowOnDesktop());
        assertTrue(set.footerShowOnMobile());
    }

    @Test
    void footerValidationRejectsLongTextLineBreaksAndSwitchesThatAreNotBooleans() throws Exception {
        var json = new com.fasterxml.jackson.databind.ObjectMapper();
        org.junit.jupiter.api.Assertions.assertDoesNotThrow(() -> SystemConfigurationService.validateFooter(json.readTree("{\"systemFooterLeft\":\"\",\"systemFooterRight\":\"© {year}\",\"footerShowOnMobile\":true}")));
        org.junit.jupiter.api.Assertions.assertThrows(IllegalArgumentException.class, () -> SystemConfigurationService.validateFooter(json.readTree("{\"systemFooterRight\":\"" + "x".repeat(501) + "\"}")));
        org.junit.jupiter.api.Assertions.assertThrows(IllegalArgumentException.class, () -> SystemConfigurationService.validateFooter(json.readTree("{\"systemFooterLeft\":\"a\\nb\"}")));
        org.junit.jupiter.api.Assertions.assertThrows(IllegalArgumentException.class, () -> SystemConfigurationService.validateFooter(json.readTree("{\"systemFooterLeft\":5}")));
        org.junit.jupiter.api.Assertions.assertThrows(IllegalArgumentException.class, () -> SystemConfigurationService.validateFooter(json.readTree("{\"footerShowOnDesktop\":\"yes\"}")));
    }
}
