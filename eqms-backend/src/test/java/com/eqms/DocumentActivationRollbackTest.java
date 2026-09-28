package com.eqms;

import com.eqms.entity.*;
import com.eqms.repository.*;
import com.eqms.service.AuditTrailService;
import com.eqms.service.ClamAvScanService;
import com.eqms.service.FileStorageService;
import com.eqms.service.RevisionService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;

/**
 * TC-DOC-009 (docs/to-be-tests/01-document-lifecycle-test-spec.md): real-DB integration test.
 * Injects a controlled failure immediately after the DRAFT->ACTIVE mutation
 * (RevisionService.activateDocumentAfterInitialSourceStored) but before the surrounding
 * @Transactional method (createRevisionAndUploadFile) commits, by spying on the real
 * AuditTrailService bean and making ONLY the "ACTIVATE" audit call throw -- the smallest
 * test-only seam available, since that call is the last statement in the production method
 * before the mutation would otherwise become durable. No production business logic is altered.
 *
 * Does NOT assert anything about the already-written MinIO object (out of scope, per instructions
 * -- MinIO/WORM orphan handling remains a separate storage follow-up).
 */
@SpringBootTest
class DocumentActivationRollbackTest {

    @Autowired private RevisionService revisionService;
    @Autowired private DocumentRecordRepository documentRepository;
    @Autowired private DocumentRevisionRepository revisionRepository;
    @Autowired private DocumentStatusDefinitionRepository documentStatusRepository;
    @Autowired private DocumentTypeRepository documentTypeRepository;
    @Autowired private BusinessUnitRepository businessUnitRepository;
    @Autowired private DepartmentRepository departmentRepository;
    @Autowired private UserAccountRepository userAccountRepository;
    @Autowired private PlatformTransactionManager transactionManager;
    @Autowired private AuditLogRepository auditLogRepository;
    @Autowired private DocumentWorkflowParticipantRepository documentWorkflowParticipantRepository;

    @SpyBean private AuditTrailService auditTrailService;
    @SpyBean private ClamAvScanService clamAvScanService;
    @SpyBean private FileStorageService fileStorageService;

    private UUID documentId;
    private UserAccount actor;

    @BeforeEach
    void setUp() {
        DocumentType type = documentTypeRepository.findAll().stream().findFirst().orElseThrow();
        BusinessUnit businessUnit = businessUnitRepository.findAll().stream().findFirst().orElseThrow();
        Department department = departmentRepository.findAll().stream().findFirst().orElseThrow();
        // Excludes real, permission-less "unauthorizedActor" fixture rows left behind by
        // DocumentLifecycleBaselineTest (their audit-trail references cannot be reassigned/deleted
        // per GMP immutability), which would otherwise make this unordered pick unreliable.
        actor = userAccountRepository.findAll().stream()
                .filter(u -> "admin".equals(u.getUsername()))
                .findFirst().orElseThrow();
        DocumentStatusDefinition draft = documentStatusRepository.findById("DRAFT").orElseThrow();

        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        tx.executeWithoutResult(status -> {
            DocumentRecord document = new DocumentRecord();
            document.setDocumentNumber("ACTTEST." + UUID.randomUUID());
            document.setDocumentName("Activation Rollback Test Document");
            document.setVersion("0.0.1");
            document.setStatus(draft);
            document.setDocumentType(type);
            document.setBusinessUnit(businessUnit);
            document.setDepartment(department);
            document.setAuthor(actor);
            document.setOwner(actor);
            document.setTemplate(false);
            document.setHasRelatedDocuments(false);
            document.setHasCorrelatedDocuments(false);
            document.setRequiresTraining(false);
            documentRepository.save(document);
            documentId = document.getId();

            DocumentWorkflowParticipant approver = new DocumentWorkflowParticipant();
            approver.setDocument(document);
            approver.setParticipantType("APPROVER");
            approver.setUser(actor);
            approver.setSequenceOrder(1);
            documentWorkflowParticipantRepository.save(approver);

            DocumentWorkflowParticipant reviewer = new DocumentWorkflowParticipant();
            reviewer.setDocument(document);
            reviewer.setParticipantType("REVIEWER");
            reviewer.setUser(actor);
            reviewer.setSequenceOrder(1);
            documentWorkflowParticipantRepository.save(reviewer);
        });

        var principal = new com.eqms.auth.AuthenticatedUser(
                actor.getId(), UUID.randomUUID(), actor.getUsername(),
                actor.getRoleName() != null ? actor.getRoleName() : "USER", java.util.Collections.emptySet());
        var auth = new UsernamePasswordAuthenticationToken(principal, null, List.of());
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    @AfterEach
    void cleanup() {
        SecurityContextHolder.clearContext();
        DocumentStatusDefinition closedCancelled = documentStatusRepository.findById("CLOSED_CANCELLED").orElse(null);
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        tx.executeWithoutResult(status -> {
            revisionRepository.findAllByDocument_IdOrderByCreatedAtDesc(documentId)
                    .forEach(r -> { /* left as-is; DB trigger blocks physical delete, and any created
                                       revision should have rolled back anyway per the test itself */ });
            if (closedCancelled != null) {
                documentRepository.findById(documentId).ifPresent(d -> {
                    if (!"CLOSED_CANCELLED".equals(d.getStatus().getCode()) && documentRepository.findById(documentId)
                            .map(x -> !revisionRepository.existsByDocument_Id(documentId)).orElse(false)) {
                        d.setStatus(closedCancelled);
                        documentRepository.save(d);
                    }
                });
            }
        });
    }

    @Test
    void failureAfterActivateMutation_rollsBackDocumentStatusAndActivateAudit() throws Exception {
        long auditRowsBefore = auditLogRepository.count();

        org.mockito.Mockito.doReturn(ClamAvScanService.ScanResult.ofClean())
                .when(clamAvScanService).scan(any());

        // MinIO in this dev environment is only reachable via the docker-internal hostname
        // "minio" (per the persisted System Configuration storage settings), which does not
        // resolve from this host-run test JVM. MinIO connectivity is explicitly out of scope
        // for TC-DOC-009 (DB rollback of Document/Revision/audit state); stub the storage write
        // to avoid depending on it, computing a real SHA-256 so the validator's post-store
        // integrity check still passes.
        org.mockito.Mockito.doAnswer(invocation -> {
            try {
                byte[] content = invocation.getArgument(2, java.io.InputStream.class).readAllBytes();
                String checksum = java.util.HexFormat.of().formatHex(
                        java.security.MessageDigest.getInstance("SHA-256").digest(content));
                return new FileStorageService.StorageWriteResult(
                        null, "test-stub/" + UUID.randomUUID(), "MINIO", "test-bucket",
                        "test-object-key", "1", checksum);
            } catch (Exception ex) {
                throw new IllegalStateException(ex);
            }
        }).when(fileStorageService).storeRevisionSourceFile(any(), any(), any(), any(), any());

        doThrow(new RuntimeException("TC-DOC-009 injected failure: simulated post-mutation, pre-commit failure"))
                .when(auditTrailService)
                .logAs(any(), any(), any(), any(), eq("ACTIVATE"), any(), any(), any());

        MockMultipartFile file = new MockMultipartFile(
                "file", "test.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                buildMinimalValidDocx()
        );

        RuntimeException thrown = assertThrows(RuntimeException.class, () ->
                revisionService.createRevisionAndUploadFile(documentId, file, null));
        assertTrue(thrown.getMessage() != null && thrown.getMessage().contains("TC-DOC-009"),
                "The injected failure (not a validation failure) must be the one that aborted the transaction: " + thrown);

        DocumentRecord documentAfter = documentRepository.findById(documentId).orElseThrow();
        assertEquals("DRAFT", documentAfter.getStatus().getCode(),
                "Document must remain DRAFT -- the ACTIVE mutation must have rolled back");

        List<DocumentRevisionRecord> revisions = revisionRepository.findAllByDocument_IdOrderByCreatedAtDesc(documentId);
        assertTrue(revisions.isEmpty(), "No Revision row may persist from the failed upload attempt");

        assertEquals(auditRowsBefore, auditLogRepository.count(),
                "No ACTIVATE (or any other) audit row from the failed attempt may persist");
    }

    /** A minimal, structurally-valid OOXML .docx that passes RevisionUploadFileValidator's checks
     *  (ZIP signature, required entries, correct namespaces/content types) and is benign for the
     *  real ClamAV scan in this dev environment. */
    private static byte[] buildMinimalValidDocx() {
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
                zip.write(("""
                        <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                        <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body/></w:document>
                        """).getBytes(java.nio.charset.StandardCharsets.UTF_8));
                zip.closeEntry();
            }
            return buffer.toByteArray();
        } catch (java.io.IOException ex) {
            throw new IllegalStateException("Failed to build test fixture DOCX", ex);
        }
    }
}
