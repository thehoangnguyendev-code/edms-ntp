package com.eqms;

import com.eqms.dto.security.FileAccessContext;
import com.eqms.dto.security.FileAccessDecision;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.RevisionStatusDefinition;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.enums.FileAccessAction;
import com.eqms.enums.FileObjectType;
import com.eqms.repository.DocumentRevisionRepository;
import com.eqms.repository.DocumentWorkflowParticipantRepository;
import com.eqms.repository.DocumentWorkflowPoolMemberRepository;
import com.eqms.repository.RevisionWorkflowParticipantRepository;
import com.eqms.service.AuditTrailService;
import com.eqms.service.DocumentAuthorizationService;
import com.eqms.service.EffectivePermissionService;
import com.eqms.service.EffectivePermissionService.EffectivePermissionResult;
import com.eqms.service.ObjectAccessEvaluationService;
import com.eqms.service.PermissionEvaluationService;
import com.eqms.service.SecureFileAccessService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StrictParticipantVisibilityTest {

    // ── DocumentAuthorizationService fixture ─────────────────────────────────
    @Mock DocumentWorkflowPoolMemberRepository poolMemberRepository;
    @Mock DocumentWorkflowParticipantRepository documentParticipantRepository;
    @Mock RevisionWorkflowParticipantRepository revisionParticipantRepository;
    @Mock DocumentRevisionRepository documentRevisionRepository;
    @Mock PermissionEvaluationService permissionEvaluationService;
    @Mock ObjectAccessEvaluationService objectAccessEvaluationService;
    @Mock com.eqms.repository.UserAccessProfileRepository userAccessProfileRepository;

    @InjectMocks DocumentAuthorizationService documentAuthorizationService;

    // ── SecureFileAccessService fixture ──────────────────────────────────────
    @Mock EffectivePermissionService effectivePermissionService;
    @Mock AuditTrailService auditTrailService;

    private UserAccount user;
    private UUID userId;
    private UUID revisionId;

    @BeforeEach
    void setup() {
        userId = UUID.randomUUID();
        revisionId = UUID.randomUUID();
        user = new UserAccount();
        user.setId(userId);
        user.setUsername("staff");
        user.setStatus(UserStatus.Active);

        lenient().when(objectAccessEvaluationService.canViewRevision(any(), any())).thenReturn(true);
        lenient().when(objectAccessEvaluationService.canViewDocument(any(), any())).thenReturn(true);
        lenient().when(permissionEvaluationService.hasAnyPermission(any(), any(String[].class))).thenReturn(false);
        lenient().when(poolMemberRepository.findAllByPoolTypeAndActiveTrueOrderByCreatedAtAsc(any())).thenReturn(List.of());
        lenient().when(userAccessProfileRepository.findUserIdsByWorkflowRole(any())).thenReturn(List.of());
        lenient().when(documentParticipantRepository.findAllByDocument_IdOrderBySequenceOrderAsc(any())).thenReturn(List.of());
        lenient().when(revisionParticipantRepository.findAllByRevision_IdAndParticipantTypeOrderBySequenceOrderAsc(any(), any()))
                .thenReturn(List.of());
        lenient().when(revisionParticipantRepository.countByRevision_Document_IdAndUser_Id(any(), any())).thenReturn(0L);
    }

    private void setStrict(Object target, boolean value) {
        ReflectionTestUtils.setField(target, "strictVisibility", value);
    }

    private DocumentRevisionRecord revisionWithStatus(String statusCode) {
        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        ReflectionTestUtils.setField(revision, "id", revisionId);
        RevisionStatusDefinition status = new RevisionStatusDefinition();
        status.setCode(statusCode);
        revision.setStatus(status);
        return revision;
    }

    private DocumentRecord documentWithId() {
        DocumentRecord document = new DocumentRecord();
        ReflectionTestUtils.setField(document, "id", UUID.randomUUID());
        return document;
    }

    // ── canViewRevision ───────────────────────────────────────────────────────

    @Test
    void strictOn_effectiveRevision_visibleToViewPermissionHolder() {
        setStrict(documentAuthorizationService, true);
        when(permissionEvaluationService.hasPermission(user, "documents.document.view")).thenReturn(true);

        assertThat(documentAuthorizationService.canViewRevision(user, revisionWithStatus("EFFECTIVE"))).isTrue();
        assertThat(documentAuthorizationService.canViewRevision(user, revisionWithStatus("OBSOLETED"))).isTrue();
    }

    @Test
    void strictOn_draftRevision_hiddenFromNonParticipant() {
        setStrict(documentAuthorizationService, true);
        lenient().when(permissionEvaluationService.hasPermission(user, "documents.document.view")).thenReturn(true);

        assertThat(documentAuthorizationService.canViewRevision(user, revisionWithStatus("DRAFT"))).isFalse();
        assertThat(documentAuthorizationService.canViewRevision(user, revisionWithStatus("PENDING_REVIEW"))).isFalse();
    }

    @Test
    void strictOff_effectiveRevision_stillHiddenFromNonParticipant_legacyBehavior() {
        setStrict(documentAuthorizationService, false);
        lenient().when(permissionEvaluationService.hasPermission(user, "documents.document.view")).thenReturn(true);

        assertThat(documentAuthorizationService.canViewRevision(user, revisionWithStatus("EFFECTIVE"))).isFalse();
    }

    // ── canViewDocument ───────────────────────────────────────────────────────

    @Test
    void strictOn_documentWithEffectiveRevision_visibleToViewPermissionHolder() {
        setStrict(documentAuthorizationService, true);
        when(permissionEvaluationService.hasPermission(user, "documents.document.view")).thenReturn(true);
        when(documentRevisionRepository.existsByDocument_IdAndStatus_CodeIn(any(), anyCollection())).thenReturn(true);

        assertThat(documentAuthorizationService.canViewDocument(user, documentWithId())).isTrue();
    }

    @Test
    void strictOn_draftOnlyDocument_hiddenFromNonParticipant() {
        setStrict(documentAuthorizationService, true);
        lenient().when(permissionEvaluationService.hasPermission(user, "documents.document.view")).thenReturn(true);
        when(documentRevisionRepository.existsByDocument_IdAndStatus_CodeIn(any(), anyCollection())).thenReturn(false);

        assertThat(documentAuthorizationService.canViewDocument(user, documentWithId())).isFalse();
    }

    // ── SecureFileAccessService review snapshot ───────────────────────────────

    private SecureFileAccessService fileAccessService(boolean strict) {
        SecureFileAccessService service = new SecureFileAccessService(
                permissionEvaluationService, effectivePermissionService, auditTrailService,
                revisionParticipantRepository, null, documentAuthorizationService);
        setStrict(service, strict);
        EffectivePermissionResult effective = new EffectivePermissionResult(
                userId, Set.of("documents.revision.preview"), List.of(), List.of(), false, false);
        lenient().when(effectivePermissionService.getEffectivePermissionResult(user)).thenReturn(effective);
        lenient().when(permissionEvaluationService.hasPermission(eq(user), any())).thenReturn(true);
        return service;
    }

    private FileAccessContext snapshotContext(String status, UUID authorId) {
        Map<String, Object> attrs = new HashMap<>();
        attrs.put("revisionId", revisionId.toString());
        if (authorId != null) {
            attrs.put("authorId", authorId.toString());
        }
        return new FileAccessContext("DOCUMENTS", status, null, null, attrs);
    }

    @Test
    void strictOn_snapshotPreview_deniedForNonParticipant() {
        SecureFileAccessService service = fileAccessService(true);
        when(revisionParticipantRepository.countByRevision_IdAndUser_Id(revisionId, userId)).thenReturn(0L);
        when(permissionEvaluationService.hasAnyPermission(eq(user), any(String[].class))).thenReturn(false);

        FileAccessDecision decision = service.check(user, FileAccessAction.VIEW_PREVIEW,
                FileObjectType.REVIEW_SNAPSHOT, revisionId, snapshotContext("PENDING_REVIEW", UUID.randomUUID()));

        assertThat(decision.allowed()).isFalse();
        assertThat(decision.reasonCode()).isEqualTo("NOT_ASSIGNED_PARTICIPANT");
    }

    @Test
    void strictOn_snapshotPreview_allowedForAssignedParticipant() {
        SecureFileAccessService service = fileAccessService(true);
        when(revisionParticipantRepository.countByRevision_IdAndUser_Id(revisionId, userId)).thenReturn(1L);

        FileAccessDecision decision = service.check(user, FileAccessAction.VIEW_PREVIEW,
                FileObjectType.REVIEW_SNAPSHOT, revisionId, snapshotContext("PENDING_REVIEW", UUID.randomUUID()));

        assertThat(decision.allowed()).isTrue();
    }

    @Test
    void strictOn_snapshotPreview_allowedForAuthor() {
        SecureFileAccessService service = fileAccessService(true);
        lenient().when(revisionParticipantRepository.countByRevision_IdAndUser_Id(revisionId, userId)).thenReturn(0L);

        FileAccessDecision decision = service.check(user, FileAccessAction.VIEW_PREVIEW,
                FileObjectType.REVIEW_SNAPSHOT, revisionId, snapshotContext("PENDING_REVIEW", userId));

        assertThat(decision.allowed()).isTrue();
    }

    @Test
    void strictOff_snapshotPreview_allowedForNonParticipant_legacyBehavior() {
        SecureFileAccessService service = fileAccessService(false);

        FileAccessDecision decision = service.check(user, FileAccessAction.VIEW_PREVIEW,
                FileObjectType.REVIEW_SNAPSHOT, revisionId, snapshotContext("PENDING_REVIEW", UUID.randomUUID()));

        assertThat(decision.allowed()).isTrue();
    }
}
