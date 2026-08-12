package com.eqms.service;

import com.eqms.dto.security.ControlledCopyAuthorizationContext;
import com.eqms.entity.ControlledCopyRecord;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.UserAccount;
import com.eqms.entity.WorkflowActionPolicy;
import com.eqms.repository.ControlledCopyRepository;
import com.eqms.repository.WorkflowActionPolicyRelationRepository;
import com.eqms.repository.WorkflowActionPolicyRepository;
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
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ControlledCopyResourceAdapterTest {

    @Mock private ControlledCopyRepository controlledCopyRepository;
    @Mock private ControlledCopyAuthorizationService controlledCopyAuthorizationService;
    @Mock private ObjectAccessEvaluationService objectAccessEvaluationService;
    @Mock private WorkflowActionPolicyService workflowActionPolicyService;
    @Mock private WorkflowActionPolicyRelationRepository workflowActionPolicyRelationRepository;
    @Mock private WorkflowActionPolicyRepository workflowActionPolicyRepository;

    private ControlledCopyResourceAdapter adapter;
    private UserAccount actor;
    private UUID copyId;
    private ControlledCopyRecord copy;
    private ControlledCopyAuthorizationContext context;

    @BeforeEach
    void setUp() {
        adapter = new ControlledCopyResourceAdapter(controlledCopyRepository, controlledCopyAuthorizationService,
                objectAccessEvaluationService, workflowActionPolicyService, workflowActionPolicyRelationRepository,
                workflowActionPolicyRepository);
        actor = new UserAccount();
        actor.setId(UUID.randomUUID());
        copyId = UUID.randomUUID();

        copy = new ControlledCopyRecord();
        copy.setId(copyId);
        copy.setStatusCode("DISTRIBUTED");
        copy.setDocument(new DocumentRecord());

        context = ControlledCopyAuthorizationContext.forCopy(
                copyId, null, null, null, null, null, "DISTRIBUTED", null, null, null, null, true, true, true);

        lenient().when(controlledCopyRepository.findById(copyId)).thenReturn(Optional.of(copy));
        lenient().when(controlledCopyAuthorizationService.buildCopyContext(copy)).thenReturn(context);
    }

    @Test
    void resourceType_isControlledCopy() {
        assertThat(adapter.resourceType()).isEqualTo("CONTROLLED_COPY");
    }

    @Test
    void resolveState_readsStatusCode() {
        assertThat(adapter.resolveState(copyId)).isEqualTo("DISTRIBUTED");
    }

    @Test
    void resolvePolicy_delegatesToWorkflowActionPolicyServiceAndRelations() {
        WorkflowActionPolicy policy = new WorkflowActionPolicy();
        policy.setRequiredPermissionCode("documents.controlled_copy.view");
        policy.setRelationMatchRule("ANY");
        when(workflowActionPolicyService.resolvePolicy(
                "DOCUMENT_CONTROL", "CONTROLLED_COPY", "CONTROLLED_COPY", "VIEW_COPY", "DISTRIBUTED", null))
                .thenReturn(Optional.of(policy));
        when(workflowActionPolicyRelationRepository.findAllByPolicy_IdAndActiveTrueOrderByPriorityAsc(any()))
                .thenReturn(List.of());

        Optional<ResolvedPolicy> resolved = adapter.resolvePolicy("VIEW_COPY", "DISTRIBUTED", null);

        assertThat(resolved).isPresent();
        assertThat(resolved.get().requiredPermissionCode()).isEqualTo("documents.controlled_copy.view");
    }

    @Test
    void resolveMatchedRelations_ownerAndRecipientBothMatch() {
        when(controlledCopyAuthorizationService.matchesRequesterOrRecipient(actor, context)).thenReturn(true);
        when(controlledCopyAuthorizationService.matchesDocumentViewer(actor, context)).thenReturn(true);

        Set<String> relations = adapter.resolveMatchedRelations(actor, copyId);

        assertThat(relations).containsExactlyInAnyOrder("OWNER", "RECIPIENT");
    }

    @Test
    void resolveMatchedRelations_neitherMatches_empty() {
        when(controlledCopyAuthorizationService.matchesRequesterOrRecipient(actor, context)).thenReturn(false);
        when(controlledCopyAuthorizationService.matchesDocumentViewer(actor, context)).thenReturn(false);

        assertThat(adapter.resolveMatchedRelations(actor, copyId)).isEmpty();
    }

    @Test
    void resolveMatchedRelations_unknownCopy_empty() {
        when(controlledCopyRepository.findById(copyId)).thenReturn(Optional.empty());

        assertThat(adapter.resolveMatchedRelations(actor, copyId)).isEmpty();
    }

    @Test
    void isWithinObjectScope_delegatesToObjectAccessEvaluationServiceAgainstParentDocument() {
        when(objectAccessEvaluationService.canAccessDocument(actor, copy.getDocument(), "VIEW")).thenReturn(true);

        assertThat(adapter.isWithinObjectScope(actor, copyId, "VIEW_COPY")).isTrue();
    }

    @Test
    void isWithinObjectScope_unknownCopy_deniedFailClosed() {
        when(controlledCopyRepository.findById(copyId)).thenReturn(Optional.empty());

        assertThat(adapter.isWithinObjectScope(actor, copyId, "VIEW_COPY")).isFalse();
    }

    @Test
    void checkPrecondition_delegatesToLegacyInvariantLogic() {
        when(controlledCopyAuthorizationService.checkInvariantPrecondition(
                com.eqms.enums.ControlledCopyWorkflowAction.DOWNLOAD_FILE, context, "CONTROLLED_COPY"))
                .thenReturn(Optional.of("EXPIRED"));

        assertThat(adapter.checkPrecondition(copyId, "DOWNLOAD_FILE")).contains("EXPIRED");
    }

    @Test
    void checkPrecondition_unknownActionCode_returnsEmpty() {
        assertThat(adapter.checkPrecondition(copyId, "NOT_A_REAL_ACTION")).isEmpty();
    }
}
