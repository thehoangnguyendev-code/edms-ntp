package com.eqms;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.executedrecord.ExecutedRecordResponse;
import com.eqms.dto.executedrecord.RecordExecutionRequest;
import com.eqms.entity.ControlledCopyRecord;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.ExecutedRecord;
import com.eqms.entity.RevisionStatusDefinition;
import com.eqms.entity.UserAccount;
import com.eqms.repository.ControlledCopyRepository;
import com.eqms.repository.DocumentRecordRepository;
import com.eqms.repository.DocumentRevisionRepository;
import com.eqms.repository.ExecutedRecordRepository;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.AuditTrailService;
import com.eqms.service.ControlledCopyService;
import com.eqms.service.DocumentAuthorizationService;
import com.eqms.service.ElectronicSignatureService;
import com.eqms.service.ExecutedRecordService;
import com.eqms.service.FileStorageService;
import com.eqms.service.PermissionEvaluationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.io.ByteArrayInputStream;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Focused security/conflict rules for {@link ExecutedRecordService} -- see the approved plan's
 * checklist ("Security, conflicts, EU-GMP checklist"). Not full coverage of the service.
 */
@ExtendWith(MockitoExtension.class)
class ExecutedRecordServiceTest {

    @Mock private ExecutedRecordRepository executedRecordRepository;
    @Mock private DocumentRecordRepository documentRecordRepository;
    @Mock private DocumentRevisionRepository documentRevisionRepository;
    @Mock private ControlledCopyRepository controlledCopyRepository;
    @Mock private ControlledCopyService controlledCopyService;
    @Mock private UserAccountRepository userAccountRepository;
    @Mock private CurrentUserService currentUserService;
    @Mock private PermissionEvaluationService permissionEvaluationService;
    @Mock private DocumentAuthorizationService documentAuthorizationService;
    @Mock private AuditTrailService auditTrailService;
    @Mock private ElectronicSignatureService electronicSignatureService;
    @Mock private FileStorageService fileStorageService;
    @Mock private com.eqms.service.ControlledCopyPolicyService controlledCopyPolicyService;
    @Mock private com.eqms.service.ControlledCopyPdfMarkingService pdfMarkingService;

    private static final byte[] MARKED = "%PDF-1.7 marked".getBytes();

    @InjectMocks
    private ExecutedRecordService service;

    private UserAccount filler;
    private UserAccount approverUser;
    private DocumentRecord formDocument;
    private DocumentRevisionRecord effectiveRevision;
    private ExecutedRecord pendingRecord;

    @BeforeEach
    void setUp() {
        // ControlledCopyService is field-injected (circular dependency), so @InjectMocks does not set it.
        org.springframework.test.util.ReflectionTestUtils.setField(service, "controlledCopyService", controlledCopyService);
        org.springframework.test.util.ReflectionTestUtils.setField(service, "controlledCopyPolicyService", controlledCopyPolicyService);
        org.springframework.test.util.ReflectionTestUtils.setField(service, "pdfMarkingService", pdfMarkingService);
        var obsoleted = com.eqms.dto.controlledcopypolicy.ControlledCopyStatusMarking.defaults("OBSOLETED");
        lenient().when(controlledCopyPolicyService.statusMarkingFor(any(), eq("OBSOLETED"))).thenReturn(obsoleted);
        lenient().when(pdfMarkingService.statusLines(any(), any(), any()))
                .thenReturn(new com.eqms.service.ControlledCopyPdfMarkingService.StatusLines(java.util.List.of("RECALLED"), java.util.List.of("RECALLED")));
        lenient().when(pdfMarkingService.applyStatusMarking(any(), any(), any(), any(), any())).thenReturn(MARKED);
        filler = user("filler@example.com", "Filler");
        approverUser = user("approver@example.com", "Approver");

        formDocument = new DocumentRecord();
        formDocument.setId(UUID.randomUUID());
        var type = new com.eqms.entity.DocumentType();
        type.setShortCode("FORM");
        formDocument.setDocumentType(type);
        formDocument.setDocumentNumber("SOP.FRM.0001");

        RevisionStatusDefinition effectiveStatus = new RevisionStatusDefinition();
        effectiveStatus.setCode("EFFECTIVE");
        effectiveRevision = new DocumentRevisionRecord();
        effectiveRevision.setId(UUID.randomUUID());
        effectiveRevision.setRevisionNumber("1.0.0");
        effectiveRevision.setStatus(effectiveStatus);
        effectiveRevision.setDocument(formDocument);

        pendingRecord = new ExecutedRecord();
        pendingRecord.setId(UUID.randomUUID());
        pendingRecord.setRecordNumber("EXEC-SOP.FRM.0001-001");
        pendingRecord.setFormDocument(formDocument);
        pendingRecord.setFormRevision(effectiveRevision);
        pendingRecord.setCaptureMethod(ExecutedRecordService.CAPTURE_PAPER);
        pendingRecord.setStatus("PENDING_APPROVAL");
        pendingRecord.setFilledBy(filler);
        lenient().when(executedRecordRepository.findById(pendingRecord.getId())).thenReturn(Optional.of(pendingRecord));
        lenient().when(executedRecordRepository.save(any(ExecutedRecord.class))).thenAnswer(inv -> inv.getArgument(0));

        var signature = new com.eqms.entity.ElectronicSignature();
        signature.setId(UUID.randomUUID());
        lenient().when(electronicSignatureService.createEntitySignature(
                anyString(), any(), any(), any(), any(), anyString(), any(), any(), any(), any())).thenReturn(signature);
    }

    private static UserAccount user(String email, String name) {
        UserAccount account = new UserAccount();
        account.setId(UUID.randomUUID());
        account.setEmail(email);
        account.setFullName(name);
        return account;
    }

    private void actAs(UserAccount actor, String... permissions) {
        when(currentUserService.requireCurrentUser()).thenReturn(actor);
        for (String permission : permissions) {
            lenient().when(permissionEvaluationService.hasPermission(actor, permission)).thenReturn(true);
        }
    }

    // ---------------------------------------------------------------------------------------
    // Conflict with the Controlled Copy lifecycle (paper path)
    // ---------------------------------------------------------------------------------------

    @Test
    void recordPhysicalCopy_rejected_whenControlledCopyAlreadyRecalled() throws Exception {
        actAs(filler, ExecutedRecordService.P_RECORD_PAPER);
        when(documentRecordRepository.findById(formDocument.getId())).thenReturn(Optional.of(formDocument));
        when(documentRevisionRepository.findFirstByDocument_IdAndStatus_CodeOrderByCreatedAtDesc(formDocument.getId(), "EFFECTIVE"))
                .thenReturn(Optional.of(effectiveRevision));

        ControlledCopyRecord recalledCopy = new ControlledCopyRecord();
        UUID copyId = UUID.randomUUID();
        recalledCopy.setId(copyId);
        recalledCopy.setDocument(formDocument);
        recalledCopy.setStatusCode("RECALLED");
        recalledCopy.setStatus("Recalled");
        recalledCopy.setControlledCopyNumber("CC-SOP.FRM.0001-001");
        when(controlledCopyRepository.findById(copyId)).thenReturn(Optional.of(recalledCopy));

        RecordExecutionRequest request = new RecordExecutionRequest(copyId.toString(), filler.getId().toString(), null, "test reason", "sig");
        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> service.recordPhysicalCopyAndClose(copyId, request, "scan.pdf", new ByteArrayInputStream(new byte[] {1})));

        assertTrue(ex.getMessage().contains("can no longer be recorded"));
        verifyNoInteractions(electronicSignatureService, fileStorageService);
    }

    // ---------------------------------------------------------------------------------------
    // Conflict with the Document/Revision lifecycle
    // ---------------------------------------------------------------------------------------

    @Test
    void recordPhysicalCopy_rejected_whenFormHasNoEffectiveRevision() {
        actAs(filler, ExecutedRecordService.P_RECORD_PAPER);
        when(documentRecordRepository.findById(formDocument.getId())).thenReturn(Optional.of(formDocument));
        when(documentRevisionRepository.findFirstByDocument_IdAndStatus_CodeOrderByCreatedAtDesc(formDocument.getId(), "EFFECTIVE"))
                .thenReturn(Optional.empty());

        ControlledCopyRecord copy = new ControlledCopyRecord();
        copy.setId(UUID.randomUUID());
        copy.setDocument(formDocument);
        copy.setStatusCode("DISTRIBUTED");
        when(controlledCopyRepository.findById(copy.getId())).thenReturn(Optional.of(copy));

        RecordExecutionRequest request = new RecordExecutionRequest(null, null, null, "test reason", "sig");
        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> service.recordPhysicalCopyAndClose(copy.getId(), request, "form.pdf", new ByteArrayInputStream(new byte[] {1})));

        assertTrue(ex.getMessage().contains("no Effective revision"));
    }

    @Test
    void paperCaptureWorksWithoutFormSettingsAndStillSignsAndAudits() throws Exception {
        actAs(filler, ExecutedRecordService.P_RECORD_PAPER);
        when(documentRecordRepository.findById(formDocument.getId())).thenReturn(Optional.of(formDocument));
        when(documentRevisionRepository.findFirstByDocument_IdAndStatus_CodeOrderByCreatedAtDesc(formDocument.getId(), "EFFECTIVE"))
                .thenReturn(Optional.of(effectiveRevision));
        var copy = new ControlledCopyRecord();
        copy.setId(UUID.randomUUID());
        copy.setDocument(formDocument);
        copy.setStatusCode("DISTRIBUTED");
        when(controlledCopyRepository.findById(copy.getId())).thenReturn(Optional.of(copy));
        when(userAccountRepository.findById(filler.getId())).thenReturn(Optional.of(filler));
        when(fileStorageService.storeExecutedRecordFile(eq(formDocument.getId()), any(), eq("scan.pdf"), any()))
                .thenReturn(new FileStorageService.StorageWriteResult(null, "scan-key", "local", null, "scan-key", null, "scan-checksum"));
        var request = new RecordExecutionRequest(copy.getId().toString(), filler.getId().toString(), "2026-10-03", "scan", "sig");
        var response = service.recordPhysicalCopyAndClose(copy.getId(), request, "scan.pdf", new ByteArrayInputStream(new byte[]{1}));
        assertEquals("EXECUTED", response.status());
        assertEquals("PAPER_SCAN", response.captureMethod());
        // The returned copy is closed as a consequence of the record, without a second signature.
        verify(controlledCopyService).closeAfterExecutedRecord(eq(copy.getId()), eq(filler), anyString());
        verify(electronicSignatureService).createEntitySignature(eq("EXECUTED_RECORD"), any(), any(), eq(filler),
                eq("sig"), eq("RECORD_LOGGED"), eq("scan"), isNull(), isNull(), eq("EXECUTED"));
        verify(auditTrailService).logAs(eq(filler), eq("EXECUTED_RECORD"), any(), any(), eq("SUBMIT"),
                isNull(), eq("EXECUTED"), any(), anyList(), any());
    }

    // ---------------------------------------------------------------------------------------
    // Recall by scan: a returned copy's scan is a record for ANY document type, and follows the copy's visibility
    // ---------------------------------------------------------------------------------------

    private static final byte[] PDF_BYTES = "%PDF-1.7\n%scan".getBytes();

    private ControlledCopyRecord sopCopy(UserAccount recipient) {
        DocumentRecord sop = new DocumentRecord();
        sop.setId(UUID.randomUUID());
        sop.setDocumentNumber("SOP.QA.0007");
        var type = new com.eqms.entity.DocumentType();
        type.setShortCode("SOP");
        sop.setDocumentType(type);
        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setId(UUID.randomUUID());
        revision.setRevisionNumber("2.0.0");
        revision.setDocument(sop);
        ControlledCopyRecord copy = new ControlledCopyRecord();
        copy.setId(UUID.randomUUID());
        copy.setControlledCopyNumber("CC-SOP-001");
        copy.setDocument(sop);
        copy.setRevision(revision);
        copy.setRecipientUser(recipient);
        return copy;
    }

    private ExecutedRecord scanRecord(ControlledCopyRecord copy) {
        ExecutedRecord record = new ExecutedRecord();
        record.setId(UUID.randomUUID());
        record.setRecordNumber("EXEC-SOP.QA.0007-001");
        record.setFormDocument(copy.getDocument());
        record.setFormRevision(copy.getRevision());
        record.setCaptureMethod(ExecutedRecordService.CAPTURE_PAPER);
        record.setStatus("EXECUTED");
        record.setSourceControlledCopy(copy);
        record.setStorageObjectKey("stored://scan.pdf");
        record.setFileName("scan.pdf");
        return record;
    }

    @Test
    void recordRecalledCopyScan_filesTheScanForADocumentThatIsNotAForm() {
        ControlledCopyRecord copy = sopCopy(filler);
        com.eqms.entity.ControlledCopyRecallItem item = new com.eqms.entity.ControlledCopyRecallItem();
        item.setFileName("scan.pdf");
        item.setContentType("application/pdf");
        item.setFileSize(PDF_BYTES.length);
        item.setSha256("abc123");
        item.setStoredPath("stored://scan.pdf");
        item.setStorageProvider("minio");
        item.setStorageBucket("bucket");
        item.setStorageVersionId("v1");
        UUID signatureId = UUID.randomUUID();
        UUID batchId = UUID.randomUUID();
        java.time.Instant received = java.time.Instant.now().minusSeconds(7200);

        ExecutedRecord record = service.recordRecalledCopyScan(copy, item, approverUser, received, batchId, "RCB-2026-00009", signatureId);

        assertEquals("PAPER_SCAN", record.getCaptureMethod());
        assertEquals("EXECUTED", record.getStatus());
        assertEquals("EXEC-SOP.QA.0007-001", record.getRecordNumber());
        assertEquals(copy.getDocument(), record.getFormDocument());
        assertEquals(copy.getRevision(), record.getFormRevision());
        assertEquals(filler, record.getFilledBy());
        assertEquals(received, record.getFilledAt());
        assertEquals(copy, record.getSourceControlledCopy());
        assertEquals("stored://scan.pdf", record.getStorageObjectKey());
        assertEquals("abc123", record.getChecksum());
        assertEquals("scan.pdf", record.getFileName());
        assertEquals("application/pdf", record.getContentType());
        assertEquals(batchId, record.getRecallBatchId());
        assertEquals(signatureId, record.getSubmitSignatureId());
        // The batch's one signature is reused: no second token is consumed for the record.
        verifyNoInteractions(electronicSignatureService);
        verify(auditTrailService).logAs(eq(approverUser), eq("EXECUTED_RECORD"), eq("EXEC-SOP.QA.0007-001"), any(), eq("SUBMIT"),
                isNull(), eq("EXECUTED"), org.mockito.ArgumentMatchers.contains("RCB-2026-00009"), anyList(), eq(signatureId));
    }

    @Test
    void recordRecalledCopyScan_fallsBackToTheRecallingUserWhenTheCopyHasNoRecipientAccount() {
        ControlledCopyRecord copy = sopCopy(null);
        com.eqms.entity.ControlledCopyRecallItem item = new com.eqms.entity.ControlledCopyRecallItem();
        item.setFileName("scan.pdf");
        item.setStoredPath("stored://scan.pdf");

        ExecutedRecord record = service.recordRecalledCopyScan(copy, item, approverUser, java.time.Instant.now(),
                UUID.randomUUID(), "RCB-1", UUID.randomUUID());

        assertEquals(approverUser, record.getFilledBy());
    }

    @Test
    void previewFile_showsTheScanInlineToABlanketCopyViewer() throws Exception {
        ControlledCopyRecord copy = sopCopy(filler);
        ExecutedRecord record = scanRecord(copy);
        when(executedRecordRepository.findById(record.getId())).thenReturn(Optional.of(record));
        when(fileStorageService.readFile("stored://scan.pdf")).thenReturn(PDF_BYTES);
        actAs(approverUser, ExecutedRecordService.P_VIEW);
        when(documentAuthorizationService.canViewAllControlledCopies(approverUser)).thenReturn(true);

        ExecutedRecordService.RecordFile file = service.previewFile(record.getId());

        assertEquals("application/pdf", file.contentType());
        assertEquals("scan.pdf", file.fileName());
        // Shown with the Obsoleted marking drawn on a copy; the stored bytes are what was marked.
        assertEquals(MARKED.length, file.bytes().length);
        verify(pdfMarkingService).applyStatusMarking(eq(PDF_BYTES), any(), any(), any(), any());
    }

    @Test
    void previewFile_showsTheScanToTheNamedRecipientOfTheCopy() throws Exception {
        ControlledCopyRecord copy = sopCopy(filler);
        ExecutedRecord record = scanRecord(copy);
        when(executedRecordRepository.findById(record.getId())).thenReturn(Optional.of(record));
        when(fileStorageService.readFile("stored://scan.pdf")).thenReturn(PDF_BYTES);
        actAs(filler, ExecutedRecordService.P_VIEW);

        assertEquals("application/pdf", service.previewFile(record.getId()).contentType());
    }

    @Test
    void previewFile_isDeniedToAnyoneElseEvenWithTheViewPermission() throws Exception {
        ControlledCopyRecord copy = sopCopy(filler);
        ExecutedRecord record = scanRecord(copy);
        when(executedRecordRepository.findById(record.getId())).thenReturn(Optional.of(record));
        actAs(approverUser, ExecutedRecordService.P_VIEW);
        when(documentAuthorizationService.canViewAllControlledCopies(approverUser)).thenReturn(false);

        assertThrows(AccessDeniedException.class, () -> service.previewFile(record.getId()));
        assertThrows(AccessDeniedException.class, () -> service.getDetail(record.getId()));
        verifyNoInteractions(fileStorageService);
    }

    @Test
    void previewFile_needsTheViewPermission() {
        ControlledCopyRecord copy = sopCopy(filler);
        ExecutedRecord record = scanRecord(copy);
        actAs(filler);

        assertThrows(AccessDeniedException.class, () -> service.previewFile(record.getId()));
        verifyNoInteractions(fileStorageService);
    }

    @Test
    void previewFile_neverLetsABrowserRenderBytesThatAreNotPdfOrImages() throws Exception {
        ControlledCopyRecord copy = sopCopy(filler);
        ExecutedRecord record = scanRecord(copy);
        when(executedRecordRepository.findById(record.getId())).thenReturn(Optional.of(record));
        when(fileStorageService.readFile("stored://scan.pdf")).thenReturn("<html><script>alert(1)</script></html>".getBytes());
        actAs(filler, ExecutedRecordService.P_VIEW);

        // Not a PDF or an image: it cannot be marked, so it is never served (fail closed).
        assertThrows(IllegalStateException.class, () -> service.previewFile(record.getId()));
    }

    @Test
    void downloadFile_followsTheSameCopyVisibility() {
        ControlledCopyRecord copy = sopCopy(filler);
        ExecutedRecord record = scanRecord(copy);
        when(executedRecordRepository.findById(record.getId())).thenReturn(Optional.of(record));
        actAs(approverUser, ExecutedRecordService.P_VIEW, ExecutedRecordService.P_DOWNLOAD);
        when(documentAuthorizationService.canViewAllControlledCopies(approverUser)).thenReturn(false);

        assertThrows(AccessDeniedException.class, () -> service.downloadFile(record.getId()));
        verifyNoInteractions(fileStorageService);
    }
}
