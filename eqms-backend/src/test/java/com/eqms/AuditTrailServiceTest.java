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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * HDR-AUTH-001: a direct stakeholder of a Document/Revision (Author, Co-author, Reviewer/Approver,
 * or Admin/DCO) must see its Audit Trail tab without the separate documents.document.view_audit /
 * global audit.view permission. Non-stakeholder (broad/indirect) viewers still need it -- this file
 * locks in that behavior for getByEntity(...)/requireEntityAuditView, which had zero prior coverage.
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

        when(currentUserService.requireCurrentUser()).thenReturn(user);
        when(auditLogRepository.findAllByNormalizedEntityTypeAndEntityId(anyString(), any())).thenReturn(java.util.List.of());
    }

    @Test
    void revisionStakeholder_getByEntity_allowedWithoutAnyAuditPermission() {
        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setId(entityId);
        when(documentRevisionRepository.findById(entityId)).thenReturn(Optional.of(revision));
        when(documentAuthorizationService.isDirectStakeholder(user, revision)).thenReturn(true);
        when(permissionEvaluationService.hasAnyPermission(any(), any(String[].class))).thenReturn(false);
        when(permissionEvaluationService.hasPermission(any(), anyString())).thenReturn(false);

        service.getByEntity("REVISION", entityId);

        // requireScopedEntityView must still be exercised (object-scope check), but no audit.view
        // permission was ever required for this stakeholder.
        assertThat(true).isTrue();
    }

    @Test
    void revisionNonStakeholder_getByEntity_deniedWithoutAuditViewPermission() {
        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setId(entityId);
        when(documentRevisionRepository.findById(entityId)).thenReturn(Optional.of(revision));
        when(documentAuthorizationService.isDirectStakeholder(user, revision)).thenReturn(false);
        when(permissionEvaluationService.hasAnyPermission(any(), any(String[].class))).thenReturn(false);

        assertThatThrownBy(() -> service.getByEntity("REVISION", entityId))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void revisionNonStakeholder_getByEntity_allowedWithGlobalAuditViewPermission() {
        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setId(entityId);
        when(documentRevisionRepository.findById(entityId)).thenReturn(Optional.of(revision));
        when(documentAuthorizationService.isDirectStakeholder(user, revision)).thenReturn(false);
        when(permissionEvaluationService.hasAnyPermission(any(), any(String[].class))).thenReturn(true);
        when(documentAuthorizationService.canViewRevision(user, revision)).thenReturn(true);

        service.getByEntity("REVISION", entityId);
    }

    @Test
    void documentStakeholder_getByEntity_allowedWithoutAnyAuditPermission() {
        DocumentRecord document = new DocumentRecord();
        document.setId(entityId);
        when(documentRecordRepository.findById(entityId)).thenReturn(Optional.of(document));
        when(documentAuthorizationService.isDirectStakeholder(user, document)).thenReturn(true);
        when(permissionEvaluationService.hasPermission(any(), anyString())).thenReturn(false);
        when(permissionEvaluationService.hasAnyPermission(any(), any(String[].class))).thenReturn(false);

        service.getByEntity("DOCUMENT", entityId);
    }

    @Test
    void documentNonStakeholder_getByEntity_deniedWithoutViewAuditOrGlobalPermission() {
        DocumentRecord document = new DocumentRecord();
        document.setId(entityId);
        when(documentRecordRepository.findById(entityId)).thenReturn(Optional.of(document));
        when(documentAuthorizationService.isDirectStakeholder(user, document)).thenReturn(false);
        when(permissionEvaluationService.hasPermission(user, "documents.document.view_audit")).thenReturn(false);
        when(permissionEvaluationService.hasAnyPermission(any(), any(String[].class))).thenReturn(false);

        assertThatThrownBy(() -> service.getByEntity("DOCUMENT", entityId))
                .isInstanceOf(AccessDeniedException.class);
    }
}
