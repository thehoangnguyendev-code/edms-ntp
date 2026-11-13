package com.eqms;

import com.eqms.auth.CurrentUserService;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.AuditLogChangeRepository;
import com.eqms.repository.AuditLogRepository;
import com.eqms.repository.ControlledCopyDistributionBatchRepository;
import com.eqms.repository.ControlledCopyRepository;
import com.eqms.repository.DocumentRecordRepository;
import com.eqms.repository.DocumentRevisionRepository;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.AuditTrailService;
import com.eqms.service.UncontrolledCopyService;
import com.eqms.service.DocumentAuthorizationService;
import com.eqms.service.PermissionEvaluationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.security.access.AccessDeniedException;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * The Audit Trail tab on a Document/Revision detail view is folded into detail-view access: there
 * is no separate documents.document.view_audit or global audit.view permission anymore.
 * getByEntity(...)/requireEntityAuditView delegates entirely to
 * {@link DocumentAuthorizationService#requireCanViewDocument} /
 * {@link DocumentAuthorizationService#requireCanViewRevision}, the same check the detail page
 * itself uses -- this file locks that contract in for getByEntity, which had zero prior coverage.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AuditTrailServiceTest {

    @Mock private AuditLogRepository auditLogRepository;
    @Mock private AuditLogChangeRepository auditLogChangeRepository;
    @Mock private CurrentUserService currentUserService;
    @Mock private UserAccountRepository userAccountRepository;
    @Mock private DocumentRecordRepository documentRecordRepository;
    @Mock private DocumentRevisionRepository documentRevisionRepository;
    @Mock private ControlledCopyRepository controlledCopyRepository;
    @Mock private ControlledCopyDistributionBatchRepository controlledCopyDistributionBatchRepository;
    @Mock private com.eqms.repository.ControlledCopyExpiryLimitRepository controlledCopyExpiryLimitRepository;
    @Mock private PermissionEvaluationService permissionEvaluationService;
    @Mock private DocumentAuthorizationService documentAuthorizationService;

    private AuditTrailService service;

    private UserAccount user;
    private UUID entityId;

    @BeforeEach
    void setUp() {
        user = new UserAccount();
        user.setId(UUID.randomUUID());
        user.setStatus(UserStatus.Active);
        entityId = UUID.randomUUID();

        ObjectProvider<DocumentAuthorizationService> provider = new ObjectProvider<>() {
            @Override
            public DocumentAuthorizationService getObject() {
                return documentAuthorizationService;
            }

            @Override
            public DocumentAuthorizationService getObject(Object... args) {
                return documentAuthorizationService;
            }

            @Override
            public DocumentAuthorizationService getIfAvailable() {
                return documentAuthorizationService;
            }

            @Override
            public DocumentAuthorizationService getIfUnique() {
                return documentAuthorizationService;
            }
        };

        service = new AuditTrailService(
                auditLogRepository,
                auditLogChangeRepository,
                currentUserService,
                userAccountRepository,
                documentRecordRepository,
                documentRevisionRepository,
                controlledCopyRepository,
                controlledCopyDistributionBatchRepository,
                controlledCopyExpiryLimitRepository,
                permissionEvaluationService,
                provider
        );

        // Field-injected in the application; the snapshot of the signing user looks up the user's access profile names.
        com.eqms.repository.UserAccessProfileRepository userAccessProfileRepository = org.mockito.Mockito.mock(com.eqms.repository.UserAccessProfileRepository.class);
        when(userAccessProfileRepository.findByUserId(any())).thenReturn(java.util.List.of());
        org.springframework.test.util.ReflectionTestUtils.setField(service, "userAccessProfileRepository", userAccessProfileRepository);

        when(currentUserService.requireCurrentUser()).thenReturn(user);
        when(auditLogRepository.findAllByNormalizedEntityTypeAndEntityId(anyString(), any())).thenReturn(java.util.List.of());
    }

    @Test
    void revision_getByEntity_allowedWhenCanViewRevision() {
        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setId(entityId);
        when(documentRevisionRepository.findById(entityId)).thenReturn(Optional.of(revision));

        service.getByEntity("REVISION", entityId);

        // No permission is ever consulted directly here -- the object-scope check is the only gate.
        verify(documentAuthorizationService).requireCanViewRevision(user, revision);
    }

    @Test
    void pagedRevisionHistoryUsesTheSameObjectGateWithoutGlobalAuditView() {
        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setId(entityId);
        when(documentRevisionRepository.findById(entityId)).thenReturn(Optional.of(revision));
        when(auditLogRepository.findAll(org.mockito.ArgumentMatchers.<org.springframework.data.jpa.domain.Specification<com.eqms.entity.AuditLog>>any(),
                org.mockito.ArgumentMatchers.any(org.springframework.data.domain.Pageable.class)))
                .thenReturn(org.springframework.data.domain.Page.empty());
        service.getEntityPage("REVISION", entityId, false, "search", "All", null, null, null, null, "timestamp", "desc", 1, 10);
        verify(documentAuthorizationService).requireCanViewRevision(user, revision);
        org.mockito.Mockito.verifyNoInteractions(permissionEvaluationService);
    }

    @Test
    void pagedRevisionHistoryFailsClosedBeforeRunningTheQuery() {
        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setId(entityId);
        when(documentRevisionRepository.findById(entityId)).thenReturn(Optional.of(revision));
        doThrow(new AccessDeniedException("Revision access denied")).when(documentAuthorizationService).requireCanViewRevision(user, revision);
        assertThatThrownBy(() -> service.getEntityPage("REVISION", entityId, false, null, "All", null, null, null, null, "timestamp", "desc", 1, 10))
                .isInstanceOf(AccessDeniedException.class);
        org.mockito.Mockito.verifyNoInteractions(auditLogRepository);
    }

    @Test
    void revision_getByEntity_deniedWhenCannotViewRevision() {
        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setId(entityId);
        when(documentRevisionRepository.findById(entityId)).thenReturn(Optional.of(revision));
        doThrow(new AccessDeniedException("Revision access denied"))
                .when(documentAuthorizationService).requireCanViewRevision(user, revision);

        assertThatThrownBy(() -> service.getByEntity("REVISION", entityId))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void document_getByEntity_allowedWhenCanViewDocument() {
        DocumentRecord document = new DocumentRecord();
        document.setId(entityId);
        when(documentRecordRepository.findById(entityId)).thenReturn(Optional.of(document));

        service.getByEntity("DOCUMENT", entityId);

        verify(documentAuthorizationService).requireCanViewDocument(user, document);
    }

    @Test
    void document_getByEntity_deniedWhenCannotViewDocument() {
        DocumentRecord document = new DocumentRecord();
        document.setId(entityId);
        when(documentRecordRepository.findById(entityId)).thenReturn(Optional.of(document));
        doThrow(new AccessDeniedException("Document access denied"))
                .when(documentAuthorizationService).requireCanViewDocument(user, document);

        assertThatThrownBy(() -> service.getByEntity("DOCUMENT", entityId))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void document_getByEntity_deniedWhenDocumentNotFound() {
        when(documentRecordRepository.findById(entityId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getByEntity("DOCUMENT", entityId))
                .isInstanceOf(AccessDeniedException.class);
        assertThat(true).isTrue();
    }

    // ---- owner rule 2026-11-07: whoever may open a screen may read the Audit Trail tab it carries ----------------------------

    private void uncontrolledCopyAccess(boolean canOpen) {
        UncontrolledCopyService uncontrolled = org.mockito.Mockito.mock(UncontrolledCopyService.class);
        when(uncontrolled.canViewAudit(user, entityId)).thenReturn(canOpen);
        ObjectProvider<UncontrolledCopyService> provider = new ObjectProvider<>() {
            @Override public UncontrolledCopyService getObject() { return uncontrolled; }
            @Override public UncontrolledCopyService getObject(Object... args) { return uncontrolled; }
            @Override public UncontrolledCopyService getIfAvailable() { return uncontrolled; }
            @Override public UncontrolledCopyService getIfUnique() { return uncontrolled; }
        };
        org.springframework.test.util.ReflectionTestUtils.setField(service, "uncontrolledCopyService", provider);
    }

    @Test
    void uncontrolledCopy_auditTabFollowsTheScreen() {
        uncontrolledCopyAccess(true);
        service.getByEntity("Uncontrolled Copy", entityId);

        uncontrolledCopyAccess(false);
        assertThatThrownBy(() -> service.getByEntity("Uncontrolled Copy", entityId)).isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void accessProfile_auditTabNeedsOnlyThePermissionToOpenTheScreen_notTheGlobalAuditPermission() {
        when(permissionEvaluationService.hasAnyPermission(user, "security.access_profiles.view", "security.access_profiles.update", "security.access_profiles.assign")).thenReturn(true);

        service.getByEntity("ACCESS_PROFILE", entityId);
        verify(permissionEvaluationService, never()).hasAnyPermission(eq(user), eq("audit.view"), any(String.class), any(String.class));
    }

    @Test
    void accessProfile_auditTabIsClosedToSomeoneWhoCannotOpenTheScreen() {
        assertThatThrownBy(() -> service.getByEntity("ACCESS_PROFILE", entityId)).isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void permissionSet_auditTabFollowsThePermissionSetScreen() {
        assertThatThrownBy(() -> service.getByEntity("PERMISSION_SET", entityId)).isInstanceOf(AccessDeniedException.class);
        when(permissionEvaluationService.hasAnyPermission(user, "security.permission_sets.view", "security.permission_sets.update")).thenReturn(true);
        service.getByEntity("PERMISSION_SET", entityId);
    }

    @Test
    void restoreRequest_auditTabFollowsTheBackupModulePermission() {
        assertThatThrownBy(() -> service.getByEntity("BACKUP_RESTORE", entityId)).isInstanceOf(AccessDeniedException.class);
        when(permissionEvaluationService.hasAnyPermission(user, "backup.module.view")).thenReturn(true);
        service.getByEntity("BACKUP_RESTORE", entityId);
    }

    @Test
    void anUnknownKindOfRecord_needsTheGlobalAuditPermission_andIsNoLongerReadAsARevision() {
        assertThatThrownBy(() -> service.getByEntity("SOMETHING_ELSE", entityId))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("Audit trail view permission required");
        verifyNoInteractions(documentRevisionRepository);

        when(permissionEvaluationService.hasAnyPermission(eq(user), eq("audit.view"), eq("audittrail.module.view"), eq("VIEW_AUDIT_TRAIL"))).thenReturn(true);
        service.getByEntity("SOMETHING_ELSE", entityId);
    }

    @Test
    void aReasonThePersonTypedIsStoredApartFromTheSystemComment() {
        service.logAsWithUserReason(user, "SETTINGS", "Cancel test", entityId, "CANCEL", "DRAFT", "CLOSED_CANCELLED",
                "System wrote this comment", "  What the person typed  ", null, null);

        org.mockito.ArgumentCaptor<com.eqms.entity.AuditLog> saved = org.mockito.ArgumentCaptor.forClass(com.eqms.entity.AuditLog.class);
        org.mockito.Mockito.verify(auditLogRepository).save(saved.capture());
        assertThat(saved.getValue().getUserReason()).isEqualTo("What the person typed");
        assertThat(saved.getValue().getComment()).isEqualTo("System wrote this comment");
    }

    @Test
    void anEventWithNoTypedReasonKeepsTheUserReasonEmpty_evenWhenTheSystemCommentIsStored() {
        service.logAs(user, "SETTINGS", "Update test", entityId, "UPDATE", "DRAFT", "DRAFT", "Document draft updated | Co-authors=0");

        org.mockito.ArgumentCaptor<com.eqms.entity.AuditLog> saved = org.mockito.ArgumentCaptor.forClass(com.eqms.entity.AuditLog.class);
        org.mockito.Mockito.verify(auditLogRepository).save(saved.capture());
        assertThat(saved.getValue().getUserReason()).isNull();
        assertThat(saved.getValue().getComment()).startsWith("Document draft updated");
    }
}
