package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentStatusDefinition;
import com.eqms.entity.DocumentType;
import com.eqms.entity.UserAccount;
import com.eqms.repository.DocumentRecordRepository;
import com.eqms.repository.DocumentTypeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** Manual Document Numbers: the rule a typed number follows, the duplicate warning, and when a number may still be changed. */
class DocumentNumberServiceTest {
    private SystemConfigurationService configuration;
    private DocumentRecordRepository documents;
    private DocumentTypeRepository types;
    private DocumentAuthorizationService authorization;
    private CurrentUserService users;
    private AuditTrailService audit;
    private JdbcTemplate jdbc;
    private PermissionEvaluationService permissions;
    private DocumentNumberService service;
    private DocumentType sop;
    private UserAccount actor;

    @BeforeEach
    void setUp() {
        configuration = mock(SystemConfigurationService.class);
        documents = mock(DocumentRecordRepository.class);
        types = mock(DocumentTypeRepository.class);
        authorization = mock(DocumentAuthorizationService.class);
        users = mock(CurrentUserService.class);
        audit = mock(AuditTrailService.class);
        jdbc = mock(JdbcTemplate.class);
        permissions = mock(PermissionEvaluationService.class);
        service = new DocumentNumberService(configuration, documents, types, authorization, users, audit, jdbc, permissions);
        when(configuration.getSerialNumberDigits()).thenReturn(4);
        when(configuration.getDocumentNumberEntryMode()).thenReturn("MANUAL");
        sop = new DocumentType();
        sop.setId(UUID.randomUUID());
        sop.setShortCode("SOP");
        sop.setCurrentSequence(7);
        actor = new UserAccount();
        actor.setId(UUID.randomUUID());
        when(users.requireCurrentUser()).thenReturn(actor);
        when(documents.findMaxDocumentSequenceByPrefix("SOP")).thenReturn(7);
    }

    private DocumentRecord draftDocument(String number) {
        DocumentRecord document = new DocumentRecord();
        document.setId(UUID.randomUUID());
        document.setDocumentNumber(number);
        document.setDocumentType(sop);
        DocumentStatusDefinition status = new DocumentStatusDefinition();
        status.setCode("DRAFT");
        status.setLabel("Draft");
        document.setStatus(status);
        return document;
    }

    @Test
    void aNumberOfTheRightShapeThatIsFreeIsValid() {
        var check = service.evaluate(sop, " sop.0008 ", null);
        assertTrue(check.valid());
        assertEquals("SOP.0008", check.number());
        assertEquals("OK", check.code());
    }

    @Test
    void theNumberMustStartWithTheTypeCodeAndHaveExactlyTheConfiguredDigits() {
        assertEquals("DOCUMENT_NUMBER_PREFIX", service.evaluate(sop, "FORM.0008", null).code());
        assertEquals("DOCUMENT_NUMBER_DIGITS", service.evaluate(sop, "SOP.08", null).code());
        assertEquals("DOCUMENT_NUMBER_DIGITS", service.evaluate(sop, "SOP.00080", null).code());
        assertEquals("DOCUMENT_NUMBER_REQUIRED", service.evaluate(sop, "  ", null).code());
        assertEquals("DOCUMENT_TYPE_REQUIRED", service.evaluate(null, "SOP.0008", null).code());
    }

    @Test
    void aNumberAlreadyUsedIsRefusedAndNamesTheDocument_evenInAnotherCase_andEvenWhenCancelled() {
        DocumentRecord other = draftDocument("SOP.0003");
        other.setDocumentName("Cleaning Procedure");
        other.getStatus().setLabel("Closed - Cancelled");
        when(documents.findFirstByDocumentNumberIgnoreCase("SOP.0003")).thenReturn(Optional.of(other));

        var check = service.evaluate(sop, "sop.0003", null);

        assertFalse(check.valid());
        assertEquals("DOCUMENT_NUMBER_IN_USE", check.code());
        assertTrue(check.message().contains("SOP.0003 - Cleaning Procedure (Closed - Cancelled)"));
    }

    @Test
    void theDocumentBeingChangedDoesNotConflictWithItself() {
        DocumentRecord self = draftDocument("SOP.0003");
        when(documents.findFirstByDocumentNumberIgnoreCase("SOP.0003")).thenReturn(Optional.of(self));
        assertTrue(service.evaluate(sop, "SOP.0003", self.getId()).valid());
    }

    @Test
    void aNumberFarAheadOfTheNextOneIsOnlyAWarning() {
        var far = service.evaluate(sop, "SOP.0500", null);
        assertTrue(far.valid());
        assertTrue(far.farFromNext());
        assertEquals("DOCUMENT_NUMBER_FAR_AHEAD", far.code());
        assertFalse(service.evaluate(sop, "SOP.0012", null).farFromNext());
        assertEquals("SOP.0008", far.suggestedNext());
    }

    @Test
    void requireValidRefusesWithTheMessageTheScreenShowed() {
        var ex = assertThrows(IllegalArgumentException.class, () -> service.requireValid(sop, "SOP.1", null));
        assertTrue(ex.getMessage().contains("exactly 4 digit"));
    }

    @Test
    void aNumberCanBeChangedOnlyWhileTheDocumentIsADraftWithNoStoredFile() {
        DocumentRecord document = draftDocument("SOP.0008");
        when(documents.findById(document.getId())).thenReturn(Optional.of(document));
        when(authorization.canEditInitialDocumentDraft(actor, document)).thenReturn(true);
        assertTrue(service.state(document.getId()).editable());

        when(documents.hasStoredSourceFile(document.getId())).thenReturn(true);
        assertEquals("DOCUMENT_NUMBER_LOCKED_BY_FILE", service.state(document.getId()).reasonCode());
        assertThrows(IllegalStateException.class, () -> service.change(document.getId(), "SOP.0009", "typo"));
        verify(documents, never()).saveAndFlush(any());

        when(documents.hasStoredSourceFile(document.getId())).thenReturn(false);
        document.getStatus().setCode("ACTIVE");
        assertEquals("DOCUMENT_NOT_DRAFT", service.state(document.getId()).reasonCode());

        document.getStatus().setCode("DRAFT");
        when(configuration.getDocumentNumberEntryMode()).thenReturn("AUTO");
        assertEquals("DOCUMENT_NUMBER_MANUAL_OFF", service.state(document.getId()).reasonCode());
    }

    @Test
    void changingANumberNeedsAReasonAndUpdatesTheCopiesAndTheAudit() {
        DocumentRecord document = draftDocument("SOP.0008");
        when(documents.findById(document.getId())).thenReturn(Optional.of(document));
        when(authorization.canEditInitialDocumentDraft(actor, document)).thenReturn(true);

        assertThrows(IllegalArgumentException.class, () -> service.change(document.getId(), "SOP.0009", " "));

        service.change(document.getId(), "sop.0009", "typed the wrong one");

        assertEquals("SOP.0009", document.getDocumentNumber());
        verify(jdbc).update(contains("document_revisions"), eq("SOP.0009"), eq(document.getId()));
        verify(audit).logAs(eq(actor), eq("DOCUMENT"), anyString(), eq(document.getId()), eq("DOCUMENT_NUMBER_CHANGED"),
                eq("DRAFT"), eq("DRAFT"), contains("typed the wrong one"), anyList());
    }

    @Test
    void aPersonWhoMayNotEditTheDraftCannotChangeItsNumber() {
        DocumentRecord document = draftDocument("SOP.0008");
        when(documents.findById(document.getId())).thenReturn(Optional.of(document));
        assertThrows(org.springframework.security.access.AccessDeniedException.class, () -> service.change(document.getId(), "SOP.0009", "reason"));
    }

    @Test
    void aNextSerialWiderThanTheConfiguredDigitsIsNotSuggested() {
        when(documents.findMaxDocumentSequenceByPrefix("SOP")).thenReturn(9999);
        sop.setCurrentSequence(9999);
        var check = service.evaluate(sop, "SOP.0008", null);
        assertNull(check.suggestedNext());
        assertTrue(service.evaluate(sop, "SOP.08", null).message().contains("for example SOP.0001"));
    }
}
