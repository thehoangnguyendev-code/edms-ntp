package com.eqms.service;

import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.SystemConfiguration;
import com.eqms.entity.UserAccount;
import com.eqms.repository.SystemConfigurationRepository;
import com.eqms.service.OnlyOfficeConfigurationService;
import com.eqms.service.OnlyOfficeDocumentEditService;
import com.eqms.service.OnlyOfficeViewWatermark;
import com.eqms.service.PreviewWatermark;
import com.eqms.service.SystemConfigurationService;
import com.eqms.service.editprovider.EditMode;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * The OnlyOffice Preview settings (Settings > Configuration > Preview File): the mode of Pending Review and Pending Approval, and the traceability watermark of the
 * read-only viewer, which follows the PDF preview watermark.
 */
class OnlyOfficeViewerSettingsTest {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final PreviewWatermark.Context CONTEXT = new PreviewWatermark.Context("Nguyen The Hoang", "NTP.0005", Instant.parse("2026-11-02T04:20:43Z"));

    private static JsonNode node(String json) throws Exception {
        return JSON.readTree(json);
    }

    private static OnlyOfficeConfigurationService serviceWithViewer(String viewerJson) throws Exception {
        SystemConfigurationRepository repository = mock(SystemConfigurationRepository.class);
        SystemConfiguration configuration = mock(SystemConfiguration.class);
        when(configuration.getGeneralConfig()).thenReturn(node("{\"backupSettings\":{\"onlyOffice\":{\"viewer\":" + viewerJson + "}}}"));
        when(repository.findByConfigKey("default")).thenReturn(Optional.of(configuration));
        return new OnlyOfficeConfigurationService(repository, JSON);
    }

    // ------------------------------------------------------------------------------------------------------------ the mode of a stage

    @Test
    void untilItIsSetPendingReviewIsReviewModeAndPendingApprovalIsCommentOnlyAsBefore() throws Exception {
        OnlyOfficeConfigurationService service = serviceWithViewer("{}");
        assertThat(service.editModeForStage("PENDING_REVIEW")).isEqualTo(EditMode.REVIEW);
        assertThat(service.editModeForStage("PENDING_APPROVAL")).isEqualTo(EditMode.COMMENT_ONLY);
    }

    @Test
    void eachStageFollowsItsOwnSetting() throws Exception {
        OnlyOfficeConfigurationService swapped = serviceWithViewer("{\"pendingReviewMode\":\"COMMENT_ONLY\",\"pendingApprovalMode\":\"REVIEW\"}");
        assertThat(swapped.editModeForStage("PENDING_REVIEW")).isEqualTo(EditMode.COMMENT_ONLY);
        assertThat(swapped.editModeForStage("PENDING_APPROVAL")).isEqualTo(EditMode.REVIEW);
        assertThat(swapped.editModeForStage("pending_review")).isEqualTo(EditMode.COMMENT_ONLY);
    }

    @Test
    void aValueThatIsNotAModeFallsBackToTheDefaultAndOtherStagesHaveNoSetting() throws Exception {
        OnlyOfficeConfigurationService service = serviceWithViewer("{\"pendingReviewMode\":\"EDIT\",\"pendingApprovalMode\":7}");
        assertThat(service.editModeForStage("PENDING_REVIEW")).isEqualTo(EditMode.REVIEW);
        assertThat(service.editModeForStage("PENDING_APPROVAL")).isEqualTo(EditMode.COMMENT_ONLY);
        assertThatThrownBy(() -> service.editModeForStage("DRAFT")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void theModeOfAStageDecidesWhatTheEditorMayDo() {
        OnlyOfficeConfigurationService configuration = mock(OnlyOfficeConfigurationService.class);
        when(configuration.getEffectiveConfiguration()).thenReturn(new OnlyOfficeConfigurationService.OnlyOfficeConfiguration(
                true, "http://onlyoffice-documentserver", "http://backend:5000", "test-secret-key-must-be-at-least-32-bytes"));
        when(configuration.editModeForStage("PENDING_REVIEW")).thenReturn(EditMode.COMMENT_ONLY);
        OnlyOfficeDocumentEditService service = new OnlyOfficeDocumentEditService(configuration, mock(SystemConfigurationService.class), JSON);
        assertThat(service.configuredModeFor("PENDING_REVIEW")).isEqualTo(EditMode.COMMENT_ONLY);
    }

    // ------------------------------------------------------------------------------------------------------------ validation

    @Test
    void aSaveAcceptsTheViewerSettingsAndALegacyMissingBlock() throws Exception {
        OnlyOfficeConfigurationService.validateViewerSettings(node("{}"));
        OnlyOfficeConfigurationService.validateViewerSettings(node("{\"backupSettings\":{\"onlyOffice\":{}}}"));
        OnlyOfficeConfigurationService.validateViewerSettings(node("{\"backupSettings\":{\"onlyOffice\":{\"viewer\":{\"showFileName\":true,\"pendingReviewMode\":\"REVIEW\","
                + "\"pendingApprovalMode\":\"COMMENT_ONLY\",\"watermarkEnabled\":true,\"watermarkText\":\"NOT FOR USE\",\"watermarkStrength\":\"strong\","
                + "\"watermarkColor\":\"#112233\",\"watermarkAngle\":-30,\"watermarkTiled\":true,\"watermarkShowViewerName\":true}}}}"));
    }

    @Test
    void aSaveRefusesWhatTheViewerCannotUse() throws Exception {
        for (String bad : new String[] {
                "\"pendingReviewMode\":\"EDIT\"", "\"pendingApprovalMode\":\"VIEW\"", "\"pendingReviewMode\":1",
                "\"watermarkEnabled\":\"yes\"", "\"watermarkTiled\":1", "\"watermarkStrength\":\"loud\"", "\"watermarkColor\":\"red\"",
                "\"watermarkAngle\":91", "\"watermarkAngle\":-91", "\"watermarkAngle\":30.5", "\"watermarkAngle\":\"45\"",
                "\"watermarkText\":\"" + "X".repeat(121) + "\"", "\"watermarkText\":5"}) {
            JsonNode general = node("{\"backupSettings\":{\"onlyOffice\":{\"viewer\":{" + bad + "}}}}");
            assertThatThrownBy(() -> OnlyOfficeConfigurationService.validateViewerSettings(general), bad).isInstanceOf(IllegalArgumentException.class);
        }
    }

    // ------------------------------------------------------------------------------------------------------------ the watermark

    private static java.awt.image.BufferedImage picture(ObjectNode mark) throws Exception {
        String fill = mark.path("fill").asText();
        assertThat(fill).startsWith("data:image/png;base64,");
        return javax.imageio.ImageIO.read(new java.io.ByteArrayInputStream(java.util.Base64.getDecoder().decode(fill.substring("data:image/png;base64,".length()))));
    }

    /** The number of painted pixels of the picture and the strongest of them. */
    private static int[] painted(java.awt.image.BufferedImage image) {
        int count = 0, strongest = 0;
        for (int y = 0; y < image.getHeight(); y++) {
            for (int x = 0; x < image.getWidth(); x++) {
                int argb = image.getRGB(x, y);
                if ((argb >>> 24) > 0) {
                    count++;
                    if ((argb >>> 24) > (strongest >>> 24)) strongest = argb;
                }
            }
        }
        return new int[] {count, strongest};
    }

    private static int verticalExtent(java.awt.image.BufferedImage image) {
        int top = image.getHeight(), bottom = 0;
        for (int y = 0; y < image.getHeight(); y++) {
            for (int x = 0; x < image.getWidth(); x++) {
                if ((image.getRGB(x, y) >>> 24) > 0) {
                    top = Math.min(top, y);
                    bottom = Math.max(bottom, y);
                    break;
                }
            }
        }
        return Math.max(0, bottom - top);
    }

    @Test
    void thereIsNoWatermarkUntilTheAdministratorSwitchesItOn() throws Exception {
        assertThat(OnlyOfficeViewWatermark.build(JSON, node("{}"), CONTEXT)).isNull();
        assertThat(OnlyOfficeViewWatermark.build(JSON, node("{\"watermarkEnabled\":false,\"watermarkText\":\"X\"}"), CONTEXT)).isNull();
        assertThat(OnlyOfficeViewWatermark.build(JSON, null, CONTEXT)).isNull();
    }

    @Test
    void theMarkIsAPictureInTheColourOfTheSettingShownAtTheOpacityOfTheStrength() throws Exception {
        ObjectNode mark = OnlyOfficeViewWatermark.build(JSON, node("{\"watermarkEnabled\":true,\"watermarkColor\":\"#FF0000\",\"watermarkStrength\":\"strong\",\"watermarkShowViewerName\":true}"), CONTEXT);

        assertThat(mark).isNotNull();
        assertThat((float) mark.path("transparent").asDouble()).isEqualTo(PreviewWatermark.alphaFor("strong"));
        assertThat(mark.path("rotate").asInt()).isZero(); // the picture is turned itself, like the PDF block
        assertThat(mark.path("width").asInt()).isGreaterThan(250);
        assertThat(mark.path("height").asInt()).isGreaterThanOrEqualTo(mark.path("width").asInt()); // a square frame: it holds a page in either direction
        java.awt.image.BufferedImage image = picture(mark);
        int[] result = painted(image);
        assertThat(result[0]).isPositive();
        assertThat(result[1] & 0xFFFFFF).isEqualTo(0xFF0000); // every painted pixel has the colour; the opacity of the strength is applied by the editor
        assertThat(image.getRGB(0, 0) >>> 24).isZero(); // transparent where nothing is written
    }

    @Test
    void withoutSettingsTheMarkHasTheDefaultsOfThePdfWatermark() throws Exception {
        ObjectNode mark = OnlyOfficeViewWatermark.build(JSON, node("{\"watermarkEnabled\":true}"), CONTEXT);

        assertThat((float) mark.path("transparent").asDouble()).isEqualTo(PreviewWatermark.alphaFor("standard"));
        float[] colour = PreviewWatermark.rgbFor(PreviewWatermark.DEFAULT_COLOR);
        int expected = (Math.round(colour[0] * 255) << 16) | (Math.round(colour[1] * 255) << 8) | Math.round(colour[2] * 255);
        assertThat(painted(picture(mark))[1] & 0xFFFFFF).isEqualTo(expected);
    }

    @Test
    void theLinesOfTheMarkAreThoseOfThePdfWatermarkSoMoreSettingsPaintMore() throws Exception {
        long textOnly = painted(picture(OnlyOfficeViewWatermark.build(JSON, node("{\"watermarkEnabled\":true}"), CONTEXT)))[0];
        long withViewer = painted(picture(OnlyOfficeViewWatermark.build(JSON, node("{\"watermarkEnabled\":true,\"watermarkShowEmployeeCode\":true,\"watermarkShowViewerName\":true}"), CONTEXT)))[0];
        long withTime = painted(picture(OnlyOfficeViewWatermark.build(JSON, node("{\"watermarkEnabled\":true,\"watermarkShowEmployeeCode\":true,\"watermarkShowViewerName\":true,\"watermarkShowOpenedAt\":true}"), CONTEXT)))[0];
        assertThat(withViewer).isGreaterThan(textOnly);
        assertThat(withTime).isGreaterThan(withViewer);
    }

    @Test
    void theAngleTurnsThePictureAndTheGridRepeatsTheBlockOverThePage() throws Exception {
        java.awt.image.BufferedImage flat = picture(OnlyOfficeViewWatermark.build(JSON, node("{\"watermarkEnabled\":true,\"watermarkAngle\":0}"), CONTEXT));
        java.awt.image.BufferedImage turned = picture(OnlyOfficeViewWatermark.build(JSON, node("{\"watermarkEnabled\":true,\"watermarkAngle\":45}"), CONTEXT));
        // at 0 degrees the text is one band across the middle; at 45 it reaches towards the corners
        assertThat(verticalExtent(flat)).isLessThan(verticalExtent(turned));

        long single = painted(picture(OnlyOfficeViewWatermark.build(JSON, node("{\"watermarkEnabled\":true,\"watermarkShowViewerName\":true}"), CONTEXT)))[0];
        long grid = painted(picture(OnlyOfficeViewWatermark.build(JSON, node("{\"watermarkEnabled\":true,\"watermarkShowViewerName\":true,\"watermarkTiled\":true}"), CONTEXT)))[0];
        assertThat(grid).isGreaterThan(single);
        // the picture travels inside the signed configuration of the editor: it must stay small
        assertThat(OnlyOfficeViewWatermark.build(JSON, node("{\"watermarkEnabled\":true,\"watermarkTiled\":true}"), CONTEXT).toString().length()).isLessThan(400_000);
    }

    @Test
    void theViewerConfigCarriesTheMarkAndTheEditorConfigsDoNot() throws Exception {
        OnlyOfficeConfigurationService configuration = mock(OnlyOfficeConfigurationService.class);
        when(configuration.getEffectiveConfiguration()).thenReturn(new OnlyOfficeConfigurationService.OnlyOfficeConfiguration(
                true, "http://onlyoffice-documentserver", "http://backend:5000", "test-secret-key-must-be-at-least-32-bytes"));
        when(configuration.getViewerOptions()).thenReturn(new OnlyOfficeConfigurationService.ViewerOptions(false, false, true));
        when(configuration.getViewerSettings()).thenReturn(node("{\"watermarkEnabled\":true,\"watermarkText\":\"CONTROLLED\",\"watermarkShowViewerName\":true}"));
        SystemConfigurationService system = mock(SystemConfigurationService.class);
        OnlyOfficeDocumentEditService service = new OnlyOfficeDocumentEditService(configuration, system, JSON);
        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setId(UUID.randomUUID());
        revision.setFileName("revision.docx");
        UserAccount user = new UserAccount();
        user.setId(UUID.randomUUID());
        user.setFullName("Nguyen The Hoang");
        user.setEmployeeCode("NTP.0005");

        JsonNode viewer = service.buildEditorConfig(revision, EditMode.VIEW, user).path("document").path("options").path("watermark_on_draw");
        assertThat(viewer.isMissingNode()).isFalse();
        assertThat(viewer.path("fill").asText()).startsWith("data:image/png;base64,");

        for (EditMode mode : new EditMode[] {EditMode.EDIT, EditMode.REVIEW, EditMode.COMMENT_ONLY}) {
            assertThat(service.buildEditorConfig(revision, mode, user).path("document").path("options").isMissingNode()).as(mode.name()).isTrue();
        }
    }

    @Test
    void theViewerOpensWithoutAMarkWhenTheWatermarkIsOff() throws Exception {
        OnlyOfficeConfigurationService configuration = mock(OnlyOfficeConfigurationService.class);
        when(configuration.getEffectiveConfiguration()).thenReturn(new OnlyOfficeConfigurationService.OnlyOfficeConfiguration(
                true, "http://onlyoffice-documentserver", "http://backend:5000", "test-secret-key-must-be-at-least-32-bytes"));
        when(configuration.getViewerOptions()).thenReturn(new OnlyOfficeConfigurationService.ViewerOptions(false, false, true));
        when(configuration.getViewerSettings()).thenReturn(node("{\"watermarkText\":\"IGNORED\"}"));
        OnlyOfficeDocumentEditService service = new OnlyOfficeDocumentEditService(configuration, mock(SystemConfigurationService.class), JSON);
        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setId(UUID.randomUUID());
        revision.setFileName("revision.docx");
        UserAccount user = new UserAccount();
        user.setId(UUID.randomUUID());

        assertThat(service.buildEditorConfig(revision, EditMode.VIEW, user).path("document").path("options").isMissingNode()).isTrue();
    }

    // ------------------------------------------------------------------------------------------------------------ plugins (draw.io)

    @Test
    void thePluginsTabIsOfferedOnlyToAPersonWhoEdits() throws Exception {
        OnlyOfficeConfigurationService configuration = mock(OnlyOfficeConfigurationService.class);
        when(configuration.getEffectiveConfiguration()).thenReturn(new OnlyOfficeConfigurationService.OnlyOfficeConfiguration(
                true, "http://onlyoffice-documentserver", "http://backend:5000", "test-secret-key-must-be-at-least-32-bytes"));
        when(configuration.getViewerOptions()).thenReturn(new OnlyOfficeConfigurationService.ViewerOptions(false, false, false));
        when(configuration.getViewerSettings()).thenReturn(node("{}"));
        OnlyOfficeDocumentEditService service = new OnlyOfficeDocumentEditService(configuration, mock(SystemConfigurationService.class), JSON);
        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setId(UUID.randomUUID());
        revision.setFileName("revision.docx");
        UserAccount user = new UserAccount();
        user.setId(UUID.randomUUID());

        assertThat(service.buildEditorConfig(revision, EditMode.EDIT, user).path("editorConfig").path("customization").path("plugins").asBoolean(false)).isTrue();
        for (EditMode mode : EditMode.values()) {
            assertThat(service.buildEditorConfig(revision, mode, user).path("editorConfig").path("customization").path("uiTheme").asText()).as(mode.name()).isEqualTo("theme-white"); // Modern Light
        }
        for (EditMode mode : new EditMode[] {EditMode.REVIEW, EditMode.COMMENT_ONLY, EditMode.VIEW}) {
            assertThat(service.buildEditorConfig(revision, mode, user).path("editorConfig").path("customization").path("plugins").asBoolean(true)).as(mode.name()).isFalse();
        }
    }

    // ------------------------------------------------------------------------------------------------------------ download and print of an editing session

    private static OnlyOfficeDocumentEditService editingService(String viewerJson) throws Exception {
        OnlyOfficeConfigurationService configuration = mock(OnlyOfficeConfigurationService.class);
        when(configuration.getEffectiveConfiguration()).thenReturn(new OnlyOfficeConfigurationService.OnlyOfficeConfiguration(
                true, "http://onlyoffice-documentserver", "http://backend:5000", "test-secret-key-must-be-at-least-32-bytes"));
        when(configuration.getViewerOptions()).thenReturn(new OnlyOfficeConfigurationService.ViewerOptions(false, false, true));
        when(configuration.getViewerSettings()).thenReturn(viewerJson == null ? null : node(viewerJson));
        return new OnlyOfficeDocumentEditService(configuration, mock(SystemConfigurationService.class), JSON);
    }

    private static JsonNode permissions(OnlyOfficeDocumentEditService service, EditMode mode) {
        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setId(UUID.randomUUID());
        revision.setFileName("revision.docx");
        UserAccount user = new UserAccount();
        user.setId(UUID.randomUUID());
        return service.buildEditorConfig(revision, mode, user).path("document").path("permissions");
    }

    @Test
    void untilTheyAreTurnedOffAnEditingSessionCanDownloadAndPrintAsBefore() throws Exception {
        for (String viewer : new String[] {null, "{}", "{\"editorAllowDownload\":null}"}) {
            for (EditMode mode : new EditMode[] {EditMode.EDIT, EditMode.REVIEW, EditMode.COMMENT_ONLY}) {
                JsonNode permissions = permissions(editingService(viewer), mode);
                assertThat(permissions.path("download").asBoolean()).as(mode + " " + viewer).isTrue();
                assertThat(permissions.path("print").asBoolean()).as(mode + " " + viewer).isTrue();
            }
        }
    }

    @Test
    void downloadAndPrintAreSwitchedOffApartInEveryEditingMode() throws Exception {
        for (EditMode mode : new EditMode[] {EditMode.EDIT, EditMode.REVIEW, EditMode.COMMENT_ONLY}) {
            JsonNode noPrint = permissions(editingService("{\"editorAllowPrint\":false}"), mode);
            assertThat(noPrint.path("print").asBoolean()).as(mode.name()).isFalse();
            assertThat(noPrint.path("download").asBoolean()).as(mode.name()).isTrue();

            JsonNode noDownload = permissions(editingService("{\"editorAllowDownload\":false}"), mode);
            assertThat(noDownload.path("download").asBoolean()).as(mode.name()).isFalse();
            assertThat(noDownload.path("print").asBoolean()).as(mode.name()).isTrue();

            JsonNode neither = permissions(editingService("{\"editorAllowDownload\":false,\"editorAllowPrint\":false}"), mode);
            assertThat(neither.path("download").asBoolean()).isFalse();
            assertThat(neither.path("print").asBoolean()).isFalse();
        }
    }

    @Test
    void theReadOnlyViewerNeverAllowsDownloadOrPrintWhateverTheSwitchesSay() throws Exception {
        JsonNode permissions = permissions(editingService("{\"editorAllowDownload\":true,\"editorAllowPrint\":true}"), EditMode.VIEW);
        assertThat(permissions.path("download").asBoolean()).isFalse();
        assertThat(permissions.path("print").asBoolean()).isFalse();
    }

    @Test
    void aSaveRefusesASwitchThatIsNotTrueOrFalse() throws Exception {
        OnlyOfficeConfigurationService.validateViewerSettings(node("{\"backupSettings\":{\"onlyOffice\":{\"viewer\":{\"editorAllowDownload\":false,\"editorAllowPrint\":true}}}}"));
        assertThatThrownBy(() -> OnlyOfficeConfigurationService.validateViewerSettings(node("{\"backupSettings\":{\"onlyOffice\":{\"viewer\":{\"editorAllowPrint\":\"no\"}}}}")))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
