package com.eqms.service.authorization;

import com.eqms.entity.AuthorizationRelationDefinition;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.eqms.repository.AuthorizationRelationDefinitionRepository;
import com.eqms.repository.UserAccessProfileRepository;
import com.eqms.service.PermissionEvaluationService;
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
class AuthorizationEngineServiceTest {

    @Mock private PermissionEvaluationService permissionEvaluationService;
    @Mock private AuthorizationRelationDefinitionRepository relationDefinitionRepository;
    @Mock private UserAccessProfileRepository userAccessProfileRepository;

    private FakeAdapter fakeAdapter;
    private AuthorizationEngineService service;

    private UserAccount activeUser;
    private UUID resourceId;

    /** Minimal test-double adapter, avoids needing a real resource module (none exist yet). */
    private static class FakeAdapter implements ResourceAuthorizationAdapter {
        String state = "DRAFT";
        UUID documentTypeId;
        Set<String> matchedRelations = Set.of();
        boolean withinObjectScope = true;
        ResolvedPolicy policy = new ResolvedPolicy("documents.revision.submit_review", 1L, List.of(), "ANY");
        Optional<String> preconditionFailure = Optional.empty();
        String variant;
        String variantSeenByPolicy = "not called";
        java.util.Map<String, ResolvedPolicy> policyByVariant = new java.util.HashMap<>();

        @Override public String resolveVariant(UUID resourceId) { return variant; }
        @Override public Optional<ResolvedPolicy> resolvePolicy(String actionCode, String state, UUID documentTypeId, String variant) {
            variantSeenByPolicy = variant;
            if (!policyByVariant.isEmpty()) return Optional.ofNullable(policyByVariant.get(variant));
            return resolvePolicy(actionCode, state, documentTypeId);
        }
        @Override public String resourceType() { return "REVISION"; }
        @Override public String resolveState(UUID resourceId) { return state; }
        @Override public UUID resolveDocumentTypeId(UUID resourceId) { return documentTypeId; }
        @Override public Optional<ResolvedPolicy> resolvePolicy(String actionCode, String state, UUID documentTypeId) {
            return Optional.ofNullable(policy);
        }
        @Override public Set<String> resolveMatchedRelations(UserAccount actor, UUID resourceId) { return matchedRelations; }
        @Override public boolean isWithinObjectScope(UserAccount actor, UUID resourceId, String action) { return withinObjectScope; }
        @Override public Optional<String> checkPrecondition(UUID resourceId, String actionCode) { return preconditionFailure; }
    }

    @BeforeEach
    void setUp() {
        activeUser = new UserAccount();
        activeUser.setId(UUID.randomUUID());
        activeUser.setStatus(UserStatus.Active);
        resourceId = UUID.randomUUID();

        fakeAdapter = new FakeAdapter();
        service = new AuthorizationEngineService(
                permissionEvaluationService, relationDefinitionRepository, userAccessProfileRepository, List.of(fakeAdapter));

        lenient().when(permissionEvaluationService.hasPermission(activeUser, "documents.revision.submit_review"))
                .thenReturn(true);
    }

    private AuthorizationRequest request() {
        return AuthorizationRequest.of(activeUser, "REVISION", resourceId, "SUBMIT_FOR_REVIEW");
    }

    @Test
    void authorize_inactiveUser_denied() {
        activeUser.setStatus(UserStatus.Suspended);

        AuthorizationDecision d = service.authorize(request());

        assertThat(d.allowed()).isFalse();
        assertThat(d.reasonCode()).isEqualTo("USER_NOT_ACTIVE");
    }

    @Test
    void authorize_unregisteredResourceType_denied() {
        AuthorizationDecision d = service.authorize(
                AuthorizationRequest.of(activeUser, "CONTROLLED_COPY", resourceId, "VIEW_COPY"));

        assertThat(d.allowed()).isFalse();
        assertThat(d.reasonCode()).isEqualTo("UNSUPPORTED_RESOURCE_TYPE");
    }

    @Test
    void authorize_noPolicyConfigured_denied() {
        fakeAdapter.policy = null;

        AuthorizationDecision d = service.authorize(request());

        assertThat(d.allowed()).isFalse();
        assertThat(d.reasonCode()).isEqualTo("POLICY_NOT_CONFIGURED");
        assertThat(d.resourceState()).isEqualTo("DRAFT");
    }

    @Test
    void authorize_missingPermission_denied() {
        when(permissionEvaluationService.hasPermission(activeUser, "documents.revision.submit_review"))
                .thenReturn(false);

        AuthorizationDecision d = service.authorize(request());

        assertThat(d.allowed()).isFalse();
        assertThat(d.reasonCode()).isEqualTo("MISSING_PERMISSION");
    }

    @Test
    void authorize_outOfObjectScope_denied() {
        fakeAdapter.withinObjectScope = false;

        AuthorizationDecision d = service.authorize(request());

        assertThat(d.allowed()).isFalse();
        assertThat(d.reasonCode()).isEqualTo("OUT_OF_SCOPE");
    }

    @Test
    void authorize_noRelationRequirement_allowed() {
        AuthorizationDecision d = service.authorize(request());

        assertThat(d.allowed()).isTrue();
        assertThat(d.matchedRelations()).isEmpty();
        assertThat(d.matchedPolicyVersion()).isEqualTo(1L);
    }

    @Test
    void authorize_anyRule_actorMatchesNone_denied() {
        fakeAdapter.policy = new ResolvedPolicy("documents.revision.submit_review", 1L, List.of("AUTHOR", "CO_AUTHOR"), "ANY");
        fakeAdapter.matchedRelations = Set.of();

        AuthorizationDecision d = service.authorize(request());

        assertThat(d.allowed()).isFalse();
        assertThat(d.reasonCode()).isEqualTo("ACTOR_NOT_ALLOWED");
    }

    @Test
    void authorize_anyRule_actorMatchesOne_allowed() {
        fakeAdapter.policy = new ResolvedPolicy("documents.revision.submit_review", 1L, List.of("AUTHOR", "CO_AUTHOR"), "ANY");
        fakeAdapter.matchedRelations = Set.of("CO_AUTHOR");

        AuthorizationDecision d = service.authorize(request());

        assertThat(d.allowed()).isTrue();
        assertThat(d.matchedRelations()).containsExactly("CO_AUTHOR");
    }

    @Test
    void authorize_allRule_actorMatchesOnlySome_denied() {
        fakeAdapter.policy = new ResolvedPolicy("documents.revision.submit_review", 1L, List.of("AUTHOR", "CO_AUTHOR"), "ALL");
        fakeAdapter.matchedRelations = Set.of("AUTHOR");

        AuthorizationDecision d = service.authorize(request());

        assertThat(d.allowed()).isFalse();
        assertThat(d.reasonCode()).isEqualTo("ACTOR_NOT_ALLOWED");
    }

    @Test
    void authorize_allRule_actorMatchesEverything_allowed() {
        fakeAdapter.policy = new ResolvedPolicy("documents.revision.submit_review", 1L, List.of("AUTHOR", "CO_AUTHOR"), "ALL");
        fakeAdapter.matchedRelations = Set.of("AUTHOR", "CO_AUTHOR");

        AuthorizationDecision d = service.authorize(request());

        assertThat(d.allowed()).isTrue();
        assertThat(d.matchedRelations()).containsExactlyInAnyOrder("AUTHOR", "CO_AUTHOR");
    }

    @Test
    void authorize_preconditionFails_deniedWithLegacyReasonCode_beforePermissionCheck() {
        fakeAdapter.preconditionFailure = Optional.of("EDITING_NOT_COMPLETED");

        AuthorizationDecision d = service.authorize(request());

        assertThat(d.allowed()).isFalse();
        assertThat(d.reasonCode()).isEqualTo("EDITING_NOT_COMPLETED");
    }

    @Test
    void authorize_permissionResolverRelation_actorHasPermission_allowed() {
        fakeAdapter.policy = new ResolvedPolicy("documents.revision.submit_review", 1L, List.of("PERMISSION_DOCUMENTS_WORKSPACE_MANAGE"), "ANY");
        fakeAdapter.matchedRelations = Set.of();
        AuthorizationRelationDefinition definition = relationDefinition(
                "PERMISSION_DOCUMENTS_WORKSPACE_MANAGE", "PERMISSION_RESOLVER",
                "permissionCode", "documents.workspace.manage");
        when(relationDefinitionRepository.findByCodeAndResourceType("PERMISSION_DOCUMENTS_WORKSPACE_MANAGE", "REVISION"))
                .thenReturn(Optional.of(definition));
        when(permissionEvaluationService.hasPermission(activeUser, "documents.workspace.manage")).thenReturn(true);

        AuthorizationDecision d = service.authorize(request());

        assertThat(d.allowed()).isTrue();
        assertThat(d.matchedRelations()).containsExactly("PERMISSION_DOCUMENTS_WORKSPACE_MANAGE");
    }

    @Test
    void authorize_permissionResolverRelation_actorLacksPermission_denied() {
        fakeAdapter.policy = new ResolvedPolicy("documents.revision.submit_review", 1L, List.of("PERMISSION_DOCUMENTS_WORKSPACE_MANAGE"), "ANY");
        fakeAdapter.matchedRelations = Set.of();
        AuthorizationRelationDefinition definition = relationDefinition(
                "PERMISSION_DOCUMENTS_WORKSPACE_MANAGE", "PERMISSION_RESOLVER",
                "permissionCode", "documents.workspace.manage");
        when(relationDefinitionRepository.findByCodeAndResourceType("PERMISSION_DOCUMENTS_WORKSPACE_MANAGE", "REVISION"))
                .thenReturn(Optional.of(definition));
        when(permissionEvaluationService.hasPermission(activeUser, "documents.workspace.manage")).thenReturn(false);

        AuthorizationDecision d = service.authorize(request());

        assertThat(d.allowed()).isFalse();
        assertThat(d.reasonCode()).isEqualTo("ACTOR_NOT_ALLOWED");
    }

    @Test
    void authorize_accessProfileResolverRelation_actorIsMember_allowed() {
        fakeAdapter.policy = new ResolvedPolicy("documents.revision.submit_review", 1L, List.of("ACCESS_PROFILE_DCO"), "ANY");
        fakeAdapter.matchedRelations = Set.of();
        AuthorizationRelationDefinition definition = relationDefinition(
                "ACCESS_PROFILE_DCO", "ACCESS_PROFILE_RESOLVER", "profileCode", "DCO");
        when(relationDefinitionRepository.findByCodeAndResourceType("ACCESS_PROFILE_DCO", "REVISION"))
                .thenReturn(Optional.of(definition));
        when(userAccessProfileRepository.existsByUserIdAndProfileCode(activeUser.getId(), "DCO")).thenReturn(true);

        AuthorizationDecision d = service.authorize(request());

        assertThat(d.allowed()).isTrue();
        assertThat(d.matchedRelations()).containsExactly("ACCESS_PROFILE_DCO");
    }

    private AuthorizationRelationDefinition relationDefinition(String code, String resolverCode, String configKey, String configValue) {
        AuthorizationRelationDefinition definition = new AuthorizationRelationDefinition();
        definition.setCode(code);
        definition.setResourceType("REVISION");
        definition.setResolverCode(resolverCode);
        definition.setResolverConfig(new ObjectMapper().createObjectNode().put(configKey, configValue));
        return definition;
    }

    @Test
    void authorize_renamingRelationDisplayName_doesNotAffectOutcome() {
        // Rename safety, mirroring the same guarantee already proven for Access Profiles:
        // the match is keyed on the relation's immutable `code`, never a display label.
        fakeAdapter.policy = new ResolvedPolicy("documents.revision.submit_review", 1L, List.of("AUTHOR"), "ANY");
        fakeAdapter.matchedRelations = Set.of("AUTHOR");

        AuthorizationDecision d = service.authorize(request());

        assertThat(d.allowed()).isTrue();
    }

    // ---- 2026-11-18, phase A.2: runtime "a different person" check and the variant of a workflow ----

    @Test
    void authorize_forbiddenRelationHeld_deniedAsSeparationOfDuties() {
        fakeAdapter.policy = new ResolvedPolicy("documents.revision.submit_review", 1L, List.of(), "ANY", List.of("AUTHOR", "SUBMITTER"));
        fakeAdapter.matchedRelations = Set.of("SUBMITTER");

        AuthorizationDecision d = service.authorize(request());

        assertThat(d.allowed()).isFalse();
        assertThat(d.reasonCode()).isEqualTo("SEPARATION_OF_DUTIES");
        assertThat(d.requiredPermission()).isEqualTo("documents.revision.submit_review");
        assertThat(d.resourceState()).isEqualTo("DRAFT");
    }

    @Test
    void authorize_forbiddenRelationNotHeld_allowed() {
        fakeAdapter.policy = new ResolvedPolicy("documents.revision.submit_review", 1L, List.of(), "ANY", List.of("AUTHOR", "SUBMITTER"));
        fakeAdapter.matchedRelations = Set.of("ASSIGNED_APPROVER");

        assertThat(service.authorize(request()).allowed()).isTrue();
    }

    @Test
    void authorize_forbiddenRelationIsCheckedAfterTheRequiredOnes() {
        // a person who lacks the required relation is told so first, not that they are the author
        fakeAdapter.policy = new ResolvedPolicy("documents.revision.submit_review", 1L, List.of("ASSIGNED_APPROVER"), "ANY", List.of("AUTHOR"));
        fakeAdapter.matchedRelations = Set.of("AUTHOR");

        assertThat(service.authorize(request()).reasonCode()).isEqualTo("ACTOR_NOT_ALLOWED");

        fakeAdapter.matchedRelations = Set.of("AUTHOR", "ASSIGNED_APPROVER");
        assertThat(service.authorize(request()).reasonCode()).isEqualTo("SEPARATION_OF_DUTIES");
    }

    @Test
    void authorize_aMissingPermissionStillWinsOverTheForbiddenRelation() {
        fakeAdapter.policy = new ResolvedPolicy("documents.revision.submit_review", 1L, List.of(), "ANY", List.of("AUTHOR"));
        fakeAdapter.matchedRelations = Set.of("AUTHOR");
        when(permissionEvaluationService.hasPermission(activeUser, "documents.revision.submit_review")).thenReturn(false);

        assertThat(service.authorize(request()).reasonCode()).isEqualTo("MISSING_PERMISSION");
    }

    @Test
    void policyWithoutForbiddenRelations_isUnchanged_andTheFourArgumentConstructorMeansNone() {
        assertThat(new ResolvedPolicy("p", 1L, List.of(), "ANY").forbiddenRelationCodes()).isEmpty();
        assertThat(new ResolvedPolicy("p", 1L, null, null, null).forbiddenRelationCodes()).isEmpty();
        fakeAdapter.matchedRelations = Set.of("AUTHOR", "SUBMITTER");
        assertThat(service.authorize(request()).allowed()).isTrue();
    }

    @Test
    void authorize_passesTheVariantOfTheResourceToThePolicyLookup() {
        fakeAdapter.variant = "GMP";
        fakeAdapter.policyByVariant.put("GMP", new ResolvedPolicy("reports.definition.approve_gmp", 3L, List.of(), "ANY"));
        fakeAdapter.policyByVariant.put(null, new ResolvedPolicy("reports.definition.approve", 3L, List.of(), "ANY"));
        when(permissionEvaluationService.hasPermission(activeUser, "reports.definition.approve_gmp")).thenReturn(false);

        AuthorizationDecision gmp = service.authorize(request());

        assertThat(fakeAdapter.variantSeenByPolicy).isEqualTo("GMP");
        assertThat(gmp.allowed()).isFalse();
        assertThat(gmp.requiredPermission()).isEqualTo("reports.definition.approve_gmp");

        fakeAdapter.variant = null;
        when(permissionEvaluationService.hasPermission(activeUser, "reports.definition.approve")).thenReturn(true);
        assertThat(service.authorize(request()).allowed()).isTrue();
        assertThat(fakeAdapter.variantSeenByPolicy).isNull();
    }

    @Test
    void anAdapterWithoutVariants_isAskedWithAnEmptyVariantAndItsThreeArgumentMethodIsUsed() {
        // the default of the interface: resolveVariant is null and the four-argument method calls the three-argument one
        ResourceAuthorizationAdapter plain = new ResourceAuthorizationAdapter() {
            @Override public String resourceType() { return "PLAIN"; }
            @Override public String resolveState(UUID id) { return "X"; }
            @Override public UUID resolveDocumentTypeId(UUID id) { return null; }
            @Override public Optional<ResolvedPolicy> resolvePolicy(String a, String s2, UUID d) { return Optional.of(new ResolvedPolicy("documents.revision.submit_review", 9L, List.of(), "ANY")); }
            @Override public Set<String> resolveMatchedRelations(UserAccount actor, UUID id) { return Set.of(); }
            @Override public boolean isWithinObjectScope(UserAccount actor, UUID id, String action) { return true; }
        };
        assertThat(plain.resolveVariant(resourceId)).isNull();
        AuthorizationEngineService engine = new AuthorizationEngineService(permissionEvaluationService, relationDefinitionRepository, userAccessProfileRepository, List.of(plain));

        AuthorizationDecision d = engine.authorize(AuthorizationRequest.of(activeUser, "PLAIN", resourceId, "ANY_ACTION"));

        assertThat(d.allowed()).isTrue();
        assertThat(d.matchedPolicyVersion()).isEqualTo(9L);
    }
}
