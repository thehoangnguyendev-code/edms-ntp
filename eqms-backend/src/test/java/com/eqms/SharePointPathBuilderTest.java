package com.eqms;

import com.eqms.service.OfficeOnlineConfigurationService;
import com.eqms.service.SharePointPathBuilder;
import com.eqms.service.StoragePathBuilder;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.UUID;

class SharePointPathBuilderTest {

    private final SharePointPathBuilder builder = new SharePointPathBuilder(new StoragePathBuilder());
    private final OfficeOnlineConfigurationService.OfficeOnlineConfiguration config =
            new OfficeOnlineConfigurationService.OfficeOnlineConfiguration(
                    true,
                    "https://graph.microsoft.com/v1.0",
                    "tenant",
                    "client",
                    "secret",
                    "site",
                    "drive",
                    "EQMS",
                    "organization"
            );

    @Test
    void buildsEditOnlineWorkspace() {
        assertEquals(
                "EQMS/edit-online/documents/SOP.0001/revisions/0.0.1/SOP.0001_0.0.1.docx",
                builder.editOnlineFile(config, "SOP.0001", "0.0.1", "SOP.0001_0.0.1.docx")
        );
    }

    @Test
    void buildsV2WorkspaceFromImmutableRevisionId() {
        assertEquals(
                "EQMS/workspaces/documents/SOP.0001/revisions/11111111-1111-1111-1111-111111111111",
                builder.editOnlineFolderV2(
                        config,
                        "SOP.0001",
                        UUID.fromString("11111111-1111-1111-1111-111111111111")
                )
        );
    }

    @Test
    void buildsConversionWorkspace() {
        assertEquals(
                "EQMS/conversion/revisions/12345/preview-abc_file.docx",
                builder.conversionFile(config, "revisions", "12345", "preview-abc file.docx")
        );
    }

    @Test
    void buildsPublishingWorkspace() {
        assertEquals(
                "EQMS/publishing/documents/SOP.0001/revisions/1.0.0/SOP.0001_1.0.0_publish.docx",
                builder.publishingFile(config, "SOP.0001", "1.0.0", "SOP.0001_1.0.0_publish.docx")
        );
    }

    @Test
    void buildsTempWorkspace() {
        String value = builder.tempFile(config, "revisions", "abc", "draft.docx");
        assertTrue(value.startsWith("EQMS/temp/revisions/abc/"));
        assertTrue(value.endsWith("_draft.docx"));
    }
}
