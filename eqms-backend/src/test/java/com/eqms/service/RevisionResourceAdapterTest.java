package com.eqms.service;

import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.DocumentType;
import com.eqms.entity.RevisionStatusDefinition;
import com.eqms.entity.UserAccount;
import com.eqms.entity.WorkflowActionPolicy;
import com.eqms.dto.security.RevisionWorkflowAuthorizationContext;
import com.eqms.repository.DocumentRevisionRepository;
import com.eqms.repository.WorkflowActionPolicyRelationRepository;
import com.eqms.service.authorization.ResolvedPolicy;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RevisionResourceAdapterTest {

    @Mock private DocumentRevisionRepository revisionRepository;
    @Mock private RevisionWorkflowAuthorizationService revisionWorkflowAuthorizationService;
    @Mock private ObjectAccessEvaluationService objectAccessEvaluationService;
    @Mock private WorkflowActionPolicyService workflowActionPolicyService;
    @Mock private WorkflowActionPolicyRelationRepository workflowActionPolicyRelationRepository;

    private RevisionResourceAdapter adapter;
    private UserAccount actor;
    private UUID revisionId;
    private DocumentRevisionRecord revision;

    @BeforeEach
    void setUp() {
        adapter = new RevisionResourceAdapter(revisionRepository, revisionWorkflowAuthorizationService,
                objectAccessEvaluationService, workflowActionPolicyService, workflowActionPolicyRelationRepository);
        actor = new UserAccount();
        actor.setId(UUID.randomUUID());
        revisionId = UUID.randomUUID();

        revision = new DocumentRevisionRecord();
        revision.setId(revisionId);
        RevisionStatusDefinition status = new RevisionStatusDefinition();
        status.setCode("DRAFT");
        revision.setStatus(status);
        DocumentRecord document = new DocumentRecord();
        DocumentType type = new DocumentType();
        UUID docTypeId = UUID.randomUUID();
        type.setId(docTypeId);
        document.setDocumentType(type);
        revision.setDocument(document);

        lenient().when(revisionRepository.findById(revisionId)).thenReturn(Optional.of(revision));
    }

    @Test
    void metadata_matchesRevisionWorkflow() {
        assertThat(adapter.resourceType()).isEqualTo("REVISION");
    }

    @Test
    void resolvePolicy_delegatesToWorkflowActionPolicyServiceAndRelations() {
        WorkflowActionPolicy policy = new WorkflowActionPolicy();
        policy.setRequiredPermissionCode("documents.revision.submit_review");
        policy.setRelationMatchRule("ANY");
        when(workflowActionPolicyService.resolvePolicy(
                "DOCUMENT_CONTROL", "DOCUMENT_REVISION", "REVISION", "SUBMIT_FOR_REVIEW", "DRAFT", null))
                .thenReturn(Optional.of(policy));
        when(workflowActionPolicyRelationRepository.findAllByPolicy_IdAndActiveTrueOrderByPriorityAsc(any()))
                .thenReturn(List.of());

        Optional<ResolvedPolicy> resolved = adapter.resolvePolicy("SUBMIT_FOR_REVIEW", "DRAFT", null);

        assertThat(resolved).isPresent();
        assertThat(resolved.get().requiredPermissionCode()).isEqualTo("documents.revision.submit_review");
        assertThat(resolved.get().relationMatchRule()).isEqualTo("ANY");
    }

    @Test
    void resolvePolicy_notConfigured_returnsEmpty() {
        when(workflowActionPolicyService.resolvePolicy(any(), any(), any(), any(), any(), any()))
                .thenReturn(Optional.empty());

        assertThat(adapter.resolvePolicy("SUBMIT_FOR_REVIEW", "DRAFT", null)).isEmpty();
    }

    @Test
    void resolveState_readsFromRevisionStatus() {
        assertThat(adapter.resolveState(revisionId)).isEqualTo("DRAFT");
    }

    @Test
    void resolveState_unknownRevision_returnsNull() {
        when(revisionRepository.findById(revisionId)).thenReturn(Optional.empty());
        assertThat(adapter.resolveState(revisionId)).isNull();
    }

    @Test
    void resolveDocumentTypeId_readsFromDocument() {
        assertThat(adapter.resolveDocumentTypeId(revisionId)).isEqualTo(revision.getDocument().getDocumentType().getId());
    }

    @Test
    void resolveMatchedRelations_delegatesToExistingAssignmentHelpers() {
        when(revisionWorkflowAuthorizationService.isRevisionAuthor(actor, revision)).thenReturn(true);
        when(revisionWorkflowAuthorizationService.isRevisionCoAuthor(actor, revision)).thenReturn(false);
        when(revisionWorkflowAuthorizationService.isPendingReviewer(actor, revision)).thenReturn(false);
        when(revisionWorkflowAuthorizationService.isPendingApprover(actor, revision)).thenReturn(false);

        Set<String> relations = adapter.resolveMatchedRelations(actor, revisionId);

        assertThat(relations).containsExactly("AUTHOR");
    }

    @Test
    void resolveMatchedRelations_multipleRelations_allReturned() {
        when(revisionWorkflowAuthorizationService.isRevisionAuthor(actor, revision)).thenReturn(false);
        when(revisionWorkflowAuthorizationService.isRevisionCoAuthor(actor, revision)).thenReturn(true);
        when(revisionWorkflowAuthorizationService.isPendingReviewer(actor, revision)).thenReturn(true);
        when(revisionWorkflowAuthorizationService.isPendingApprover(actor, revision)).thenReturn(false);

        Set<String> relations = adapter.resolveMatchedRelations(actor, revisionId);

        assertThat(relations).containsExactlyInAnyOrder("CO_AUTHOR", "ASSIGNED_REVIEWER");
    }

    @Test
    void resolveMatchedRelations_unknownRevision_returnsEmpty() {
        when(revisionRepository.findById(revisionId)).thenReturn(Optional.empty());

        assertThat(adapter.resolveMatchedRelations(actor, revisionId)).isEmpty();
    }

    @Test
    void isWithinObjectScope_delegatesToObjectAccessEvaluationService() {
        when(objectAccessEvaluationService.canAccessRevision(actor, revision, "VIEW")).thenReturn(true);

        assertThat(adapter.isWithinObjectScope(actor, revisionId, "VIEW")).isTrue();
    }

    @Test
    void isWithinObjectScope_unknownRevision_deniedFailClosed() {
        when(revisionRepository.findById(revisionId)).thenReturn(Optional.empty());

        assertThat(adapter.isWithinObjectScope(actor, revisionId, "VIEW")).isFalse();
    }

    @Test
    void checkPrecondition_delegatesToLegacyStateInvariantLogic() {
        when(revisionWorkflowAuthorizationService.checkStatePrecondition(
                eq(revision), eq(com.eqms.enums.RevisionWorkflowAction.SUBMIT_FOR_REVIEW), any(RevisionWorkflowAuthorizationContext.class)))
                .thenReturn(Optional.of("EDITING_NOT_COMPLETED"));

        Optional<String> result = adapter.checkPrecondition(revisionId, "SUBMIT_FOR_REVIEW");

        assertThat(result).contains("EDITING_NOT_COMPLETED");
    }

    @Test
    void checkPrecondition_unknownActionCode_returnsEmpty() {
        assertThat(adapter.checkPrecondition(revisionId, "NOT_A_REAL_ACTION")).isEmpty();
    }

    @Test
    void checkPrecondition_unknownRevision_returnsEmpty() {
        when(revisionRepository.findById(revisionId)).thenReturn(Optional.empty());

        assertThat(adapter.checkPrecondition(revisionId, "SUBMIT_FOR_REVIEW")).isEmpty();
    }
}
