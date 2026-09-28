package com.eqms;

import com.eqms.dto.document.DocumentDraftCreateRequest;
import com.eqms.dto.document.LegacyBatchImportResponse;
import com.eqms.dto.document.LegacyBatchRevisionSectionRequest;
import com.eqms.entity.*;
import com.eqms.repository.*;
import com.eqms.service.ClamAvScanService;
import com.eqms.service.DocumentService;
import com.eqms.service.FileStorageService;
import com.eqms.service.RevisionService;
import com.eqms.service.SystemConfigurationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doReturn;

/**
 * Real-DB, real-service end-to-end evidence for Legacy Import
 * (RevisionService#createLegacyImportRevisionsBatch) -- the single method that now handles both a
 * document with just one historical revision (N=1) and a full multi-revision chain (N>1); there is
 * no separate single-revision method or endpoint any more (single revision = batch of one). Every
 * revision but the last is created OBSOLETED ("superseded by a newer legacy revision"); the last
 * reaches Effective. One signature token covers the whole batch. MinIO/ClamAV/Graph are stubbed.
 */
@SpringBootTest
class LegacyBatchImportFullFlowTest {

    @Autowired private DocumentService documentService;
    @Autowired private RevisionService revisionService;
    @Autowired private DocumentRecordRepository documentRepository;
    @Autowired private DocumentRevisionRepository revisionRepository;
    @Autowired private DocumentTypeRepository documentTypeRepository;
    @Autowired private SystemConfigurationService systemConfigurationService;
    @Autowired private BusinessUnitRepository businessUnitRepository;
    @Autowired private DepartmentRepository departmentRepository;
    @Autowired private UserAccountRepository userAccountRepository;
    @Autowired private ElectronicSignatureRepository electronicSignatureRepository;
    @Autowired private RevisionWorkflowHistoryRepository revisionWorkflowHistoryRepository;
    @Autowired private PlatformTransactionManager transactionManager;
    @Autowired private com.eqms.auth.TokenService tokenService;

    @SpyBean private ClamAvScanService clamAvScanService;
    @SpyBean private FileStorageService fileStorageService;
    @SpyBean private com.eqms.service.OnlyOfficeDocumentEditService onlyOfficeDocumentEditService;

    private DocumentType type;
    private BusinessUnit businessUnit;
    private Department department;
    /** Real "admin" fixture -- V463 backfills documents.legacy_import.batch to every Permission
     *  Set already holding documents.legacy_import.manage, which admin's Access Profile has. */
    private UserAccount batchImportActor;
    private UserAccount singleOnlyActor;

    private final java.util.Map<String, java.nio.file.Path> storedTempFilesByPath = new java.util.HashMap<>();

    @BeforeEach
    void setUp() {
        type = documentTypeRepository.findAll().stream().filter(DocumentType::isActive).findFirst().orElseThrow();
        businessUnit = businessUnitRepository.findAll().stream().filter(BusinessUnit::isActive).findFirst().orElseThrow();
        department = departmentRepository.findAll().stream().filter(Department::isActive).findFirst().orElseThrow();
        batchImportActor = userAccountRepository.findAll().stream()
                .filter(u -> "admin".equals(u.getUsername()))
                .findFirst().orElseThrow(() -> new IllegalStateException(
                        "Fixture 'admin' account not found -- required to hold documents.legacy_import.batch per V463"));

        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        singleOnlyActor = tx.execute(status -> {
            UserAccount u = new UserAccount();
            u.setUsername("legacy.batch.noperm." + UUID.randomUUID());
            u.setEmail(UUID.randomUUID() + "@example.test");
            u.setFullName("No Batch Permission Test User");
            u.setStatus(UserStatus.Active);
            u.setPasswordHash("$2a$10$Q7q0y6qz3nQ2QF6cGqk8n.T4mDx9J1Xb6mQpMwqzYh8kK1uT9y8gG");
            u.setRoleName("USER");
            return userAccountRepository.save(u);
        });

        stubClamAv();
        stubFileStorage();
        stubGraphConversion();

        runAsActor(batchImportActor);
    }

    private void runAsActor(UserAccount who) {
        var principal = new com.eqms.auth.AuthenticatedUser(
                who.getId(), UUID.randomUUID(), who.getUsername(),
                who.getRoleName() != null ? who.getRoleName() : "USER", java.util.Collections.emptySet());
        var auth = new UsernamePasswordAuthenticationToken(principal, null, List.of());
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    private void stubClamAv() {
        doReturn(ClamAvScanService.ScanResult.ofClean()).when(clamAvScanService).scan(any());
    }

    private void stubFileStorage() {
        try {
            org.mockito.Mockito.doAnswer(invocation -> {
                byte[] content = invocation.getArgument(2, java.io.InputStream.class).readAllBytes();
                String checksum = java.util.HexFormat.of().formatHex(
                        java.security.MessageDigest.getInstance("SHA-256").digest(content));
                java.nio.file.Path temp = java.nio.file.Files.createTempFile("legacy-batch-source-", ".docx");
                java.nio.file.Files.write(temp, content);
                String storedPath = "test-stub://" + temp;
                storedTempFilesByPath.put(storedPath, temp);
                return new FileStorageService.StorageWriteResult(
                        null, storedPath, "MINIO", "test-bucket", "test-object-key", "1", checksum);
            }).when(fileStorageService).storeRevisionSourceFile(any(), any(), any(), any(), any());

            org.mockito.Mockito.doAnswer(invocation -> {
                String storedPath = invocation.getArgument(0, String.class);
                java.nio.file.Path resolved = storedTempFilesByPath.get(storedPath);
                if (resolved != null) {
                    return resolved;
                }
                return invocation.callRealMethod();
            }).when(fileStorageService).materializeStoredFile(any());

            org.mockito.Mockito.doAnswer(invocation -> {
                java.io.InputStream in = invocation.getArgument(2, java.io.InputStream.class);
                byte[] content = in.readAllBytes();
                String checksum = java.util.HexFormat.of().formatHex(
                        java.security.MessageDigest.getInstance("SHA-256").digest(content));
                return new FileStorageService.StorageWriteResult(
                        null, "test-stub-published/" + UUID.randomUUID(), "MINIO", "test-bucket",
                        "test-object-key-pdf", "1", checksum);
            }).when(fileStorageService).storeRevisionPublishedPdf(any(), any(), any(), any(), any());
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
    }

    private void stubGraphConversion() {
        byte[] fakePdf = "%PDF-1.4 fake published pdf".getBytes(java.nio.charset.StandardCharsets.UTF_8);
        doReturn(fakePdf).when(onlyOfficeDocumentEditService).convertToPdf(any());
        doReturn(fakePdf).when(onlyOfficeDocumentEditService).convertLocalFileToPdf(any(), any());
    }

    private String uniqueLegacyDocumentNumber() {
        int digits = Math.max(systemConfigurationService.getSerialNumberDigits(), 1);
        String typeCode = StringUtils.hasText(type.getShortCode()) ? type.getShortCode().trim().toUpperCase() : "DOC";
        long max = (long) Math.pow(10, digits);
        for (int attempt = 0; attempt < 50; attempt++) {
            long serial = Math.floorMod(java.util.UUID.randomUUID().getMostSignificantBits() + attempt, max);
            String candidate = typeCode + "." + String.format("%0" + digits + "d", serial);
            if (documentService.isLegacyDocumentNumberAvailable(candidate)) {
                return candidate;
            }
        }
        throw new IllegalStateException("Could not find a free legacy document number after 50 attempts");
    }

    private MockMultipartFile buildMinimalValidDocx(String name) {
        try {
            java.io.ByteArrayOutputStream buffer = new java.io.ByteArrayOutputStream();
            try (java.util.zip.ZipOutputStream zip = new java.util.zip.ZipOutputStream(buffer)) {
                zip.putNextEntry(new java.util.zip.ZipEntry("[Content_Types].xml"));
                zip.write(("""
                        <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                        <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
                        <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
                        </Types>
                        """).getBytes(java.nio.charset.StandardCharsets.UTF_8));
                zip.closeEntry();
                zip.putNextEntry(new java.util.zip.ZipEntry("word/document.xml"));
                // Vary content slightly per fixture (name) so each generated file has a distinct checksum.
                zip.write(("""
                        <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                        <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><!-- %s --></w:body></w:document>
                        """.formatted(name)).getBytes(java.nio.charset.StandardCharsets.UTF_8));
                zip.closeEntry();
            }
            return new MockMultipartFile(
                    "file", name + ".docx",
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    buffer.toByteArray());
        } catch (java.io.IOException ex) {
            throw new IllegalStateException("Failed to build test fixture DOCX", ex);
        }
    }

    private UUID createLegacyDraft(String documentNumber, String name) {
        DocumentDraftCreateRequest request = new DocumentDraftCreateRequest(
                name, null, type.getId().toString(), batchImportActor.getId().toString(),
                businessUnit.getId().toString(), department.getId().toString(),
                null, null, null, null, "English", false, null, "Not applicable for legacy batch import", null, null,
                null, null, null, false, null, null, null, null, null,
                documentNumber, "22/09/2020 14:30", "Migrated from paper archive, box #9"
        );
        return UUID.fromString(documentService.createDocumentDraft(request).id());
    }

    private static final java.time.format.DateTimeFormatter TEST_DATE_FORMAT = java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy");

    /** Authored/Review/Approval dates derived from the given Effective Date (90/60/30 days
     *  before it) so every fixture stays chronologically valid regardless of which Effective Date
     *  a given call site passes -- RevisionService#createLegacyImportRevisionsBatch now enforces
     *  Authored &lt;= Review &lt;= Approval &lt;= Effective server-side (and no future dates), so a
     *  fixed set of dates shared across every call site (as this helper originally had) can't work
     *  once call sites span a wide range of Effective Dates. */
    private LegacyBatchRevisionSectionRequest section(String revisionNumber, String effectiveDate, boolean hasFile, String noFileJustification) {
        java.time.LocalDate effective = java.time.LocalDate.parse(effectiveDate, TEST_DATE_FORMAT);
        return new LegacyBatchRevisionSectionRequest(
                revisionNumber, batchImportActor.getId().toString(), effective.minusDays(90).format(TEST_DATE_FORMAT),
                "Jane Doe (Quality Assurance)", "Mary QM (Quality Management)",
                effective.minusDays(60).format(TEST_DATE_FORMAT), effective.minusDays(30).format(TEST_DATE_FORMAT),
                "Historical revision " + revisionNumber,
                effectiveDate, null, hasFile, noFileJustification
        );
    }

    @Test
    void batchImport_setsTrainingCompletionDate_onTheSameFieldTheOrdinaryTrainingWorkflowUses() {
        String documentNumber = uniqueLegacyDocumentNumber();
        UUID documentId = createLegacyDraft(documentNumber, "Legacy Historical Training Test");

        LegacyBatchRevisionSectionRequest withTraining = new LegacyBatchRevisionSectionRequest(
                "1.0.0", batchImportActor.getId().toString(), "17/09/2020",
                "Jane Doe (Quality Assurance)", "Mary QM (Quality Management)",
                "18/09/2020", "20/09/2020",
                "Historical revision 1.0.0",
                "22/09/2020", "21/09/2020", true, null
        );
        List<MultipartFile> files = List.of(buildMinimalValidDocx("training"));

        String signatureToken = tokenService.createSignatureToken(batchImportActor);
        revisionService.createLegacyImportRevisionsBatch(
                documentId, toJson(List.of(withTraining)), files, "Migrated from paper archive, box #9", signatureToken);

        DocumentRevisionRecord revision = revisionRepository.findAllByDocument_IdOrderByCreatedAtDesc(documentId).get(0);
        assertEquals(java.time.LocalDate.of(2020, 9, 21), revision.getTrainingCompletionDate());
    }

    @Test
    void batchImport_trainingCompletionDateAfterEffectiveDate_isRejected() {
        String documentNumber = uniqueLegacyDocumentNumber();
        UUID documentId = createLegacyDraft(documentNumber, "Legacy Training After Effective Date Test");

        LegacyBatchRevisionSectionRequest invalidTraining = new LegacyBatchRevisionSectionRequest(
                "1.0.0", batchImportActor.getId().toString(), "17/09/2020",
                "Jane Doe (Quality Assurance)", "Mary QM (Quality Management)",
                "18/09/2020", "20/09/2020",
                "Historical revision 1.0.0",
                "22/09/2020", "23/09/2020", true, null
        );
        List<MultipartFile> files = List.of(buildMinimalValidDocx("training-after"));

        String signatureToken = tokenService.createSignatureToken(batchImportActor);
        assertThrows(IllegalArgumentException.class, () -> revisionService.createLegacyImportRevisionsBatch(
                documentId, toJson(List.of(invalidTraining)), files, "test", signatureToken));
        assertTrue(revisionRepository.findAllByDocument_IdOrderByCreatedAtDesc(documentId).isEmpty(),
                "A rejected batch must not leave any partial Revision row behind");
    }

    @Test
    void singleRevisionImport_N1_reachesActiveEffective_withSignatureAndAudit() {
        String documentNumber = uniqueLegacyDocumentNumber();
        UUID documentId = createLegacyDraft(documentNumber, "Legacy Single Revision (N=1) SOP");

        List<LegacyBatchRevisionSectionRequest> sections = List.of(section("4.0.0", "22/09/2020", true, null));
        List<MultipartFile> files = List.of(buildMinimalValidDocx("only"));

        String signatureToken = tokenService.createSignatureToken(batchImportActor);
        LegacyBatchImportResponse response = revisionService.createLegacyImportRevisionsBatch(
                documentId, toJson(sections), files, "Migrated from paper archive, box #9", signatureToken);

        assertEquals(1, response.revisions().size());
        DocumentRevisionRecord revision = revisionRepository.findAllByDocument_IdOrderByCreatedAtDesc(documentId).get(0);
        assertEquals("4.0.0", revision.getRevisionNumber());
        assertEquals("EFFECTIVE", revision.getStatus().getCode());
        assertNull(revision.getParentRevision());
        assertTrue(revision.isSourceLocked());
        assertEquals("COMPLETED", revision.getEditingStatus());
        assertEquals(java.time.LocalDate.of(2020, 9, 22), revision.getEffectiveDate());

        DocumentRecord document = documentRepository.findById(documentId).orElseThrow();
        assertEquals("ACTIVE", document.getStatus().getCode());
        assertEquals("4.0.0", document.getVersion());

        List<ElectronicSignature> signatures = electronicSignatureRepository
                .findByEntityTypeIgnoreCaseAndEntityIdOrderBySignedAtAsc("DOCUMENT_REVISION", revision.getId());
        assertEquals(1, signatures.size());
        assertEquals(batchImportActor.getId(), signatures.get(0).getUser().getId());
    }

    @Test
    void fullBatchImport_threeRevisions_onlyLastEffective_restObsoletedWithSignaturesAndAudit() {
        String documentNumber = uniqueLegacyDocumentNumber();
        UUID documentId = createLegacyDraft(documentNumber, "Legacy Batch Full Flow SOP");

        List<LegacyBatchRevisionSectionRequest> sections = List.of(
                section("1.0.0", "01/01/2018", true, null),
                section("2.0.0", "01/01/2019", true, null),
                section("3.0.0", "01/01/2020", true, null)
        );
        List<MultipartFile> files = List.of(
                buildMinimalValidDocx("rev1"), buildMinimalValidDocx("rev2"), buildMinimalValidDocx("rev3")
        );

        String signatureToken = tokenService.createSignatureToken(batchImportActor);
        LegacyBatchImportResponse response = revisionService.createLegacyImportRevisionsBatch(
                documentId, toJson(sections), files, "Migrated from paper archive, box #9", signatureToken);

        assertEquals(3, response.revisions().size());

        // Traceability: legacyImportInfo must be populated on the response DTO for every revision
        // (previously write-only in the DB, invisible in the detail response -- fixed alongside
        // this batch feature).
        for (var revisionResponse : response.revisions()) {
            assertNotNull(revisionResponse.legacyImportInfo(),
                    "Revision " + revisionResponse.revisionNumber() + " must expose legacyImportInfo");
            assertEquals("Migrated from paper archive, box #9", revisionResponse.legacyImportInfo().legacyJustification());
            assertEquals("Jane Doe (Quality Assurance)", revisionResponse.legacyImportInfo().historicalReviewers());
            assertEquals("Mary QM (Quality Management)", revisionResponse.legacyImportInfo().historicalApprover());
        }

        List<DocumentRevisionRecord> revisions = revisionRepository.findAllByDocument_IdOrderByCreatedAtDesc(documentId);
        assertEquals(3, revisions.size());

        DocumentRevisionRecord rev1 = revisions.stream().filter(r -> "1.0.0".equals(r.getRevisionNumber())).findFirst().orElseThrow();
        DocumentRevisionRecord rev2 = revisions.stream().filter(r -> "2.0.0".equals(r.getRevisionNumber())).findFirst().orElseThrow();
        DocumentRevisionRecord rev3 = revisions.stream().filter(r -> "3.0.0".equals(r.getRevisionNumber())).findFirst().orElseThrow();

        assertEquals("OBSOLETED", rev1.getStatus().getCode());
        assertNotNull(rev1.getObsoletedBy());
        assertNotNull(rev1.getObsoletedAt());
        assertNull(rev1.getParentRevision());

        assertEquals("OBSOLETED", rev2.getStatus().getCode());
        assertNotNull(rev2.getParentRevision());
        assertEquals(rev1.getId(), rev2.getParentRevision().getId());

        assertEquals("EFFECTIVE", rev3.getStatus().getCode());
        assertEquals(rev2.getId(), rev3.getParentRevision().getId());
        assertTrue(rev3.isSourceLocked());
        assertEquals("COMPLETED", rev3.getEditingStatus());
        assertEquals(java.time.LocalDate.of(2020, 1, 1), rev3.getEffectiveDate());

        DocumentRecord document = documentRepository.findById(documentId).orElseThrow();
        assertEquals("ACTIVE", document.getStatus().getCode());
        assertEquals("3.0.0", document.getVersion());

        // One signature record per revision, same underlying token consumed once per transaction.
        List<ElectronicSignature> rev1Sigs = electronicSignatureRepository
                .findByEntityTypeIgnoreCaseAndEntityIdOrderBySignedAtAsc("DOCUMENT_REVISION", rev1.getId());
        List<ElectronicSignature> rev2Sigs = electronicSignatureRepository
                .findByEntityTypeIgnoreCaseAndEntityIdOrderBySignedAtAsc("DOCUMENT_REVISION", rev2.getId());
        List<ElectronicSignature> rev3Sigs = electronicSignatureRepository
                .findByEntityTypeIgnoreCaseAndEntityIdOrderBySignedAtAsc("DOCUMENT_REVISION", rev3.getId());
        assertEquals(1, rev1Sigs.size());
        assertEquals(1, rev2Sigs.size());
        assertEquals(1, rev3Sigs.size());
        assertEquals(batchImportActor.getId(), rev1Sigs.get(0).getUser().getId());

        // Obsolete history for rev1/rev2 uses the batch-specific action code.
        List<RevisionWorkflowHistory> rev1History = revisionWorkflowHistoryRepository.findAllByRevision_IdOrderByCreatedAtAsc(rev1.getId());
        assertTrue(rev1History.stream().anyMatch(h -> "LEGACY_BATCH_SUPERSEDED".equals(h.getActionType())));
        List<RevisionWorkflowHistory> rev3History = revisionWorkflowHistoryRepository.findAllByRevision_IdOrderByCreatedAtAsc(rev3.getId());
        assertTrue(rev3History.stream().anyMatch(h -> "LEGACY_IMPORT_EFFECTIVE".equals(h.getActionType())));
    }

    @Test
    void batchImport_requiresPermission_documentsLegacyImportBatch() {
        String documentNumber = uniqueLegacyDocumentNumber();
        UUID documentId = createLegacyDraft(documentNumber, "No Batch Permission Test");

        runAsActor(singleOnlyActor);
        List<LegacyBatchRevisionSectionRequest> sections = List.of(section("1.0.0", "01/01/2020", true, null));
        List<MultipartFile> files = List.of(buildMinimalValidDocx("rev1"));

        assertThrows(AccessDeniedException.class, () -> revisionService.createLegacyImportRevisionsBatch(
                documentId, toJson(sections), files, "test", tokenService.createSignatureToken(singleOnlyActor)));
    }

    @Test
    void batchImport_nonIncreasingRevisionNumbers_isRejected() {
        String documentNumber = uniqueLegacyDocumentNumber();
        UUID documentId = createLegacyDraft(documentNumber, "Non Increasing Test");

        List<LegacyBatchRevisionSectionRequest> sections = List.of(
                section("2.0.0", "01/01/2019", true, null),
                section("1.0.0", "01/01/2020", true, null)
        );
        List<MultipartFile> files = List.of(buildMinimalValidDocx("a"), buildMinimalValidDocx("b"));

        assertThrows(IllegalArgumentException.class, () -> revisionService.createLegacyImportRevisionsBatch(
                documentId, toJson(sections), files, "test", tokenService.createSignatureToken(batchImportActor)));
        assertTrue(revisionRepository.findAllByDocument_IdOrderByCreatedAtDesc(documentId).isEmpty(),
                "A rejected batch must not leave any partial Revision row behind");
    }

    @Test
    void batchImport_lastSectionWithoutFile_isRejected() {
        String documentNumber = uniqueLegacyDocumentNumber();
        UUID documentId = createLegacyDraft(documentNumber, "Last Section No File Test");

        List<LegacyBatchRevisionSectionRequest> sections = List.of(
                section("1.0.0", "01/01/2019", true, null),
                section("2.0.0", "01/01/2020", false, "Not required for this test")
        );
        List<MultipartFile> files = List.of(buildMinimalValidDocx("a"));

        assertThrows(IllegalArgumentException.class, () -> revisionService.createLegacyImportRevisionsBatch(
                documentId, toJson(sections), files, "test", tokenService.createSignatureToken(batchImportActor)));
    }

    @Test
    void batchImport_onDocumentThatAlreadyHasARevision_isRejected() {
        String documentNumber = uniqueLegacyDocumentNumber();
        UUID documentId = createLegacyDraft(documentNumber, "Already Has Revision Test");

        List<LegacyBatchRevisionSectionRequest> firstImport = List.of(section("1.0.0", "01/01/2019", true, null));
        revisionService.createLegacyImportRevisionsBatch(documentId, toJson(firstImport),
                List.of(buildMinimalValidDocx("existing")), "test", tokenService.createSignatureToken(batchImportActor));

        List<LegacyBatchRevisionSectionRequest> sections = List.of(section("2.0.0", "01/01/2020", true, null));
        List<MultipartFile> files = List.of(buildMinimalValidDocx("b"));

        assertThrows(IllegalStateException.class, () -> revisionService.createLegacyImportRevisionsBatch(
                documentId, toJson(sections), files, "test", tokenService.createSignatureToken(batchImportActor)));
    }

    private String toJson(List<LegacyBatchRevisionSectionRequest> sections) {
        try {
            return new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(sections);
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
    }
}
