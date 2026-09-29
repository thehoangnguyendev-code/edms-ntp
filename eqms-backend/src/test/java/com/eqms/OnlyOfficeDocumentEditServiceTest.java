package com.eqms;

import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.UserAccount;
import com.eqms.service.OnlyOfficeConfigurationService;
import com.eqms.service.OnlyOfficeDocumentEditService;
import com.eqms.service.editprovider.EditMode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class OnlyOfficeDocumentEditServiceTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    private OnlyOfficeConfigurationService configuredService(String jwtSecret) {
        OnlyOfficeConfigurationService configurationService = mock(OnlyOfficeConfigurationService.class);
        when(configurationService.getEffectiveConfiguration()).thenReturn(
                new OnlyOfficeConfigurationService.OnlyOfficeConfiguration(
                        true, "http://onlyoffice-documentserver", "http://backend:5000", jwtSecret));
        return configurationService;
    }

    private DocumentRevisionRecord revision(UUID id, String fileName) {
        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setId(id);
        revision.setFileName(fileName);
        return revision;
    }

    private UserAccount user(UUID id, String fullName) {
        UserAccount user = new UserAccount();
        user.setId(id);
        user.setFullName(fullName);
        return user;
    }

    @Test
    void buildEditorConfigSetsEditPermissionsForEditMode() {
        OnlyOfficeDocumentEditService service = new OnlyOfficeDocumentEditService(configuredService("test-secret-key-must-be-at-least-32-bytes"), org.mockito.Mockito.mock(com.eqms.service.SystemConfigurationService.class), objectMapper);
        DocumentRevisionRecord revision = revision(UUID.randomUUID(), "revision.docx");
        UserAccount currentUser = user(UUID.randomUUID(), "Test Author");

        ObjectNode config = service.buildEditorConfig(revision, EditMode.EDIT, currentUser);

        ObjectNode permissions = (ObjectNode) config.path("document").path("permissions");
        assertThat(permissions.path("edit").asBoolean()).isTrue();
        assertThat(permissions.path("review").asBoolean()).isFalse();
        assertThat(config.path("token").asText()).isNotBlank();
    }

    @Test
    void buildEditorConfigForcesReviewModeToTrackChangesOnly() {
        OnlyOfficeDocumentEditService service = new OnlyOfficeDocumentEditService(configuredService("test-secret-key-must-be-at-least-32-bytes"), org.mockito.Mockito.mock(com.eqms.service.SystemConfigurationService.class), objectMapper);
        DocumentRevisionRecord revision = revision(UUID.randomUUID(), "revision.docx");
        UserAccount currentUser = user(UUID.randomUUID(), "Test Reviewer");

        ObjectNode config = service.buildEditorConfig(revision, EditMode.REVIEW, currentUser);

        ObjectNode permissions = (ObjectNode) config.path("document").path("permissions");
        // edit=false + review=true pins the reviewer to "Reviewing"; they cannot switch to "Editing".
        assertThat(permissions.path("edit").asBoolean()).isFalse();
        assertThat(permissions.path("review").asBoolean()).isTrue();
    }

    @Test
    void buildEditorConfigDeniesContentEditForCommentOnlyMode() {
        OnlyOfficeDocumentEditService service = new OnlyOfficeDocumentEditService(configuredService("test-secret-key-must-be-at-least-32-bytes"), org.mockito.Mockito.mock(com.eqms.service.SystemConfigurationService.class), objectMapper);
        DocumentRevisionRecord revision = revision(UUID.randomUUID(), "revision.docx");
        UserAccount currentUser = user(UUID.randomUUID(), "Test Approver");

        ObjectNode config = service.buildEditorConfig(revision, EditMode.COMMENT_ONLY, currentUser);

        ObjectNode permissions = (ObjectNode) config.path("document").path("permissions");
        assertThat(permissions.path("edit").asBoolean()).isFalse();
        assertThat(permissions.path("review").asBoolean()).isFalse();
        assertThat(permissions.path("comment").asBoolean()).isTrue();
    }

    @Test
    void buildViewerConfigUsesOnlyCommunityEditionCustomizations() {
        OnlyOfficeConfigurationService configurationService = configuredService("test-secret-key-must-be-at-least-32-bytes");
        when(configurationService.getViewerOptions()).thenReturn(
                new OnlyOfficeConfigurationService.ViewerOptions(false, true, false));
        OnlyOfficeDocumentEditService service = new OnlyOfficeDocumentEditService(
                configurationService, org.mockito.Mockito.mock(com.eqms.service.SystemConfigurationService.class), objectMapper);

        ObjectNode config = service.buildEditorConfig(
                revision(UUID.randomUUID(), "revision.docx"), EditMode.VIEW, user(UUID.randomUUID(), "Viewer"));

        ObjectNode permissions = (ObjectNode) config.path("document").path("permissions");
        ObjectNode customization = (ObjectNode) config.path("editorConfig").path("customization");
        assertThat(permissions.path("edit").asBoolean()).isFalse();
        assertThat(permissions.path("comment").asBoolean()).isFalse();
        assertThat(permissions.path("download").asBoolean()).isFalse();
        assertThat(permissions.path("print").asBoolean()).isFalse();
        assertThat(customization.path("plugins").asBoolean()).isFalse();
        assertThat(customization.path("hideRightMenu").asBoolean()).isFalse();
        assertThat(customization.path("toolbarHideFileName").asBoolean()).isTrue();
        assertThat(customization.path("compactHeader").asBoolean()).isTrue();
        assertThat(customization.has("layout")).isFalse();
        assertThat(customization.has("leftMenu")).isFalse();
        assertThat(customization.has("statusBar")).isFalse();
    }

    @Test
    void verifyAccessTokenReturnsTheMintingUserId() {
        String secret = "test-secret-key-must-be-at-least-32-bytes";
        OnlyOfficeDocumentEditService service = new OnlyOfficeDocumentEditService(configuredService(secret), org.mockito.Mockito.mock(com.eqms.service.SystemConfigurationService.class), objectMapper);
        UUID revisionId = UUID.randomUUID();
        UserAccount currentUser = user(UUID.randomUUID(), "Test User");
        DocumentRevisionRecord revision = revision(revisionId, "revision.docx");

        ObjectNode config = service.buildEditorConfig(revision, EditMode.EDIT, currentUser);
        String callbackUrl = config.path("editorConfig").path("callbackUrl").asText();
        String token = callbackUrl.substring(callbackUrl.indexOf("token=") + "token=".length());

        UUID resolvedUserId = service.verifyAccessToken(revisionId, token);

        assertThat(resolvedUserId).isEqualTo(currentUser.getId());
    }

    @Test
    void verifyAccessTokenRejectsTokenMintedForADifferentRevision() {
        String secret = "test-secret-key-must-be-at-least-32-bytes";
        OnlyOfficeDocumentEditService service = new OnlyOfficeDocumentEditService(configuredService(secret), org.mockito.Mockito.mock(com.eqms.service.SystemConfigurationService.class), objectMapper);
        DocumentRevisionRecord revision = revision(UUID.randomUUID(), "revision.docx");
        UserAccount currentUser = user(UUID.randomUUID(), "Test User");

        ObjectNode config = service.buildEditorConfig(revision, EditMode.EDIT, currentUser);
        String callbackUrl = config.path("editorConfig").path("callbackUrl").asText();
        String token = callbackUrl.substring(callbackUrl.indexOf("token=") + "token=".length());

        assertThatThrownBy(() -> service.verifyAccessToken(UUID.randomUUID(), token))
                .isInstanceOf(IllegalStateException.class);
    }
}
