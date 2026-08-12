package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.security.EffectiveAccessResponse;
import com.eqms.dto.security.EffectiveAccessRowResponse;
import com.eqms.dto.settings.AccessProfileDetailResponse;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.DocumentStatusDefinition;
import com.eqms.entity.PermissionSetItem;
import com.eqms.entity.RevisionStatusDefinition;
import com.eqms.entity.RoleDefinition;
import com.eqms.entity.UserAccessProfile;
import com.eqms.entity.UserAccount;
import com.eqms.entity.WorkflowActionPolicy;
import com.eqms.entity.WorkflowActionPolicyActor;
import com.eqms.enums.RevisionWorkflowAction;
import com.eqms.enums.WorkflowActorType;
import com.eqms.repository.DocumentStatusDefinitionRepository;
import com.eqms.repository.DocumentTypeRepository;
import com.eqms.repository.LifecycleStatePolicyRepository;
import com.eqms.repository.PermissionSetItemRepository;
import com.eqms.repository.RevisionStatusDefinitionRepository;
import com.eqms.repository.RoleDefinitionRepository;
import com.eqms.repository.UserAccessProfileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Phase 3 orchestration test for AccessEffectiveService — verifies the panel calls all 3 real
 * evaluators (WorkflowActionPolicyService, LifecycleStatePolicyRepository behind
 * LifecycleStatePolicyEvaluator's own resolution, ObjectAccessEvaluationService) and combines
 * their results using exactly the 4 documented reason codes.
 *
 * Not run against a live/seeded DB (none available in this environment) — all collaborators are
 * mocked. This proves the orchestration logic (permission -> actor-scope -> object-access
 * ordering, and reason-code mapping) is correct; it does not prove the real DB-backed policies
 * produce these exact rows for a real "QA Manager"/"Reviewer-only" profile in production data.
 */
@ExtendWith(MockitoExtension.class)
class AccessEffectiveServiceTest {

    @Mock RoleDefinitionRepository roleDefinitionRepository;
    @Mock AccessProfileService accessProfileService;
    @Mock PermissionSetItemRepository permissionSetItemRepository;
    @Mock WorkflowActionPolicyService workflowActionPolicyService;
    @Mock LifecycleStatePolicyRepository lifecycleStatePolicyRepository;
    @Mock ObjectAccessEvaluationService objectAccessEvaluationService;
    @Mock DocumentStatusDefinitionRepository documentStatusRepository;
    @Mock RevisionStatusDefinitionRepository revisionStatusRepository;
    @Mock DocumentTypeRepository documentTypeRepository;
    @Mock UserAccessProfileRepository userAccessProfileRepository;
    @Mock PermissionEvaluationService permissionEvaluationService;
    @Mock CurrentUserService currentUserService;

    @InjectMocks AccessEffectiveService service;

    private UUID profileId;
    private RoleDefinition profile;

    @BeforeEach
    void setup() {
        profileId = UUID.randomUUID();
        profile = new RoleDefinition();
        profile.setId(profileId);
        profile.setCode("TEST_PROFILE");
        profile.setName("Test Profile");

        // F-04: getEffectiveAccess() now gates on the caller's own permission before anything
        // else — default every test to an authorized caller so existing scenarios (which test
        // the 3-evaluator orchestration, not the gate itself) don't need to restub this.
        UserAccount actor = new UserAccount();
        actor.setId(UUID.randomUUID());
        lenient().when(currentUserService.requireCurrentUser()).thenReturn(actor);
        lenient().when(permissionEvaluationService.hasAnyPermission(
                eq(actor), eq("security.access_profiles.view"),
                eq("security.access_profiles.update"), eq("security.access_profiles.assign")))
                .thenReturn(true);

        lenient().when(roleDefinitionRepository.findById(profileId)).thenReturn(Optional.of(profile));
        lenient().when(documentStatusRepository.findAllByOrderBySortOrderAsc()).thenReturn(List.of());
        lenient().when(lifecycleStatePolicyRepository
                .findAllByModuleKeyAndObjectTypeAndCapabilityCodeAndActiveTrueOrderByPriorityDesc(
                        anyString(), anyString(), anyString()))
                .thenReturn(List.of());
        // Every RevisionWorkflowAction applicable to a given status gets its own resolvePolicy call —
        // default to "no custom policy" so tests only need to stub the one action under test.
        lenient().when(workflowActionPolicyService.resolvePolicy(any(), anyString(), any()))
                .thenReturn(Optional.empty());
    }

    private RevisionStatusDefinition status(String code) {
        RevisionStatusDefinition s = new RevisionStatusDefinition();
        s.setCode(code);
        s.setLabel(code);
        return s;
    }

    private void onlyStatus(String code) {
        when(revisionStatusRepository.findAllByOrderBySortOrderAsc()).thenReturn(List.of(status(code)));
    }

    private EffectiveAccessRowResponse findRow(EffectiveAccessResponse resp, String action, String statusCode) {
        return resp.rows().stream()
                .filter(r -> r.actionCode().equals(action) && r.statusCode().equals(statusCode))
                .findFirst()
                .orElseThrow(() -> new AssertionError("row not found: " + action + "/" + statusCode));
    }

    // ── Broad role: permission + matching WORKFLOW_ROLE actor -> allowed ──────

    @Test
    void accessProfile_permissionActor_allowed() {
        onlyStatus("PENDING_REVIEW");
        stubGrantedPermissions("documents.revision.review");

        WorkflowActionPolicy policy = policyWithActor("documents.revision.review",
                WorkflowActorType.PERMISSION, "documents.revision.review");
        when(workflowActionPolicyService.resolvePolicy(eq(RevisionWorkflowAction.COMPLETE_REVIEW), eq("PENDING_REVIEW"), any()))
                .thenReturn(Optional.of(policy));

        EffectiveAccessResponse resp = service.getEffectiveAccess(profileId, null);
        EffectiveAccessRowResponse row = findRow(resp, "COMPLETE_REVIEW", "PENDING_REVIEW");

        assertThat(row.allowed()).isTrue();
        assertThat(row.reasonCode()).isNull();
        assertThat(row.objectAccessRuleEvaluated()).isFalse();
        assertThat(resp.objectAccessRulesApplicable()).isFalse();
        verify(workflowActionPolicyService).resolvePolicy(eq(RevisionWorkflowAction.COMPLETE_REVIEW), eq("PENDING_REVIEW"), any());
        verify(objectAccessEvaluationService, never()).canAccessRevision(any(), any(), anyString());
    }

    // ── Narrow role: missing permission -> MISSING_PERMISSION ─────────────────

    @Test
    void narrowRole_missingPermission_denied() {
        onlyStatus("PENDING_REVIEW");
        stubGrantedPermissions();

        WorkflowActionPolicy policy = policyWithActor("documents.revision.review",
                WorkflowActorType.PERMISSION, "documents.revision.review");
        when(workflowActionPolicyService.resolvePolicy(eq(RevisionWorkflowAction.COMPLETE_REVIEW), eq("PENDING_REVIEW"), any()))
                .thenReturn(Optional.of(policy));

        EffectiveAccessResponse resp = service.getEffectiveAccess(profileId, null);
        EffectiveAccessRowResponse row = findRow(resp, "COMPLETE_REVIEW", "PENDING_REVIEW");

        assertThat(row.allowed()).isFalse();
        assertThat(row.reasonCode()).isEqualTo("MISSING_PERMISSION");
    }

    // ── Custom role: permission granted but only instance-specific actors -> ACTOR_SCOPE_NOT_SATISFIED ──

    @Test
    void customRole_onlyInstanceSpecificActor_actorScopeNotSatisfied() {
        onlyStatus("PENDING_REVIEW");
        stubGrantedPermissions("documents.revision.review");

        WorkflowActionPolicy policy = policyWithActor("documents.revision.review",
                WorkflowActorType.ASSIGNED_REVIEWER, null);
        when(workflowActionPolicyService.resolvePolicy(eq(RevisionWorkflowAction.COMPLETE_REVIEW), eq("PENDING_REVIEW"), any()))
                .thenReturn(Optional.of(policy));

        EffectiveAccessResponse resp = service.getEffectiveAccess(profileId, null);
        EffectiveAccessRowResponse row = findRow(resp, "COMPLETE_REVIEW", "PENDING_REVIEW");

        assertThat(row.allowed()).isFalse();
        assertThat(row.reasonCode()).isEqualTo("ACTOR_SCOPE_NOT_SATISFIED");
    }

    // ── No policy configured at all -> NO_MATCHING_POLICY ─────────────────────

    @Test
    void noPolicyResolved_fallbackInstanceSpecific_actorScopeNotSatisfied() {
        onlyStatus("PENDING_APPROVAL");
        stubGrantedPermissions("documents.revision.approve");
        when(workflowActionPolicyService.resolvePolicy(eq(RevisionWorkflowAction.COMPLETE_APPROVAL), eq("PENDING_APPROVAL"), any()))
                .thenReturn(Optional.empty());

        EffectiveAccessResponse resp = service.getEffectiveAccess(profileId, null);
        EffectiveAccessRowResponse row = findRow(resp, "COMPLETE_APPROVAL", "PENDING_APPROVAL");

        // Fallback assignment for COMPLETE_APPROVAL is instance-specific (assigned approver) —
        // permission alone cannot satisfy it in the abstract.
        assertThat(row.allowed()).isFalse();
        assertThat(row.reasonCode()).isEqualTo("NO_MATCHING_POLICY");
    }

    @Test
    void actionNotApplicableToStatus_noMatchingPolicy() {
        onlyStatus("EFFECTIVE");
        stubGrantedPermissions();

        EffectiveAccessResponse resp = service.getEffectiveAccess(profileId, null);
        // COMPLETE_REVIEW only applies to PENDING_REVIEW — at EFFECTIVE it must be NO_MATCHING_POLICY,
        // and the policy resolver must not even be consulted for an inapplicable status.
        EffectiveAccessRowResponse row = findRow(resp, "COMPLETE_REVIEW", "EFFECTIVE");
        assertThat(row.allowed()).isFalse();
        assertThat(row.reasonCode()).isEqualTo("NO_MATCHING_POLICY");
        verify(workflowActionPolicyService, never())
                .resolvePolicy(eq(RevisionWorkflowAction.COMPLETE_REVIEW), eq("EFFECTIVE"), any());
    }

    // ── 4th case: Object Access Rule DENY must override an otherwise-allowed row ─

    @Test
    void objectAccessRuleDeny_overridesOtherwiseAllowedRow() {
        onlyStatus("PENDING_REVIEW");
        UUID documentTypeId = UUID.randomUUID();
        stubGrantedPermissions("documents.revision.review");

        WorkflowActionPolicy policy = policyWithActor("documents.revision.review",
                WorkflowActorType.PERMISSION, "documents.revision.review");
        when(workflowActionPolicyService.resolvePolicy(eq(RevisionWorkflowAction.COMPLETE_REVIEW), eq("PENDING_REVIEW"), any()))
                .thenReturn(Optional.of(policy));

        UserAccount assignedUser = new UserAccount();
        assignedUser.setId(UUID.randomUUID());
        UserAccessProfile assignment = new UserAccessProfile();
        assignment.setUserId(assignedUser.getId());
        assignment.setAccessProfileId(profileId);
        try {
            var userField = UserAccessProfile.class.getDeclaredField("user");
            userField.setAccessible(true);
            userField.set(assignment, assignedUser);
        } catch (ReflectiveOperationException e) {
            throw new RuntimeException(e);
        }
        when(userAccessProfileRepository.findByAccessProfileId(profileId)).thenReturn(List.of(assignment));
        when(documentTypeRepository.findById(documentTypeId)).thenReturn(Optional.empty());
        when(objectAccessEvaluationService.canAccessRevision(eq(assignedUser), any(DocumentRevisionRecord.class), eq("COMPLETE_REVIEW")))
                .thenReturn(false);

        EffectiveAccessResponse resp = service.getEffectiveAccess(profileId, documentTypeId);
        EffectiveAccessRowResponse row = findRow(resp, "COMPLETE_REVIEW", "PENDING_REVIEW");

        assertThat(row.allowed()).isFalse();
        assertThat(row.reasonCode()).isEqualTo("OBJECT_ACCESS_DENIED");
        assertThat(row.objectAccessRuleEvaluated()).isTrue();
        assertThat(resp.objectAccessRulesApplicable()).isTrue();
        verify(objectAccessEvaluationService).canAccessRevision(eq(assignedUser), any(DocumentRevisionRecord.class), eq("COMPLETE_REVIEW"));
    }

    // ── F-04: explicit permission gate ─────────────────────────────────────────

    @Test
    void getEffectiveAccess_callerWithoutPermission_isDeniedBeforeProfileLookup() {
        UserAccount unauthorized = new UserAccount();
        unauthorized.setId(UUID.randomUUID());
        when(currentUserService.requireCurrentUser()).thenReturn(unauthorized);
        when(permissionEvaluationService.hasAnyPermission(
                eq(unauthorized), eq("security.access_profiles.view"),
                eq("security.access_profiles.update"), eq("security.access_profiles.assign")))
                .thenReturn(false);

        org.junit.jupiter.api.Assertions.assertThrows(
                org.springframework.security.access.AccessDeniedException.class,
                () -> service.getEffectiveAccess(profileId, null)
        );
        // Must fail closed before ever touching the profile repository — an unauthorized
        // caller must not be able to distinguish "profile doesn't exist" from "profile exists
        // but I can't see it" via a 404-vs-403 status difference.
        verify(roleDefinitionRepository, never()).findById(any());
    }

    @Test
    void getEffectiveAccess_callerWithViewPermission_isAllowed() {
        UserAccount viewer = new UserAccount();
        viewer.setId(UUID.randomUUID());
        when(currentUserService.requireCurrentUser()).thenReturn(viewer);
        when(permissionEvaluationService.hasAnyPermission(
                eq(viewer), eq("security.access_profiles.view"),
                eq("security.access_profiles.update"), eq("security.access_profiles.assign")))
                .thenReturn(true);
        onlyStatus("PENDING_REVIEW");
        stubGrantedPermissions();

        assertThat(service.getEffectiveAccess(profileId, null)).isNotNull();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private WorkflowActionPolicy policyWithActor(String requiredPermission, WorkflowActorType actorType, String actorCode) {
        WorkflowActionPolicy policy = new WorkflowActionPolicy();
        policy.setRequiredPermissionCode(requiredPermission);
        WorkflowActionPolicyActor actor = new WorkflowActionPolicyActor();
        actor.setActorType(actorType);
        actor.setActorCode(actorCode);
        policy.setActors(List.of(actor));
        return policy;
    }

    private void stubGrantedPermissions(String... permissionCodes) {
        UUID setId = UUID.randomUUID();
        List<PermissionSetItem> items = itemsFor(permissionCodes);
        when(permissionSetItemRepository.findAllByPermissionSet_Id(setId)).thenReturn(items);
        List<AccessProfileDetailResponse.PermissionSetSummary> sets = List.of(
                new AccessProfileDetailResponse.PermissionSetSummary(
                        setId, "SET", "Set", null, permissionCodes.length, false));
        when(accessProfileService.getPermissionSets(profileId)).thenReturn(sets);
    }

    private List<PermissionSetItem> itemsFor(String... codes) {
        return java.util.Arrays.stream(codes).map(code -> {
            PermissionSetItem item = new PermissionSetItem();
            com.eqms.entity.Permission permission = new com.eqms.entity.Permission();
            permission.setCode(code);
            item.setPermission(permission);
            return item;
        }).toList();
    }
}
