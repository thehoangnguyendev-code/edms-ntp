package com.eqms;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.executedrecord.ApproveExecutedRecordRequest;
import com.eqms.dto.executedrecord.ExecutedRecordResponse;
import com.eqms.dto.executedrecord.RecordExecutionRequest;
import com.eqms.entity.ControlledCopyRecord;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.ExecutedRecord;
import com.eqms.entity.FormSettings;
import com.eqms.entity.RevisionStatusDefinition;
import com.eqms.entity.UserAccount;
import com.eqms.repository.ControlledCopyRepository;
import com.eqms.repository.DocumentRecordRepository;
import com.eqms.repository.DocumentRevisionRepository;
import com.eqms.repository.ExecutedRecordRepository;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.AuditTrailService;
import com.eqms.service.DocumentAuthorizationService;
import com.eqms.service.ElectronicSignatureService;
import com.eqms.service.ExecutedRecordService;
import com.eqms.service.FileStorageService;
import com.eqms.service.FormSettingsService;
import com.eqms.service.PermissionEvaluationService;
import com.eqms.service.SodConstraintService;
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
    @Mock private FormSettingsService formSettingsService;
    @Mock private DocumentRecordRepository documentRecordRepository;
    @Mock private DocumentRevisionRepository documentRevisionRepository;
    @Mock private ControlledCopyRepository controlledCopyRepository;
    @Mock private UserAccountRepository userAccountRepository;
    @Mock private CurrentUserService currentUserService;
    @Mock private PermissionEvaluationService permissionEvaluationService;
    @Mock private DocumentAuthorizationService documentAuthorizationService;
    @Mock private AuditTrailService auditTrailService;
    @Mock private ElectronicSignatureService electronicSignatureService;
    @Mock private FileStorageService fileStorageService;
    @Mock private SodConstraintService sodConstraintService;

    @InjectMocks
    private ExecutedRecordService service;

    private UserAccount filler;
    private UserAccount approverUser;
    private DocumentRecord formDocument;
    private DocumentRevisionRecord effectiveRevision;
    private ExecutedRecord pendingRecord;

    @BeforeEach
    void setUp() {
        filler = user("filler@example.com", "Filler");
        approverUser = user("approver@example.com", "Approver");

        formDocument = new DocumentRecord();
        formDocument.setId(UUID.randomUUID());
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
        pendingRecord.setCaptureMethod(ExecutedRecordService.CAPTURE_EFORM);
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
    // Self-approval guard (Segregation of Duties)
    // ---------------------------------------------------------------------------------------

    @Test
    void approve_byTheFillerThemselves_isRejected_whenSodConstraintIsActive() {
        actAs(filler, ExecutedRecordService.P_APPROVE);
        lenient().when(sodConstraintService.isActiveConstraint(
                ExecutedRecordService.P_FILL_EFORM, ExecutedRecordService.P_APPROVE)).thenReturn(true);

        AccessDeniedException ex = assertThrows(AccessDeniedException.class,
                () -> service.approve(pendingRecord.getId(), new ApproveExecutedRecordRequest("ok", "sig")));

        assertTrue(ex.getMessage().contains("Segregation of Duties"));
        assertEquals("PENDING_APPROVAL", pendingRecord.getStatus());
        verify(executedRecordRepository, never()).save(any());
        verifyNoInteractions(electronicSignatureService);
    }

    @Test
    void approve_byTheFillerThemselves_isAllowed_whenSodConstraintIsInactive() {
        actAs(filler, ExecutedRecordService.P_APPROVE);
        lenient().when(sodConstraintService.isActiveConstraint(
                ExecutedRecordService.P_FILL_EFORM, ExecutedRecordService.P_APPROVE)).thenReturn(false);

        ExecutedRecordResponse response = service.approve(pendingRecord.getId(), new ApproveExecutedRecordRequest("ok", "sig"));

        assertEquals("EXECUTED", response.status());
        assertEquals("EXECUTED", pendingRecord.getStatus());
        verify(executedRecordRepository).save(pendingRecord);
    }

    @Test
    void approve_byAnotherUser_approves_regardlessOfSodConfiguration() {
        actAs(approverUser, ExecutedRecordService.P_APPROVE);

        ExecutedRecordResponse response = service.approve(pendingRecord.getId(), new ApproveExecutedRecordRequest("ok", "sig"));

        assertEquals("EXECUTED", response.status());
        assertSame(approverUser, pendingRecord.getApprovedBy());
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
        FormSettings settings = new FormSettings();
        settings.setAllowPaper(true);
        when(formSettingsService.requireSettingsOrNull(formDocument.getId())).thenReturn(settings);

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
                () -> service.recordPhysicalCopy(formDocument.getId(), request, "scan.pdf", new ByteArrayInputStream(new byte[] {1})));

        assertTrue(ex.getMessage().contains("can no longer be recorded"));
        verifyNoInteractions(electronicSignatureService, fileStorageService);
    }

    // ---------------------------------------------------------------------------------------
    // Conflict with the Document/Revision lifecycle
    // ---------------------------------------------------------------------------------------

    @Test
    void submitEform_rejected_whenFormHasNoEffectiveRevision() {
        actAs(filler, ExecutedRecordService.P_FILL_EFORM);
        when(documentRecordRepository.findById(formDocument.getId())).thenReturn(Optional.of(formDocument));
        FormSettings settings = new FormSettings();
        settings.setAllowEform(true);
        when(formSettingsService.requireSettingsOrNull(formDocument.getId())).thenReturn(settings);
        when(documentRevisionRepository.findFirstByDocument_IdAndStatus_CodeOrderByCreatedAtDesc(formDocument.getId(), "EFFECTIVE"))
                .thenReturn(Optional.empty());

        RecordExecutionRequest request = new RecordExecutionRequest(null, null, null, "test reason", "sig");
        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> service.submitEform(formDocument.getId(), request, "form.pdf", new ByteArrayInputStream(new byte[] {1})));

        assertTrue(ex.getMessage().contains("no Effective revision"));
    }

    @Test
    void submitEform_rejected_whenEformNotEnabledOnThisForm() {
        actAs(filler, ExecutedRecordService.P_FILL_EFORM);
        when(documentRecordRepository.findById(formDocument.getId())).thenReturn(Optional.of(formDocument));
        FormSettings settings = new FormSettings();
        settings.setAllowEform(false);
        when(formSettingsService.requireSettingsOrNull(formDocument.getId())).thenReturn(settings);

        RecordExecutionRequest request = new RecordExecutionRequest(null, null, null, "test reason", "sig");
        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> service.submitEform(formDocument.getId(), request, "form.pdf", new ByteArrayInputStream(new byte[] {1})));

        assertTrue(ex.getMessage().contains("does not accept eForm"));
        verifyNoInteractions(electronicSignatureService, fileStorageService);
    }
}
