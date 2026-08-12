package com.eqms.service;

import com.eqms.dto.security.WorkflowActionPolicyActorRequest;
import com.eqms.dto.security.WorkflowActionPolicyEffectiveResponse;
import com.eqms.dto.security.WorkflowActionPolicyOptionsResponse;
import com.eqms.dto.security.WorkflowActionPolicyResponse;
import com.eqms.entity.Permission;
import com.eqms.entity.WorkflowActionPolicy;
import com.eqms.enums.WorkflowActorType;
import com.eqms.exception.WorkflowPolicyException;
import com.eqms.repository.DocumentTypeRepository;
import com.eqms.repository.PermissionRepository;
import com.eqms.repository.WorkflowActionPolicyRepository;
import com.eqms.service.workflow.DocumentsWorkflowDefinitionProvider;
import com.eqms.service.workflow.WorkflowRegistryService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

/**
 * Sprint 11 — Multi-workflow policy admin regression tests.
 * Verifies DOCUMENT_REVISION and CONTROLLED_COPY coexist correctly in options,
 * actor-type whitelist enforcement, actorCode requirements, and registry independence.
 */
@ExtendWith(MockitoExtension.class)
class WorkflowActionPolicyMultiWorkflowTest {

    @Mock WorkflowActionPolicyRepository policyRepo;
    @Mock AuditTrailService auditTrailService;
    @Mock PermissionRepository permissionRepository;
    @Mock DocumentTypeRepository documentTypeRepository;
    @Mock com.eqms.repository.RoleDefinitionRepository roleDefinitionRepository;
    @Mock SecurityChangeSignatureService securityChangeSignatureService;
    @Mock com.eqms.repository.WorkflowRoleRepository workflowRoleRepository;
    @Mock WorkflowRegistryService workflowRegistryService;

    @InjectMocks WorkflowActionPolicyService service;

    @BeforeEach
    void setUp() {
        lenient().doNothing().when(auditTrailService)
                .logAs(any(), any(), any(), any(), any(), any(), any(), any());
        lenient().when(permissionRepository.findByCode(any())).thenReturn(Optional.of(new Permission()));
        lenient().when(documentTypeRepository.findAllByActiveTrueOrderByNameAsc()).thenReturn(List.of());
        lenient().when(permissionRepository.findAllByModuleKeyIgnoreCaseOrderByDisplayOrderAscCodeAsc(any()))
                .thenReturn(List.of());
        WorkflowRegistryService realRegistry = new WorkflowRegistryService(List.of(new DocumentsWorkflowDefinitionProvider()));
        lenient().when(workflowRegistryService.getDefinitions()).thenReturn(realRegistry.getDefinitions());
        lenient().when(workflowRegistryService.getAllowedActorTypes(any(), any()))
                .thenAnswer(invocation -> realRegistry.getAllowedActorTypes(
                        invocation.getArgument(0), invocation.getArgument(1)));
    }

    // ── Options endpoint tests ─────────────────────────────────────────────────

    @Test
    void options_includesDocumentRevisionWorkflow() {
        assertThat(service.getOptions().workflows()).contains("DOCUMENT_REVISION");
    }

    @Test
    void options_includesDocumentMasterWorkflow() {
        assertThat(service.getOptions().workflows()).contains("DOCUMENT");
        assertThat(service.getOptions().objectTypes()).contains("DOCUMENT");
    }

    @Test
    void options_includesControlledCopyWorkflow() {
        assertThat(service.getOptions().workflows()).contains("CONTROLLED_COPY");
    }

    @Test
    void options_includesOnlyUserFacingControlledCopyObjectType() {
        assertThat(service.getOptions().objectTypes()).contains("CONTROLLED_COPY");
        assertThat(service.getOptions().objectTypes()).doesNotContain("CONTROLLED_COPY_BATCH");
    }

    @Test
    void options_includesControlledCopyActions() {
        List<String> actionCodes = service.getOptions().actions().stream()
                .map(WorkflowActionPolicyOptionsResponse.ActionOption::value).toList();
        assertThat(actionCodes).contains(
                "PREVIEW_FILE", "DISTRIBUTE_BATCH", "RECALL_BATCH",
                "REPORT_LOST_DAMAGED", "CANCEL_REQUEST");
    }

    @Test
    void options_previewFileAllowedActorsUsePermissionAndObjectAssignment() {
        var opt = service.getOptions().actions().stream()
                .filter(a -> "PREVIEW_FILE".equals(a.value()) && "CONTROLLED_COPY".equals(a.workflowKey()))
                .findFirst();
        assertThat(opt).isPresent();
        assertThat(opt.get().allowedActorTypes()).contains("OWNER", "RECIPIENT", "PERMISSION");
        assertThat(opt.get().allowedActorTypes()).doesNotContain("DCO", "DOCUMENT_ADMIN");
    }

    @Test
    void options_distributeBatchAllowedActorsAreConfigurableProfilesOrPermissions() {
        var action = service.getOptions().actions().stream()
                .filter(a -> "DISTRIBUTE_BATCH".equals(a.value()))
                .findFirst();
        assertThat(action).isPresent();
        assertThat(action.get().allowedActorTypes()).contains("ACCESS_PROFILE", "PERMISSION");
        assertThat(action.get().allowedActorTypes()).doesNotContain("OWNER", "AUTHOR", "DCO", "DOCUMENT_ADMIN");
    }

    @Test
    void options_distributeBatchUsesControlledCopyWorkflow() {
        var action = service.getOptions().actions().stream()
                .filter(a -> "DISTRIBUTE_BATCH".equals(a.value()))
                .findFirst();
        assertThat(action).isPresent();
        assertThat(action.get().objectType()).isEqualTo("CONTROLLED_COPY");
    }

    @Test
    void options_accessProfileRequiresActorCode() {
        var at = service.getOptions().actorTypes().stream()
                .filter(t -> "ACCESS_PROFILE".equals(t.value())).findFirst();
        assertThat(at).isPresent();
        assertThat(at.get().requiresActorCode()).isTrue();
    }

    @Test
    void options_legacyWorkflowRoleIsNotExposed() {
        var at = service.getOptions().actorTypes().stream()
                .filter(t -> "WORKFLOW_ROLE".equals(t.value())).findFirst();
        assertThat(at).isEmpty();
    }

    @Test
    void options_legacyDocumentWorkflowPoolIsNotExposed() {
        var at = service.getOptions().actorTypes().stream()
                .filter(t -> "DOCUMENT_WORKFLOW_POOL".equals(t.value())).findFirst();
        assertThat(at).isEmpty();
    }

    @Test
    void options_revisionActionCountIsAtLeast13() {
        long count = service.getOptions().actions().stream()
                .filter(a -> "DOCUMENT_REVISION".equals(a.workflowKey())).count();
        assertThat(count).isGreaterThanOrEqualTo(13);
    }

    // ── Validation — Controlled Copy ──────────────────────────────────────────

    @Test
    void ccPolicy_validPreviewFileActors_allowed() {
        service.validateActors(
                List.of(
                        new WorkflowActionPolicyActorRequest(WorkflowActorType.PERMISSION, "documents.workspace.manage"),
                        new WorkflowActionPolicyActorRequest(WorkflowActorType.RECIPIENT, null),
                        new WorkflowActionPolicyActorRequest(WorkflowActorType.OWNER, null)),
                "CONTROLLED_COPY", "PREVIEW_FILE", "documents.controlled_copy.view_file");
        // no exception expected
    }

    @Test
    void ccPolicy_authorNotAllowedForPreviewFile_throws() {
        assertThatThrownBy(() -> service.validateActors(
                List.of(new WorkflowActionPolicyActorRequest(WorkflowActorType.AUTHOR, null)),
                "CONTROLLED_COPY", "PREVIEW_FILE", "documents.controlled_copy.view_file"))
                .isInstanceOf(WorkflowPolicyException.class)
                .hasMessageContaining("AUTHOR");
    }

    @Test
    void ccPolicy_nullAccessProfileActorCode_throws() {
        assertThatThrownBy(() -> service.validateActors(
                List.of(new WorkflowActionPolicyActorRequest(WorkflowActorType.ACCESS_PROFILE, null)),
                "CONTROLLED_COPY", "DISTRIBUTE_COPY", "documents.controlled_copy.distribute"))
                .isInstanceOf(WorkflowPolicyException.class)
                .hasMessageContaining("actorCode is required");
    }

    // WORKFLOW_ROLE/DOCUMENT_WORKFLOW_POOL removed entirely from WorkflowActorType (dead legacy
    // selectors, always fail-closed) — there is no longer a compile-time way to construct a
    // request with them, so the "legacy actor type throws" tests no longer apply.

    // ── Validation — Revision (unchanged) ────────────────────────────────────

    @Test
    void revisionPolicy_authorAllowedForCompleteAuthoring() {
        service.validateActors(
                List.of(new WorkflowActionPolicyActorRequest(WorkflowActorType.AUTHOR, null)),
                "DOCUMENT_REVISION", "COMPLETE_AUTHORING", "documents.revision.complete_authoring");
    }

    @Test
    void revisionPolicy_authorNotAllowedForPublish_throws() {
        assertThatThrownBy(() -> service.validateActors(
                List.of(new WorkflowActionPolicyActorRequest(WorkflowActorType.AUTHOR, null)),
                "DOCUMENT_REVISION", "PUBLISH", "documents.revision.publish"))
                .isInstanceOf(WorkflowPolicyException.class);
    }

    // ── resolveAllowedActorTypes ───────────────────────────────────────────────

    @Test
    void resolveAllowedActorTypes_unknownWorkflow_returnsEmpty() {
        assertThat(service.resolveAllowedActorTypes("UNKNOWN_WORKFLOW", "PREVIEW_FILE")).isEmpty();
    }

    @Test
    void resolveAllowedActorTypes_unknownCCAction_returnsEmpty() {
        assertThat(service.resolveAllowedActorTypes("CONTROLLED_COPY", "NONEXISTENT_ACTION")).isEmpty();
    }

    // ── Registry independence ─────────────────────────────────────────────────

    @Test
    void registry_revisionPublishDefault_isCorrect() {
        var d = WorkflowActionDefaultPolicyRegistry.get("DOCUMENT_REVISION", "PUBLISH", "READY_FOR_PUBLISHING");
        assertThat(d).isNotNull();
        assertThat(d.requiredPermissionCode()).isEqualTo("documents.revision.publish");
        assertThat(d.actors()).extracting(WorkflowActionDefaultPolicyRegistry.DefaultActorEntry::actorType)
                .containsExactly(WorkflowActorType.PERMISSION);
        assertThat(d.actors().get(0).actorCode()).isEqualTo("documents.workspace.manage");
    }

    @Test
    void registry_ccPreviewFileDistributedDefault_isCorrect() {
        var d = WorkflowActionDefaultPolicyRegistry.get("CONTROLLED_COPY", "PREVIEW_FILE", "DISTRIBUTED");
        assertThat(d).isNotNull();
        assertThat(d.requiredPermissionCode()).isEqualTo("documents.controlled_copy.view_file");
        assertThat(d.actors()).extracting(WorkflowActionDefaultPolicyRegistry.DefaultActorEntry::actorType)
                .containsExactlyInAnyOrder(WorkflowActorType.PERMISSION,
                        WorkflowActorType.RECIPIENT, WorkflowActorType.OWNER);
    }

    @Test
    void registry_ccHasNoPublishAction_returnsNull() {
        assertThat(WorkflowActionDefaultPolicyRegistry.get("CONTROLLED_COPY", "PUBLISH", "READY_FOR_PUBLISHING")).isNull();
    }

    @Test
    void registry_revisionPublishUnaffectedByCCLookup() {
        var revPublish = WorkflowActionDefaultPolicyRegistry.get("DOCUMENT_REVISION", "PUBLISH", "READY_FOR_PUBLISHING");
        var ccPreview  = WorkflowActionDefaultPolicyRegistry.get("CONTROLLED_COPY", "PREVIEW_FILE", "READY_FOR_DISTRIBUTION");
        assertThat(revPublish).isNotNull();
        assertThat(ccPreview).isNotNull();
        assertThat(revPublish.requiredPermissionCode()).isEqualTo("documents.revision.publish");
        assertThat(ccPreview.requiredPermissionCode()).isEqualTo("documents.controlled_copy.view_file");
    }

    @Test
    void registry_ccDistributeBatch_hasCorrectDefault() {
        var d = WorkflowActionDefaultPolicyRegistry.get("CONTROLLED_COPY", "DISTRIBUTE_BATCH", "READY_FOR_DISTRIBUTION");
        assertThat(d).isNotNull();
        assertThat(d.requiredPermissionCode()).isEqualTo("documents.controlled_copy.distribute");
        assertThat(d.actors()).extracting(WorkflowActionDefaultPolicyRegistry.DefaultActorEntry::actorType)
                .containsExactly(WorkflowActorType.PERMISSION);
    }

    // ── Effective policy tests ─────────────────────────────────────────────────

    @Test
    void effectivePolicy_controlledCopyPreview_returnsControlledCopyPolicy() {
        WorkflowActionPolicy ccPolicy = ccPolicy("PREVIEW_FILE", "DISTRIBUTED",
                "documents.controlled_copy.view_file");
        when(policyRepo.findActiveGlobalPolicies(any(), any(), any(), any(), any()))
                .thenReturn(List.of(ccPolicy));

        WorkflowActionPolicyEffectiveResponse result = service.getEffectivePolicy(
                "DOCUMENT_CONTROL", "CONTROLLED_COPY", "CONTROLLED_COPY",
                "PREVIEW_FILE", "DISTRIBUTED", null);

        assertThat(result.source()).isEqualTo("GLOBAL");
        assertThat(result.fallbackUsed()).isFalse();
        assertThat(result.policy()).isNotNull();
        assertThat(result.policy().workflowKey()).isEqualTo("CONTROLLED_COPY");
        assertThat(result.policy().actionCode()).isEqualTo("PREVIEW_FILE");
        assertThat(result.policy().fromStatus()).isEqualTo("DISTRIBUTED");
    }

    @Test
    void effectivePolicy_controlledCopyBatchDistribute_returnsBatchPolicy() {
        WorkflowActionPolicy batchPolicy = ccPolicy("DISTRIBUTE_BATCH", "READY_FOR_DISTRIBUTION",
                "documents.controlled_copy.distribute");
        batchPolicy.setObjectType("CONTROLLED_COPY_BATCH");
        when(policyRepo.findActiveGlobalPolicies(any(), any(), any(), any(), any()))
                .thenReturn(List.of(batchPolicy));

        WorkflowActionPolicyEffectiveResponse result = service.getEffectivePolicy(
                "DOCUMENT_CONTROL", "CONTROLLED_COPY", "CONTROLLED_COPY_BATCH",
                "DISTRIBUTE_BATCH", "READY_FOR_DISTRIBUTION", null);

        assertThat(result.source()).isEqualTo("GLOBAL");
        assertThat(result.policy()).isNotNull();
        assertThat(result.policy().objectType()).isEqualTo("CONTROLLED_COPY_BATCH");
        assertThat(result.policy().actionCode()).isEqualTo("DISTRIBUTE_BATCH");
    }

    @Test
    void effectivePolicy_revisionPublish_returnsRevisionPolicy() {
        WorkflowActionPolicy revPolicy = revPolicy("PUBLISH", "READY_FOR_PUBLISHING",
                "documents.revision.publish");
        when(policyRepo.findActiveGlobalPolicies(any(), any(), any(), any(), any()))
                .thenReturn(List.of(revPolicy));

        WorkflowActionPolicyEffectiveResponse result = service.getEffectivePolicy(
                "DOCUMENT_CONTROL", "DOCUMENT_REVISION", "REVISION",
                "PUBLISH", "READY_FOR_PUBLISHING", null);

        assertThat(result.source()).isEqualTo("GLOBAL");
        assertThat(result.policy()).isNotNull();
        assertThat(result.policy().workflowKey()).isEqualTo("DOCUMENT_REVISION");
        assertThat(result.policy().actionCode()).isEqualTo("PUBLISH");
    }

    @Test
    void effectivePolicy_documentTypeOverrideWinsWithinSameWorkflow() {
        UUID docTypeId = UUID.randomUUID();
        WorkflowActionPolicy override = ccPolicy("PREVIEW_FILE", "DISTRIBUTED",
                "documents.controlled_copy.view_file");
        override.setDocumentTypeId(docTypeId);
        override.setPriority(50);
        when(policyRepo.findActivePoliciesForDocumentType(any(), any(), any(), any(), any(), eq(docTypeId)))
                .thenReturn(List.of(override));

        WorkflowActionPolicyEffectiveResponse result = service.getEffectivePolicy(
                "DOCUMENT_CONTROL", "CONTROLLED_COPY", "CONTROLLED_COPY",
                "PREVIEW_FILE", "DISTRIBUTED", docTypeId);

        assertThat(result.source()).isEqualTo("DOCUMENT_TYPE_OVERRIDE");
        assertThat(result.fallbackUsed()).isFalse();
    }

    @Test
    void effectivePolicy_inactiveOverrideFallsBackToGlobalWithinSameWorkflow() {
        UUID docTypeId = UUID.randomUUID();
        WorkflowActionPolicy globalPolicy = ccPolicy("PREVIEW_FILE", "DISTRIBUTED",
                "documents.controlled_copy.view_file");
        // Doc-type override returns empty (inactive overrides filtered by repo)
        when(policyRepo.findActivePoliciesForDocumentType(any(), any(), any(), any(), any(), eq(docTypeId)))
                .thenReturn(List.of());
        when(policyRepo.findActiveGlobalPolicies(any(), any(), any(), any(), any()))
                .thenReturn(List.of(globalPolicy));

        WorkflowActionPolicyEffectiveResponse result = service.getEffectivePolicy(
                "DOCUMENT_CONTROL", "CONTROLLED_COPY", "CONTROLLED_COPY",
                "PREVIEW_FILE", "DISTRIBUTED", docTypeId);

        assertThat(result.source()).isEqualTo("GLOBAL");
        assertThat(result.fallbackUsed()).isFalse();
    }

    // ── Reset default tests ────────────────────────────────────────────────────

    @Test
    void resetDefault_controlledCopyPreviewDistributed_restoresCcDefault() {
        WorkflowActionPolicy policy = ccPolicy("PREVIEW_FILE", "DISTRIBUTED",
                "documents.controlled_copy.view_file_custom");
        policy.setSystem(true);
        when(policyRepo.findById(any())).thenReturn(Optional.of(policy));
        when(policyRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        WorkflowActionPolicyResponse result = service.resetToSystemDefault(policy.getId(), null, null, null);

        assertThat(result.requiredPermissionCode()).isEqualTo("documents.controlled_copy.view_file");
        assertThat(result.actors()).hasSize(3);
        assertThat(result.actors()).anyMatch(a -> a.actorType() == WorkflowActorType.PERMISSION
                && "documents.workspace.manage".equals(a.actorCode()));
        assertThat(result.actors()).anyMatch(a -> a.actorType() == WorkflowActorType.RECIPIENT);
        assertThat(result.actors()).anyMatch(a -> a.actorType() == WorkflowActorType.OWNER);
    }

    @Test
    void resetDefault_controlledCopyBatchDistribute_restoresBatchDefault() {
        WorkflowActionPolicy policy = ccPolicy("DISTRIBUTE_BATCH", "READY_FOR_DISTRIBUTION",
                "documents.controlled_copy.distribute_custom");
        policy.setObjectType("CONTROLLED_COPY_BATCH");
        policy.setSystem(true);
        when(policyRepo.findById(any())).thenReturn(Optional.of(policy));
        when(policyRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        WorkflowActionPolicyResponse result = service.resetToSystemDefault(policy.getId(), null, null, null);

        assertThat(result.requiredPermissionCode()).isEqualTo("documents.controlled_copy.distribute");
        assertThat(result.actors()).hasSize(1);
        assertThat(result.actors()).anyMatch(a -> a.actorType() == WorkflowActorType.PERMISSION
                && "documents.workspace.manage".equals(a.actorCode()));
        assertThat(result.actors()).noneMatch(a -> a.actorType() == WorkflowActorType.OWNER);
    }

    @Test
    void resetDefault_revisionPublish_doesNotResolveFromCcRegistry() {
        WorkflowActionPolicy policy = revPolicy("PUBLISH", "READY_FOR_PUBLISHING",
                "documents.revision.publish_custom");
        policy.setSystem(true);
        when(policyRepo.findById(any())).thenReturn(Optional.of(policy));
        when(policyRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        WorkflowActionPolicyResponse result = service.resetToSystemDefault(policy.getId(), null, null, null);

        assertThat(result.requiredPermissionCode()).isEqualTo("documents.revision.publish");
        assertThat(result.actors()).hasSize(1);
        assertThat(result.actors()).anyMatch(a -> a.actorType() == WorkflowActorType.PERMISSION
                && "documents.workspace.manage".equals(a.actorCode()));
        assertThat(result.actors()).noneMatch(a -> a.actorType() == WorkflowActorType.OWNER);
    }

    @Test
    void resetDefault_controlledCopyPreview_doesNotResolveFromRevisionRegistry() {
        WorkflowActionPolicy policy = ccPolicy("PREVIEW_FILE", "READY_FOR_DISTRIBUTION",
                "documents.controlled_copy.view_file_custom");
        policy.setSystem(true);
        when(policyRepo.findById(any())).thenReturn(Optional.of(policy));
        when(policyRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        WorkflowActionPolicyResponse result = service.resetToSystemDefault(policy.getId(), null, null, null);

        // CC default, not revision default
        assertThat(result.requiredPermissionCode()).isEqualTo("documents.controlled_copy.view_file");
        assertThat(result.actors()).anyMatch(a -> a.actorType() == WorkflowActorType.OWNER);
    }

    @Test
    void resetDefault_unknownWorkflow_throwsNoSystemDefault() {
        WorkflowActionPolicy policy = ccPolicy("PREVIEW_FILE", "DISTRIBUTED",
                "documents.controlled_copy.view_file");
        policy.setWorkflowKey("UNKNOWN_WORKFLOW");
        policy.setSystem(true);
        when(policyRepo.findById(any())).thenReturn(Optional.of(policy));

        assertThatThrownBy(() -> service.resetToSystemDefault(policy.getId(), null, null, null))
                .isInstanceOf(WorkflowPolicyException.class)
                .hasMessageContaining("No system default");
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private WorkflowActionPolicy ccPolicy(String actionCode, String fromStatus, String permCode) {
        WorkflowActionPolicy p = new WorkflowActionPolicy();
        p.setModuleKey("DOCUMENT_CONTROL");
        p.setWorkflowKey("CONTROLLED_COPY");
        p.setObjectType("CONTROLLED_COPY");
        p.setActionCode(actionCode);
        p.setFromStatus(fromStatus);
        p.setRequiredPermissionCode(permCode);
        p.setPriority(100);
        p.setActive(true);
        p.setSystem(false);
        p.setActors(new ArrayList<>());
        return p;
    }

    private WorkflowActionPolicy revPolicy(String actionCode, String fromStatus, String permCode) {
        WorkflowActionPolicy p = new WorkflowActionPolicy();
        p.setModuleKey("DOCUMENT_CONTROL");
        p.setWorkflowKey("DOCUMENT_REVISION");
        p.setObjectType("REVISION");
        p.setActionCode(actionCode);
        p.setFromStatus(fromStatus);
        p.setRequiredPermissionCode(permCode);
        p.setPriority(100);
        p.setActive(true);
        p.setSystem(false);
        p.setActors(new ArrayList<>());
        return p;
    }
}
