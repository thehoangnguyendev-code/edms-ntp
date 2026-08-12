package com.eqms.service;

import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentStatusDefinition;
import com.eqms.entity.DocumentType;
import com.eqms.entity.LifecycleStatePolicy;
import com.eqms.entity.UserAccount;
import com.eqms.repository.DocumentRecordRepository;
import com.eqms.repository.LifecycleStatePolicyRepository;
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
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DocumentResourceAdapterTest {

    @Mock private DocumentRecordRepository documentRepository;
    @Mock private LifecycleStatePolicyRepository lifecycleStatePolicyRepository;
    @Mock private ObjectAccessEvaluationService objectAccessEvaluationService;

    private DocumentResourceAdapter adapter;
    private UserAccount actor;
    private UUID documentId;
    private DocumentRecord document;

    @BeforeEach
    void setUp() {
        adapter = new DocumentResourceAdapter(documentRepository, lifecycleStatePolicyRepository, objectAccessEvaluationService);
        actor = new UserAccount();
        actor.setId(UUID.randomUUID());
        documentId = UUID.randomUUID();

        document = new DocumentRecord();
        document.setId(documentId);
        DocumentStatusDefinition status = new DocumentStatusDefinition();
        status.setCode("DRAFT");
        document.setStatus(status);
        DocumentType type = new DocumentType();
        type.setId(UUID.randomUUID());
        document.setDocumentType(type);

        lenient().when(documentRepository.findById(documentId)).thenReturn(Optional.of(document));
    }

    @Test
    void resolveState_readsFromDocumentStatus() {
        assertThat(adapter.resolveState(documentId)).isEqualTo("DRAFT");
    }

    @Test
    void resolveDocumentTypeId_readsFromDocument() {
        assertThat(adapter.resolveDocumentTypeId(documentId)).isEqualTo(document.getDocumentType().getId());
    }

    @Test
    void resolvePolicy_updateMetadata_synthesizesDirectPermissionCheck() {
        // Mirrors the real code path: DocumentService checks documents.document.configure_next_metadata
        // directly, there is no workflow_action_policies/lifecycle_state_policies row consulted.
        var resolved = adapter.resolvePolicy("UPDATE_METADATA", "DRAFT", null);

        assertThat(resolved).isPresent();
        assertThat(resolved.get().requiredPermissionCode()).isEqualTo("documents.document.configure_next_metadata");
        assertThat(resolved.get().requiredRelationCodes()).isEmpty();
    }

    @Test
    void resolvePolicy_reopen_notConfigured() {
        // No real implementation exists anywhere for Document Master Reopen.
        assertThat(adapter.resolvePolicy("REOPEN", "CLOSED_CANCELLED", null)).isEmpty();
    }

    @Test
    void resolvePolicy_cancel_readsFromLifecycleStatePolicies() {
        LifecycleStatePolicy policy = new LifecycleStatePolicy();
        policy.setStatusCode("DRAFT");
        policy.setActorScope("ANY");
        policy.setRequiredPermissionCode("documents.document.cancel");
        policy.setPriority(100);
        when(lifecycleStatePolicyRepository.findAllByModuleKeyAndObjectTypeAndCapabilityCodeAndActiveTrueOrderByPriorityDesc(
                "documents", "DOCUMENT", "CANCEL")).thenReturn(List.of(policy));

        var resolved = adapter.resolvePolicy("CANCEL", "DRAFT", null);

        assertThat(resolved).isPresent();
        assertThat(resolved.get().requiredPermissionCode()).isEqualTo("documents.document.cancel");
        assertThat(resolved.get().requiredRelationCodes()).isEmpty();
    }

    @Test
    void resolvePolicy_cancel_authorScopeRequiresOwnerRelation() {
        LifecycleStatePolicy policy = new LifecycleStatePolicy();
        policy.setStatusCode("DRAFT");
        policy.setActorScope("AUTHOR");
        policy.setRequiredPermissionCode("documents.document.cancel");
        policy.setPriority(100);
        when(lifecycleStatePolicyRepository.findAllByModuleKeyAndObjectTypeAndCapabilityCodeAndActiveTrueOrderByPriorityDesc(
                "documents", "DOCUMENT", "CANCEL")).thenReturn(List.of(policy));

        var resolved = adapter.resolvePolicy("CANCEL", "DRAFT", null);

        assertThat(resolved).isPresent();
        assertThat(resolved.get().requiredRelationCodes()).containsExactly("OWNER");
    }

    @Test
    void resolvePolicy_cancel_noMatchingStatus_notConfigured() {
        LifecycleStatePolicy policy = new LifecycleStatePolicy();
        policy.setStatusCode("ACTIVE");
        policy.setActorScope("ANY");
        policy.setRequiredPermissionCode("documents.document.cancel");
        when(lifecycleStatePolicyRepository.findAllByModuleKeyAndObjectTypeAndCapabilityCodeAndActiveTrueOrderByPriorityDesc(
                "documents", "DOCUMENT", "CANCEL")).thenReturn(List.of(policy));

        assertThat(adapter.resolvePolicy("CANCEL", "DRAFT", null)).isEmpty();
    }

    @Test
    void resolveMatchedRelations_ownerMatches() {
        document.setOwner(actor);

        Set<String> relations = adapter.resolveMatchedRelations(actor, documentId);

        assertThat(relations).containsExactly("OWNER");
    }

    @Test
    void resolveMatchedRelations_notOwner_empty() {
        UserAccount otherOwner = new UserAccount();
        otherOwner.setId(UUID.randomUUID());
        document.setOwner(otherOwner);

        assertThat(adapter.resolveMatchedRelations(actor, documentId)).isEmpty();
    }

    @Test
    void isWithinObjectScope_delegatesToObjectAccessEvaluationService() {
        when(objectAccessEvaluationService.canAccessDocument(actor, document, "VIEW")).thenReturn(true);

        assertThat(adapter.isWithinObjectScope(actor, documentId, "VIEW")).isTrue();
    }

    @Test
    void isWithinObjectScope_unknownDocument_deniedFailClosed() {
        when(documentRepository.findById(documentId)).thenReturn(Optional.empty());

        assertThat(adapter.isWithinObjectScope(actor, documentId, "VIEW")).isFalse();
    }
}
