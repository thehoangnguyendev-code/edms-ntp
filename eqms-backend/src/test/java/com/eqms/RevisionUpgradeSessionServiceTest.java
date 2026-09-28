package com.eqms;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.document.RevisionUpgradeContinueRequest;
import com.eqms.dto.document.RevisionUpgradeSessionResponse;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.RevisionStatusDefinition;
import com.eqms.entity.RevisionUpgradeSession;
import com.eqms.entity.UserAccount;
import com.eqms.enums.RevisionWorkflowAction;
import com.eqms.exception.WorkflowAuthorizationDeniedException;
import com.eqms.repository.RevisionUpgradeSessionRepository;
import com.eqms.service.DocumentService;
import com.eqms.service.RevisionService;
import com.eqms.service.RevisionUpgradeSessionService;
import com.eqms.service.RevisionWorkflowAuthorizationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Regression coverage for the permission gaps closed in RevisionUpgradeSessionService:
 * createSession()/getSession() must never hand back an Upgrade Session -- new or existing -- to a
 * user who is not the Effective revision's Author and does not hold documents.revision.upgrade /
 * documents.workspace.manage, and continueSession() must never complete without a reason for change.
 */
@ExtendWith(MockitoExtension.class)
public class RevisionUpgradeSessionServiceTest {

    @Mock private RevisionUpgradeSessionRepository sessionRepository;
    @Mock private DocumentService documentService;
    @Mock private RevisionService revisionService;
    @Mock private CurrentUserService currentUserService;
    @Mock private RevisionWorkflowAuthorizationService revisionWorkflowAuthorizationService;

    private final ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());

    private RevisionUpgradeSessionService service;

    private UUID documentId;
    private UserAccount currentUser;
    private DocumentRevisionRecord currentEffectiveRevision;

    @BeforeEach
    void setUp() {
        service = new RevisionUpgradeSessionService(
                sessionRepository, documentService, revisionService, currentUserService,
                objectMapper, revisionWorkflowAuthorizationService
        );

        documentId = UUID.randomUUID();
        currentUser = new UserAccount();
        currentUser.setId(UUID.randomUUID());

        DocumentRecord document = new DocumentRecord();
        document.setId(documentId);

        currentEffectiveRevision = new DocumentRevisionRecord();
        currentEffectiveRevision.setId(UUID.randomUUID());
        currentEffectiveRevision.setDocument(document);
        RevisionStatusDefinition effective = new RevisionStatusDefinition();
        effective.setCode("EFFECTIVE");
        currentEffectiveRevision.setStatus(effective);

        org.mockito.Mockito.lenient().when(currentUserService.requireCurrentUser()).thenReturn(currentUser);
        org.mockito.Mockito.lenient().when(revisionService.requireCurrentEffectiveRevisionForSnapshot(documentId)).thenReturn(currentEffectiveRevision);
    }

    @Test
    void createSession_withoutUpgradePermission_isRejected() {
        doThrow(new WorkflowAuthorizationDeniedException("MISSING_PERMISSION", "denied"))
                .when(revisionWorkflowAuthorizationService)
                .require(eq(currentUser), eq(currentEffectiveRevision), eq(RevisionWorkflowAction.UPGRADE_REVISION), any());

        assertThrows(WorkflowAuthorizationDeniedException.class, () -> service.createSession(documentId));

        // The pre-existing-session early-return path must never be reached before the permission
        // check -- otherwise an unauthorized caller could still read back an existing session.
        verify(sessionRepository, never()).findBySessionKey(any());
        verify(documentService, never()).getDocumentDetail(any());
    }

    @Test
    void getSession_withoutUpgradePermission_isRejected() {
        UUID sessionId = UUID.randomUUID();
        doThrow(new WorkflowAuthorizationDeniedException("MISSING_PERMISSION", "denied"))
                .when(revisionWorkflowAuthorizationService)
                .require(eq(currentUser), eq(currentEffectiveRevision), eq(RevisionWorkflowAction.UPGRADE_REVISION), any());

        assertThrows(WorkflowAuthorizationDeniedException.class, () -> service.getSession(documentId, sessionId));

        verify(sessionRepository, never()).findByIdAndSourceDocument_Id(any(), any());
    }

    @Test
    void continueSession_withoutReasonForChange_isRejected() throws Exception {
        UUID sessionId = UUID.randomUUID();
        RevisionUpgradeSessionResponse payload = new RevisionUpgradeSessionResponse(
                sessionId, documentId, currentEffectiveRevision.getId(), "upgrade", "DRAFT",
                null, "DOC-001", "Test Document", "1.0", null, null, null,
                java.util.List.of(), java.util.List.of(), java.util.List.of(),
                Instant.now(), Instant.now()
        );

        RevisionUpgradeSession session = new RevisionUpgradeSession();
        session.setId(sessionId);
        session.setStatus("DRAFT");
        session.setPayloadJson(objectMapper.writeValueAsString(payload));

        when(sessionRepository.findByIdAndSourceDocument_Id(sessionId, documentId)).thenReturn(Optional.of(session));

        // No reasonForChange in the request and none already stored on the session.
        RevisionUpgradeContinueRequest request = new RevisionUpgradeContinueRequest(null, java.util.List.of());

        assertThrows(IllegalArgumentException.class, () -> service.continueSession(documentId, sessionId, request));

        verify(revisionService, never()).upgradeDocumentRevision(any(), any());
        verify(sessionRepository, never()).save(any());
    }
}
