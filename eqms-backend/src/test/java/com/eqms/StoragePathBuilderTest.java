package com.eqms;

import com.eqms.service.StoragePathBuilder;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.UUID;

public class StoragePathBuilderTest {

    private final StoragePathBuilder builder = new StoragePathBuilder();

    @Test
    public void buildsRevisionStoragePaths() {
        assertEquals(
                "documents/SOP.0001/revisions/1.0.0/source/SOP.0001_1.0.0.docx",
                builder.revisionSource("SOP.0001", "1.0.0", "SOP.0001_1.0.0.docx")
        );
        assertEquals(
                "documents/SOP.0001/revisions/1.0.0/review/review-snapshot.pdf",
                builder.revisionReviewPdf("SOP.0001", "1.0.0")
        );
        assertEquals(
                "documents/SOP.0001/revisions/1.0.0/published/published.pdf",
                builder.revisionPublishedPdf("SOP.0001", "1.0.0")
        );
    }

    @Test
    public void buildsV2PathsWithImmutableRevisionAndCopyIdentifiers() {
        UUID revisionId = UUID.fromString("11111111-1111-1111-1111-111111111111");
        UUID copyId = UUID.fromString("22222222-2222-2222-2222-222222222222");

        assertEquals(
                "documents/SOP.0001/revisions/11111111-1111-1111-1111-111111111111/source/source.docx",
                builder.revisionSourceV2(null, "SOP.0001", revisionId, "Original draft.docx")
        );
        assertEquals(
                "documents/SOP.0001/revisions/11111111-1111-1111-1111-111111111111/publishing/preview.pdf",
                builder.revisionPublishingPreviewPdfV2(null, "SOP.0001", revisionId)
        );
        assertEquals(
                "documents/SOP.0001/revisions/11111111-1111-1111-1111-111111111111/published/official.pdf",
                builder.revisionPublishedPdfV2(null, "SOP.0001", revisionId)
        );
        assertEquals(
                "controlled-copies/CCB.SOP.0001.B001/copies/CC.SOP.0001.001_22222222-2222-2222-2222-222222222222/issued.pdf",
                builder.controlledCopyPdfV2(null, "CCB.SOP.0001.B001", "CC.SOP.0001.001", copyId)
        );
    }

    @Test
    public void buildsControlledCopyAndEvidencePaths() {
        assertEquals(
                "controlled-copies/CC.SOP.0001/copies/CC.SOP.0001.001.pdf",
                builder.controlledCopyPdf("CC.SOP.0001", "CC.SOP.0001.001")
        );

        String evidencePath = builder.controlledCopyEvidence("CC.SOP.0001", "CC.SOP.0001.001", "destroy-photo.jpg");
        assertTrue(evidencePath.startsWith("controlled-copies/CC.SOP.0001/evidence/CC.SOP.0001.001/"));
        assertTrue(evidencePath.endsWith("_destroy-photo.jpg"));
    }

    @Test
    public void buildsTemplateTrainingAuditAndTempPaths() {
        assertEquals(
                "templates/document-content/SOP/TPL.SOP.0001/revisions/1.0.0/source/SOP_Template.docx",
                builder.documentContentTemplate("SOP", "TPL.SOP.0001", "1.0.0", "SOP_Template.docx")
        );
        assertEquals(
            "templates/publishing/SOP/cover/default-cover.docx",
            builder.publishingCoverTemplate("SOP", "default-cover.docx")
        );
        assertEquals(
                "templates/publishing/SOP/header/default-header.docx",
                builder.publishingHeaderTemplate("SOP", "default-header.docx")
        );
        assertEquals(
                "templates/publishing/SOP/footer/default-footer.docx",
                builder.publishingFooterTemplate("SOP", "default-footer.docx")
        );
        assertEquals(
                "training/SOP.0001/revisions/1.0.0/attendance/attendance.xlsx",
                builder.trainingFile("SOP.0001", "1.0.0", "attendance", "attendance.xlsx")
        );
        assertTrue(builder.auditEvidence("controlled-copies", "CC.SOP.0001.001", "approval-evidence.pdf").startsWith(
                "audit/controlled-copies/CC.SOP.0001.001/"
        ));
        assertTrue(builder.tempFile("sharepoint-edit", "REV-1", "working.docx").startsWith(
                "temp/sharepoint-edit/REV-1/"
        ));
    }

    @Test
    public void sanitizesSegmentsAndFileNamesSafely() {
        assertEquals("Operating_SOP_v1.docx", builder.sanitizeFileName(" Operating SOP v1.docx "));
        assertEquals("SOP.0001", builder.sanitizeSegment(" /SOP.0001/ "));
        assertEquals("CC.SOP.0001.001", builder.sanitizeSegment("../CC.SOP.0001.001"));
        assertEquals("file.bin", builder.sanitizeFileName("   "));
    }
}
