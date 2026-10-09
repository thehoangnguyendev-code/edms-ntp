package com.eqms.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The object-storage folder structure: every key belongs to one registered domain, goes to the right bucket class, and has
 * the same shape every time. These shapes are what a backup, a restore and a reconciliation rely on.
 */
class StorageLayoutTest {

    private static final UUID A = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID B = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private static final UUID C = UUID.fromString("33333333-3333-3333-3333-333333333333");
    private final StoragePathBuilder paths = new StoragePathBuilder();

    @Test
    void everyKeyBuiltByThePathBuilderBelongsToARegisteredDomain() {
        record Case(String key, StorageDomain domain) { }
        for (Case c : new Case[] {
                new Case(paths.revisionSourceV2(null, "SOP.0001", A, "a.docx"), StorageDomain.DOCUMENTS),
                new Case(paths.revisionReviewPdfV2(null, "SOP.0001", A), StorageDomain.DOCUMENTS),
                new Case(paths.revisionPublishedPdfV2(null, "SOP.0001", A), StorageDomain.DOCUMENTS),
                new Case(paths.controlledCopyPdfV2(null, "CCB.SOP.0001.B001", "CC.SOP.0001.001", A), StorageDomain.CONTROLLED_COPIES),
                new Case(paths.controlledCopyEvidenceV2(null, "CCB.SOP.0001.B001", "CC.SOP.0001.001", A, "e.pdf"), StorageDomain.CONTROLLED_COPIES),
                new Case(paths.controlledCopyRecallScan(A, B, "s.pdf"), StorageDomain.CONTROLLED_COPIES),
                new Case(paths.uncontrolledCopyPdf("UC-SOP.0001-001", A, "u.pdf"), StorageDomain.UNCONTROLLED_COPIES),
                new Case(paths.executedRecordFile(A, B, "r.pdf"), StorageDomain.FORMS),
                new Case(paths.personnelCertification(A, B, "c.pdf"), StorageDomain.PERSONNEL),
                new Case(StoragePathBuilder.reportArtifact("document_register", 2026, 10, A, B, "pdf"), StorageDomain.REPORTS),
                new Case(paths.publishingCoverTemplate("SOP", "cover.docx"), StorageDomain.TEMPLATES),
                new Case(paths.publishingComponentTemplateV2(null, A, 1, "header", "portrait", "h.docx"), StorageDomain.TEMPLATES),
        }) {
            assertEquals(c.domain(), StorageDomain.of(c.key()).orElseThrow(() -> new AssertionError("outside the domains: " + c.key())), c.key());
        }
    }

    @Test
    void keyShapesAreStable() {
        assertEquals("documents/SOP.0001/revisions/" + A + "/source/source.docx", paths.revisionSourceV2(null, "SOP.0001", A, "a.docx"));
        assertEquals("controlled-copies/recall-scans/" + A + "/" + B + "/s.pdf", paths.controlledCopyRecallScan(A, B, "s.pdf"));
        assertEquals("forms/executed-records/" + A + "/" + B + "/r.pdf", paths.executedRecordFile(A, B, "r.pdf"));
        assertEquals("personnel/certifications/" + A + "/" + B + "/c.pdf", paths.personnelCertification(A, B, "c.pdf"));
        assertEquals("uncontrolled-copies/UC-SOP.0001-001/" + A + "/u.pdf", paths.uncontrolledCopyPdf("UC-SOP.0001-001", A, "u.pdf"));
        assertEquals("reports/document_register/2026/09/" + A + "/" + B + ".pdf",
                StoragePathBuilder.reportArtifact("Document_Register", 2026, 9, A, B, "PDF"));
    }

    @Test
    void aPathSeparatorInAStoredFileNameCannotEscapeTheEntityFolder() {
        String key = paths.executedRecordFile(A, B, "../../personnel/evil.pdf");
        assertTrue(key.startsWith("forms/executed-records/" + A + "/" + B + "/"), key);
        assertFalse(key.contains(".."), key);
        assertEquals(StorageDomain.FORMS, StorageDomain.of(key).orElseThrow());
    }

    @Test
    void aKeyOutsideTheRegisteredDomainsIsRejected() {
        assertTrue(StorageDomain.of("verification/x/y.pdf").isEmpty());
        assertTrue(StorageDomain.of("temp/x/y.pdf").isEmpty(), "scratch files must never go to a locked bucket");
        assertTrue(StorageDomain.of("revisions/" + A + "/a.docx").isEmpty(), "the legacy prefix is read-only");
        assertTrue(StorageDomain.of("documents-old/a.pdf").isEmpty(), "a lookalike prefix is not the domain");
        assertTrue(StorageDomain.of("").isEmpty());
        assertTrue(StorageDomain.of(null).isEmpty());
    }

    @Test
    void aPrefixStoredInAnOldConfigurationCannotMoveNewFiles() {
        // An older configuration may still carry documentsPrefix; the key shapes must ignore it.
        ObjectNode config = new ObjectMapper().createObjectNode().put("documentsPrefix", "docs").put("controlledCopiesPrefix", "cc");
        assertTrue(paths.revisionSourceV2(config, "SOP.0001", A, "a.docx").startsWith("documents/"));
        assertTrue(paths.controlledCopyPdfV2(config, "CCB.1", "CC.1", A).startsWith("controlled-copies/"));
        assertTrue(StorageDomain.of("docs/SOP.0001/x.pdf").isEmpty(), "a renamed folder is not a registered domain");
    }

    @Test
    void domainsGoToTheirBucketClass() {
        for (StorageDomain d : StorageDomain.values()) {
            String expected = d == StorageDomain.TEMPLATES ? "eqms-templates" : "eqms-gmp-records";
            assertEquals(expected, MinioObjectStorageService.bucketFor("eqms-gmp-records", "eqms-templates", d), d.name());
        }
    }

    @Test
    void retentionIsCappedAtTheLongestPeriodObjectLockAccepts() {
        assertEquals(100, MinioObjectStorageService.MAX_RETENTION_YEARS);
        assertEquals(100, MinioObjectStorageService.clampRetentionYears(100));
        assertEquals(100, MinioObjectStorageService.clampRetentionYears(1000));
        assertEquals(1, MinioObjectStorageService.clampRetentionYears(0));
        assertEquals(5, MinioObjectStorageService.clampRetentionYears(5));
    }

    @Test
    void reportKeyNeedsItsIdentifiers() {
        assertThrows(IllegalArgumentException.class, () -> StoragePathBuilder.reportArtifact("", 2026, 10, A, B, "pdf"));
        assertThrows(IllegalArgumentException.class, () -> StoragePathBuilder.reportArtifact("x", 2026, 10, null, B, "pdf"));
        assertEquals("reports/x/2026/10/" + A + "/" + C + ".bin", StoragePathBuilder.reportArtifact("x", 2026, 10, A, C, ""));
    }
}
