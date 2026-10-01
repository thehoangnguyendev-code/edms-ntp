package com.eqms;

import com.eqms.auth.CurrentUserService;
import com.eqms.entity.ControlledCopyRecord;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.EformEditSession;
import com.eqms.entity.EformFillRun;
import com.eqms.entity.EformSignerAssignment;
import com.eqms.entity.FormSettings;
import com.eqms.entity.UserAccount;
import com.eqms.repository.ControlledCopyRepository;
import com.eqms.repository.DocumentRecordRepository;
import com.eqms.repository.DocumentRevisionRepository;
import com.eqms.repository.EformEditSessionRepository;
import com.eqms.repository.EformFillRunRepository;
import com.eqms.repository.EformSignerAssignmentRepository;
import com.eqms.service.AuditTrailService;
import com.eqms.service.DocumentAuthorizationService;
import com.eqms.service.EformEditSessionService;
import com.eqms.service.ElectronicSignatureService;
import com.eqms.service.ExecutedRecordService;
import com.eqms.service.FileStorageService;
import com.eqms.service.FormSettingsService;
import com.eqms.service.NotificationDispatcher;
import com.eqms.service.ControlledCopyService;
import com.eqms.service.SystemActorProvider;
import com.eqms.service.OnlyOfficeDocumentEditService;
import com.eqms.service.PermissionEvaluationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Focused ownership/lifecycle guards for {@link EformEditSessionService} (Phase 2b: per-electronic-
 * distribution sequential signer assignment). Not full coverage of the service.
 */
@ExtendWith(MockitoExtension.class)
class EformEditSessionServiceTest {

    @Mock private EformEditSessionRepository sessionRepository;
    @Mock private EformFillRunRepository fillRunRepository;
    @Mock private EformSignerAssignmentRepository signerAssignmentRepository;
    @Mock private ControlledCopyRepository controlledCopyRepository;
    @Mock private DocumentRecordRepository documentRecordRepository;
    @Mock private DocumentRevisionRepository documentRevisionRepository;
    @Mock private FormSettingsService formSettingsService;
    @Mock private CurrentUserService currentUserService;
    @Mock private PermissionEvaluationService permissionEvaluationService;
    @Mock private DocumentAuthorizationService documentAuthorizationService;
    @Mock private AuditTrailService auditTrailService;
    @Mock private ElectronicSignatureService electronicSignatureService;
    @Mock private FileStorageService fileStorageService;
    @Mock private OnlyOfficeDocumentEditService onlyOfficeDocumentEditService;
    @Mock private ExecutedRecordService executedRecordService;
    @Mock private NotificationDispatcher notificationDispatcher;
    @Mock private ControlledCopyService controlledCopyService;
    @Mock private SystemActorProvider systemActorProvider;

    @InjectMocks
    private EformEditSessionService service;

    private UserAccount starter;
    private UserAccount otherUser;
    private EformEditSession session;

    @BeforeEach
    void setUp() {
        starter = user("starter@example.com", "Starter");
        otherUser = user("other@example.com", "Other");

        DocumentRecord document = new DocumentRecord();
        document.setId(UUID.randomUUID());
        document.setDocumentNumber("SOP.FRM.0001");

        session = new EformEditSession();
        session.setId(UUID.randomUUID());
        session.setKind("FILL");
        session.setFormDocument(document);
        session.setStartedBy(starter);
        session.setStatus("ACTIVE");
        lenient().when(sessionRepository.findById(session.getId())).thenReturn(Optional.of(session));
    }

    private static UserAccount user(String email, String name) {
        UserAccount account = new UserAccount();
        account.setId(UUID.randomUUID());
        account.setEmail(email);
        account.setFullName(name);
        return account;
    }

    private ControlledCopyRecord electronicCopy(DocumentRecord document, UserAccount recipient) {
        ControlledCopyRecord copy = new ControlledCopyRecord();
        copy.setId(UUID.randomUUID());
        copy.setDocument(document);
        copy.setDeliveryMode("ELECTRONIC");
        copy.setRecipientUser(recipient);
        return copy;
    }

    @Test
    void getEditConfig_byAnotherUser_isRejected_whenTheyLackTheAdminOverride() {
        when(currentUserService.requireCurrentUser()).thenReturn(otherUser);
        lenient().when(permissionEvaluationService.hasPermission(otherUser, "settings.configuration.manage")).thenReturn(false);

        AccessDeniedException ex = assertThrows(AccessDeniedException.class, () -> service.getEditConfig(session.getId()));

        assertTrue(ex.getMessage().contains("did not start"));
        verifyNoInteractions(onlyOfficeDocumentEditService);
    }

    @Test
    void getEditConfig_byAnotherUser_isAllowed_withTheAdminOverride() {
        when(currentUserService.requireCurrentUser()).thenReturn(otherUser);
        when(permissionEvaluationService.hasPermission(otherUser, "settings.configuration.manage")).thenReturn(true);
        when(onlyOfficeDocumentEditService.buildFormSessionConfig(any(), anyInt(), anyString(), anyString(), any(), eq(otherUser)))
                .thenReturn(new com.fasterxml.jackson.databind.ObjectMapper().createObjectNode());

        assertDoesNotThrow(() -> service.getEditConfig(session.getId()));
    }

    @Test
    void getEditConfig_byTheStarter_isAllowed() {
        when(currentUserService.requireCurrentUser()).thenReturn(starter);
        when(onlyOfficeDocumentEditService.buildFormSessionConfig(any(), anyInt(), anyString(), anyString(), any(), eq(starter)))
                .thenReturn(new com.fasterxml.jackson.databind.ObjectMapper().createObjectNode());

        assertDoesNotThrow(() -> service.getEditConfig(session.getId()));
    }

    @Test
    void startFillSession_rejected_whenNoFillableTemplateExistsYet() {
        when(currentUserService.requireCurrentUser()).thenReturn(starter);
        DocumentRecord document = new DocumentRecord();
        document.setId(UUID.randomUUID());
        ControlledCopyRecord copy = electronicCopy(document, starter);
        when(controlledCopyRepository.findById(copy.getId())).thenReturn(Optional.of(copy));
        FormSettings settings = new FormSettings();
        settings.setAllowEform(true);
        when(formSettingsService.requireSettingsOrNull(document.getId())).thenReturn(settings);
        // Effective revision exists but has no fillable template object key set.
        when(documentRevisionRepository.findFirstByDocument_IdAndStatus_CodeOrderByCreatedAtDesc(document.getId(), "EFFECTIVE"))
                .thenReturn(Optional.of(new com.eqms.entity.DocumentRevisionRecord()));

        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> service.startFillSession(copy.getId(), null));

        assertTrue(ex.getMessage().contains("design this Form's fields first"));
        verify(sessionRepository, never()).save(any());
    }

    @Test
    void startFillSession_fillPhase_rejected_whenCurrentUserIsNotTheRecipient() {
        when(currentUserService.requireCurrentUser()).thenReturn(otherUser);
        DocumentRecord document = new DocumentRecord();
        document.setId(UUID.randomUUID());
        ControlledCopyRecord copy = electronicCopy(document, starter); // recipient is starter, not otherUser
        when(controlledCopyRepository.findById(copy.getId())).thenReturn(Optional.of(copy));
        FormSettings settings = new FormSettings();
        settings.setAllowEform(true);
        when(formSettingsService.requireSettingsOrNull(document.getId())).thenReturn(settings);
        com.eqms.entity.DocumentRevisionRecord effective = new com.eqms.entity.DocumentRevisionRecord();
        effective.setFillableTemplateStorageObjectKey("forms/eform-sessions/x/y.docxf");
        when(documentRevisionRepository.findFirstByDocument_IdAndStatus_CodeOrderByCreatedAtDesc(document.getId(), "EFFECTIVE"))
                .thenReturn(Optional.of(effective));
        when(signerAssignmentRepository.findAllByControlledCopy_IdOrderBySequenceAsc(copy.getId())).thenReturn(List.of());

        AccessDeniedException ex = assertThrows(AccessDeniedException.class,
                () -> service.startFillSession(copy.getId(), null));

        assertTrue(ex.getMessage().contains("recipient"));
        verify(sessionRepository, never()).save(any());
    }

    @Test
    void startFillSession_signerStep_rejected_whenCurrentUserIsNotTheAssignedSigner() {
        when(currentUserService.requireCurrentUser()).thenReturn(otherUser);
        lenient().when(permissionEvaluationService.hasPermission(otherUser, "settings.configuration.manage")).thenReturn(false);
        DocumentRecord document = new DocumentRecord();
        document.setId(UUID.randomUUID());
        ControlledCopyRecord copy = electronicCopy(document, starter);
        when(controlledCopyRepository.findById(copy.getId())).thenReturn(Optional.of(copy));
        FormSettings settings = new FormSettings();
        settings.setAllowEform(true);
        when(formSettingsService.requireSettingsOrNull(document.getId())).thenReturn(settings);
        com.eqms.entity.DocumentRevisionRecord effective = new com.eqms.entity.DocumentRevisionRecord();
        effective.setFillableTemplateStorageObjectKey("forms/eform-sessions/x/y.docxf");
        when(documentRevisionRepository.findFirstByDocument_IdAndStatus_CodeOrderByCreatedAtDesc(document.getId(), "EFFECTIVE"))
                .thenReturn(Optional.of(effective));

        EformSignerAssignment assignment = new EformSignerAssignment();
        assignment.setAssignedUser(starter); // not otherUser
        assignment.setRoleName("Quality_Manager");
        assignment.setSequence(1);
        when(signerAssignmentRepository.findAllByControlledCopy_IdOrderBySequenceAsc(copy.getId())).thenReturn(List.of(assignment));

        EformFillRun run = new EformFillRun();
        run.setId(UUID.randomUUID());
        run.setCurrentSequence(1);
        when(fillRunRepository.findByControlledCopy_IdAndStatus(copy.getId(), "IN_PROGRESS")).thenReturn(Optional.of(run));

        AccessDeniedException ex = assertThrows(AccessDeniedException.class,
                () -> service.startFillSession(copy.getId(), "Quality_Manager"));

        assertTrue(ex.getMessage().contains("not the assigned signer"));
        verify(sessionRepository, never()).save(any());
    }

    @Test
    void startFillSession_signerStep_rejected_whenNotThisRolesTurnYet() {
        when(currentUserService.requireCurrentUser()).thenReturn(otherUser);
        DocumentRecord document = new DocumentRecord();
        document.setId(UUID.randomUUID());
        ControlledCopyRecord copy = electronicCopy(document, starter);
        when(controlledCopyRepository.findById(copy.getId())).thenReturn(Optional.of(copy));
        FormSettings settings = new FormSettings();
        settings.setAllowEform(true);
        when(formSettingsService.requireSettingsOrNull(document.getId())).thenReturn(settings);
        com.eqms.entity.DocumentRevisionRecord effective = new com.eqms.entity.DocumentRevisionRecord();
        effective.setFillableTemplateStorageObjectKey("forms/eform-sessions/x/y.docxf");
        when(documentRevisionRepository.findFirstByDocument_IdAndStatus_CodeOrderByCreatedAtDesc(document.getId(), "EFFECTIVE"))
                .thenReturn(Optional.of(effective));

        EformSignerAssignment step1 = new EformSignerAssignment();
        step1.setAssignedUser(starter);
        step1.setRoleName("Nguoi_lap");
        step1.setSequence(1);
        EformSignerAssignment step2 = new EformSignerAssignment();
        step2.setAssignedUser(otherUser);
        step2.setRoleName("Quality_Manager");
        step2.setSequence(2);
        when(signerAssignmentRepository.findAllByControlledCopy_IdOrderBySequenceAsc(copy.getId())).thenReturn(List.of(step1, step2));

        // Run is still waiting on step 1 (Nguoi_lap); otherUser is the rightful assignee of step 2
        // but tries to jump ahead.
        EformFillRun run = new EformFillRun();
        run.setId(UUID.randomUUID());
        run.setCurrentSequence(1);
        when(fillRunRepository.findByControlledCopy_IdAndStatus(copy.getId(), "IN_PROGRESS")).thenReturn(Optional.of(run));

        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> service.startFillSession(copy.getId(), "Quality_Manager"));

        assertTrue(ex.getMessage().contains("not role"));
        verify(sessionRepository, never()).save(any());
    }

    @Test
    void startFillSession_signerStep_rejected_whenFillPhaseNotDoneYet() {
        when(currentUserService.requireCurrentUser()).thenReturn(starter);
        DocumentRecord document = new DocumentRecord();
        document.setId(UUID.randomUUID());
        ControlledCopyRecord copy = electronicCopy(document, starter);
        when(controlledCopyRepository.findById(copy.getId())).thenReturn(Optional.of(copy));
        FormSettings settings = new FormSettings();
        settings.setAllowEform(true);
        when(formSettingsService.requireSettingsOrNull(document.getId())).thenReturn(settings);
        com.eqms.entity.DocumentRevisionRecord effective = new com.eqms.entity.DocumentRevisionRecord();
        effective.setFillableTemplateStorageObjectKey("forms/eform-sessions/x/y.docxf");
        when(documentRevisionRepository.findFirstByDocument_IdAndStatus_CodeOrderByCreatedAtDesc(document.getId(), "EFFECTIVE"))
                .thenReturn(Optional.of(effective));

        EformSignerAssignment step1 = new EformSignerAssignment();
        step1.setAssignedUser(starter);
        step1.setRoleName("Nguoi_lap");
        step1.setSequence(1);
        when(signerAssignmentRepository.findAllByControlledCopy_IdOrderBySequenceAsc(copy.getId())).thenReturn(List.of(step1));
        // No active run yet -- the recipient has not filled the form.
        when(fillRunRepository.findByControlledCopy_IdAndStatus(copy.getId(), "IN_PROGRESS")).thenReturn(Optional.empty());

        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> service.startFillSession(copy.getId(), "Nguoi_lap"));

        assertTrue(ex.getMessage().contains("has not been filled yet"));
        verify(sessionRepository, never()).save(any());
    }

    @Test
    void startDesignSession_rejected_whenContentChangedSinceFieldsWereLastDesigned() {
        when(currentUserService.requireCurrentUser()).thenReturn(starter);
        lenient().when(permissionEvaluationService.hasPermission(starter, EformEditSessionService.P_DESIGN)).thenReturn(true);
        DocumentRecord document = new DocumentRecord();
        document.setId(UUID.randomUUID());
        when(documentRecordRepository.findById(document.getId())).thenReturn(Optional.of(document));
        FormSettings settings = new FormSettings();
        when(formSettingsService.requireSettingsOrNull(document.getId())).thenReturn(settings);

        com.eqms.entity.DocumentRevisionRecord draft = new com.eqms.entity.DocumentRevisionRecord();
        draft.setFillableTemplateStorageObjectKey("forms/eform-sessions/x/y.docxf");
        draft.setSourceFileChecksum("checksum-after-edit");
        draft.setFillableTemplateSourceChecksum("checksum-at-design-time");
        when(documentRevisionRepository.findFirstByDocument_IdAndStatus_CodeOrderByCreatedAtDesc(document.getId(), "DRAFT"))
                .thenReturn(Optional.of(draft));

        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> service.startDesignSession(document.getId(), false));

        assertTrue(ex.getMessage().startsWith(EformEditSessionService.STALE_TEMPLATE_PREFIX));
        verify(sessionRepository, never()).save(any());
    }

    @Test
    void startDesignSession_resumesWithoutWarning_whenContentUnchanged() {
        when(currentUserService.requireCurrentUser()).thenReturn(starter);
        lenient().when(permissionEvaluationService.hasPermission(starter, EformEditSessionService.P_DESIGN)).thenReturn(true);
        DocumentRecord document = new DocumentRecord();
        document.setId(UUID.randomUUID());
        when(documentRecordRepository.findById(document.getId())).thenReturn(Optional.of(document));
        FormSettings settings = new FormSettings();
        when(formSettingsService.requireSettingsOrNull(document.getId())).thenReturn(settings);

        com.eqms.entity.DocumentRevisionRecord draft = new com.eqms.entity.DocumentRevisionRecord();
        draft.setFillableTemplateStorageObjectKey("forms/eform-sessions/x/y.docxf");
        draft.setSourceFileChecksum("same-checksum");
        draft.setFillableTemplateSourceChecksum("same-checksum");
        when(documentRevisionRepository.findFirstByDocument_IdAndStatus_CodeOrderByCreatedAtDesc(document.getId(), "DRAFT"))
                .thenReturn(Optional.of(draft));

        assertDoesNotThrow(() -> service.startDesignSession(document.getId(), false));
        verify(sessionRepository).save(any());
    }

    @Test
    void commitDesign_rejected_whenNotADesignSession() {
        when(currentUserService.requireCurrentUser()).thenReturn(starter);
        lenient().when(permissionEvaluationService.hasPermission(starter, EformEditSessionService.P_DESIGN)).thenReturn(true);
        // session.kind is "FILL" from setUp()

        assertThrows(IllegalArgumentException.class, () -> service.commitDesign(session.getId(), "test reason", "sig"));

        verifyNoInteractions(electronicSignatureService);
    }
}
