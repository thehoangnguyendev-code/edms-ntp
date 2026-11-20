package com.eqms.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.eqms.entity.UserAccount;
import com.eqms.entity.AuthorizationRelationDefinition;
import com.eqms.entity.UserStatus;
import com.eqms.entity.WorkflowActionPolicy;
import com.eqms.entity.WorkflowActionPolicyRelation;
import com.eqms.repository.WorkflowActionPolicyRelationRepository;
import com.eqms.repository.AuthorizationRelationDefinitionRepository;
import com.eqms.repository.UserAccessProfileRepository;
import com.eqms.service.authorization.AuthorizationDecision;
import com.eqms.service.authorization.AuthorizationEngineService;
import com.eqms.service.authorization.AuthorizationRequest;
import com.eqms.service.report.ReportTemplateRevisionService;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * The review of a report template (approve, reject) as the Hybrid engine decides it, against the rules the owner approved as they are in code
 * (AUTHORIZATION_ACTION_CATALOG_REPORT_AS_IS_2026_11_18): pending state, the GMP variant needs the GMP approval permission, and the reviewer is neither the author nor the submitter.
 * Every cell of the matrix is checked: state x GMP (live, or made so by the revision under review) x permission held x relation to the version, through both ways a template is reviewed
 * (the template itself, or its open revision when a revision is effective).
 */
class ReportTemplateResourceAdapterTest {
    private static final String CODE = "DOCUMENT_STATUS";
    private static final UUID ID = ReportTemplateResourceAdapter.idOf(CODE);
    private static final UUID AUTHOR = UUID.randomUUID();
    private static final UUID SUBMITTER = UUID.randomUUID();
    private static final UUID OTHER = UUID.randomUUID();

    private record Scenario(boolean throughRevision, String state, boolean liveGmp, boolean revisionMakesGmp) {}

    private UserAccount user(UUID id) {
        UserAccount u = new UserAccount();
        u.setId(id);
        u.setStatus(UserStatus.Active);
        return u;
    }

    private AuthorizationEngineService engine(Scenario s, UserAccount actor, boolean holdsApprove, boolean holdsApproveGmp) {
        java.util.Set<String> held = new java.util.HashSet<>();
        if (holdsApprove) held.add("reports.definition.approve");
        if (holdsApproveGmp) held.add("reports.definition.approve_gmp");
        return engine(s, actor, held);
    }

    private AuthorizationEngineService engine(Scenario s, UserAccount actor, java.util.Set<String> held) {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        ReportTemplateRevisionService revisions = mock(ReportTemplateRevisionService.class);
        when(jdbc.queryForList("select code from report_definitions", String.class)).thenReturn(List.of("OTHER_TEMPLATE", CODE));
        Map<String, Object> row = new HashMap<>();
        row.put("active", true);
        row.put("deleted_at", null);
        row.put("approval_status", s.throughRevision() ? "APPROVED" : s.state());
        row.put("submitted_version", s.throughRevision() ? null : 4);
        row.put("submitted_by_user_id", s.throughRevision() ? null : SUBMITTER);
        row.put("gmp_use", s.liveGmp());
        when(jdbc.queryForList(contains("from report_definitions where code=?"), eq(CODE))).thenReturn(List.of(row));
        when(jdbc.queryForList(contains("report_definition_versions"), eq(String.class), eq(CODE), anyInt())).thenReturn(List.of(AUTHOR.toString()));
        if (s.throughRevision()) {
            Map<String, Object> open = new HashMap<>();
            open.put("snapshot", "{}");
            open.put("status", s.state());
            open.put("submitted_by_user_id", SUBMITTER);
            open.put("last_changed_by_user_id", AUTHOR);
            when(revisions.effective(CODE)).thenReturn(Map.of("status", "EFFECTIVE"));
            when(revisions.open(CODE)).thenReturn(open);
            when(revisions.payloadOf(open)).thenReturn(Map.of("gmpUse", s.revisionMakesGmp()));
        }
        PermissionEvaluationService permissions = mock(PermissionEvaluationService.class);
        when(permissions.hasPermission(eq(actor), anyString())).thenAnswer(invocation -> held.contains(invocation.<String>getArgument(1)));
        return new AuthorizationEngineService(permissions, mock(AuthorizationRelationDefinitionRepository.class), mock(UserAccessProfileRepository.class),
                List.of(new ReportTemplateResourceAdapter(jdbc, revisions, seededPolicies(), forbiddenAuthorAndSubmitter())));
    }

    /** The four policies V807 seeds, as Workflow Authorization would hand them over (what the registry of defaults says; a test below keeps the migration and the registry equal). */
    private static WorkflowActionPolicyService seededPolicies() {
        WorkflowActionPolicyService policies = mock(WorkflowActionPolicyService.class);
        for (var d : WorkflowActionDefaultPolicyRegistry.allReportTemplate()) {
            WorkflowActionPolicy policy = new WorkflowActionPolicy();
            policy.setModuleKey("REPORT");
            policy.setWorkflowKey("REPORT_TEMPLATE");
            policy.setObjectType("REPORT_TEMPLATE");
            policy.setActionCode(d.actionCode());
            policy.setFromStatus(d.fromStatus());
            policy.setRequiredPermissionCode(d.requiredPermissionCode());
            when(policies.resolvePolicy(eq("REPORT"), eq("REPORT_TEMPLATE"), eq("REPORT_TEMPLATE"), eq(d.actionCode()), eq(d.fromStatus()), isNull())).thenReturn(Optional.of(policy));
        }
        return policies;
    }

    private static WorkflowActionPolicyRelationRepository forbiddenAuthorAndSubmitter() {
        WorkflowActionPolicyRelationRepository repository = mock(WorkflowActionPolicyRelationRepository.class);
        List<WorkflowActionPolicyRelation> relations = new java.util.ArrayList<>();
        for (String code : List.of("AUTHOR", "SUBMITTER")) {
            AuthorizationRelationDefinition definition = new AuthorizationRelationDefinition();
            definition.setCode(code);
            WorkflowActionPolicyRelation relation = new WorkflowActionPolicyRelation();
            relation.setRelationDefinition(definition);
            relation.setForbidden(true);
            relations.add(relation);
        }
        // only the review policies forbid the author and the submitter; the policies of the other actions have no relation (their ids are null here, so the stub answers for every policy)
        when(repository.findAllByPolicy_IdAndActiveTrueOrderByPriorityAsc(any())).thenReturn(relations);
        return repository;
    }

    /** What the owner approved, written out once: the rule, not the code. */
    private static boolean expectedAllowed(Scenario s, boolean holdsApprove, boolean holdsApproveGmp, UUID actorId) {
        boolean gmp = s.liveGmp() || (s.throughRevision() && s.revisionMakesGmp());
        boolean pending = "PENDING_APPROVAL".equals(s.state());
        boolean permission = gmp ? holdsApproveGmp : holdsApprove;
        boolean different = !actorId.equals(AUTHOR) && !actorId.equals(SUBMITTER);
        return pending && permission && different;
    }

    @Test
    void everyCellOfTheMatrixIsDecidedAsTheApprovedRulesSay() {
        int cells = 0;
        for (boolean throughRevision : new boolean[] {false, true})
            for (String state : new String[] {"PENDING_APPROVAL", "DRAFT"})
                for (boolean liveGmp : new boolean[] {false, true})
                    for (boolean revisionMakesGmp : new boolean[] {false, true})
                        for (boolean approve : new boolean[] {false, true})
                            for (boolean approveGmp : new boolean[] {false, true})
                                for (UUID actorId : new UUID[] {OTHER, AUTHOR, SUBMITTER})
                                    for (String action : new String[] {"APPROVE", "REJECT"}) {
                                        Scenario s = new Scenario(throughRevision, state, liveGmp, revisionMakesGmp);
                                        UserAccount actor = user(actorId);
                                        AuthorizationDecision d = engine(s, actor, approve, approveGmp).authorize(AuthorizationRequest.of(actor, "REPORT_TEMPLATE", ID, action));
                                        assertThat(d.allowed()).as("%s %s through revision=%s liveGmp=%s revisionGmp=%s approve=%s approveGmp=%s actor=%s", action, state, throughRevision, liveGmp,
                                                revisionMakesGmp, approve, approveGmp, actorId.equals(OTHER) ? "other" : actorId.equals(AUTHOR) ? "author" : "submitter")
                                                .isEqualTo(expectedAllowed(s, approve, approveGmp, actorId));
                                        cells++;
                                    }
        assertThat(cells).isEqualTo(2 * 2 * 2 * 2 * 2 * 2 * 3 * 2);
    }

    @Test
    void theReasonsAreInTheOrderOfTheEngine_state_thenPermission_thenAnotherPerson() {
        UserAccount other = user(OTHER);
        UserAccount author = user(AUTHOR);
        assertThat(engine(new Scenario(false, "DRAFT", false, false), other, true, true).authorize(AuthorizationRequest.of(other, "REPORT_TEMPLATE", ID, "APPROVE")).reasonCode())
                .isEqualTo("POLICY_NOT_CONFIGURED");
        assertThat(engine(new Scenario(false, "PENDING_APPROVAL", true, false), other, true, false).authorize(AuthorizationRequest.of(other, "REPORT_TEMPLATE", ID, "APPROVE")).reasonCode())
                .isEqualTo("MISSING_PERMISSION");
        AuthorizationDecision byAuthor = engine(new Scenario(false, "PENDING_APPROVAL", false, false), author, true, true).authorize(AuthorizationRequest.of(author, "REPORT_TEMPLATE", ID, "APPROVE"));
        assertThat(byAuthor.reasonCode()).isEqualTo("SEPARATION_OF_DUTIES");
        assertThat(byAuthor.requiredPermission()).isEqualTo("reports.definition.approve");
    }

    @Test
    void aGmpTemplateAsksForTheGmpPermission_andAnOrdinaryOneForTheOrdinaryPermission() {
        UserAccount other = user(OTHER);
        assertThat(engine(new Scenario(false, "PENDING_APPROVAL", true, false), other, true, false).authorize(AuthorizationRequest.of(other, "REPORT_TEMPLATE", ID, "APPROVE")).requiredPermission())
                .isEqualTo("reports.definition.approve_gmp");
        assertThat(engine(new Scenario(true, "PENDING_APPROVAL", false, true), other, true, false).authorize(AuthorizationRequest.of(other, "REPORT_TEMPLATE", ID, "REJECT")).requiredPermission())
                .as("a revision under review that makes the template GMP is reviewed as GMP").isEqualTo("reports.definition.approve_gmp");
        assertThat(engine(new Scenario(false, "PENDING_APPROVAL", false, false), other, true, false).authorize(AuthorizationRequest.of(other, "REPORT_TEMPLATE", ID, "APPROVE")).requiredPermission())
                .isEqualTo("reports.definition.approve");
    }

    @Test
    void anActionOfTheCatalogThatIsNotInTheEngineYetIsDeniedAndAnUnknownTemplateHasNoState() {
        UserAccount other = user(OTHER);
        assertThat(engine(new Scenario(false, "PENDING_APPROVAL", false, false), other, true, true).authorize(AuthorizationRequest.of(other, "REPORT_TEMPLATE", ID, "RUN")).reasonCode())
                .isEqualTo("POLICY_NOT_CONFIGURED");
        assertThat(engine(new Scenario(false, "PENDING_APPROVAL", false, false), other, true, true).authorize(AuthorizationRequest.of(other, "REPORT_TEMPLATE", UUID.randomUUID(), "APPROVE")).allowed())
                .isFalse();
    }

    @Test
    void theMigrationsThatSeedThePoliciesSayWhatTheRegistryOfDefaultsSays() throws Exception {
        String review = java.nio.file.Files.readString(java.nio.file.Path.of("src/main/resources/db/migration/V807__report_template_review_in_workflow_authorization.sql"));
        String lifecycle = java.nio.file.Files.readString(java.nio.file.Path.of("src/main/resources/db/migration/V809__report_template_lifecycle_actions_in_workflow_authorization.sql"));
        assertThat(WorkflowActionDefaultPolicyRegistry.allReportTemplate()).hasSize(9);
        for (var d : WorkflowActionDefaultPolicyRegistry.allReportTemplate()) {
            boolean isReview = d.fromStatus().equals("PENDING_APPROVAL");
            String migration = isReview ? review : lifecycle;
            assertThat(migration).as(d.actionCode()).contains("('" + d.actionCode() + "',").contains("'" + d.requiredPermissionCode() + "'");
            assertThat(migration).as("the description a screen shows is the one the migration seeds").contains(d.description().replace("'", "''"));
        }
        assertThat(review).contains("forbidden").contains("'AUTHOR', 'SUBMITTER'");
        assertThat(lifecycle).doesNotContain("DELETE_GMP',");
    }

    /** The other actions: decided by permission whatever the state; a GMP template is never deleted because no DELETE_GMP policy exists. */
    @Test
    void theLifecycleActionsAreDecidedByPermission_andAGmpTemplateCannotBeDeleted() {
        for (String action : ReportTemplateResourceAdapter.LIFECYCLE_ACTIONS) {
            String permission = WorkflowActionDefaultPolicyRegistry.get("REPORT_TEMPLATE", action, "ANY").requiredPermissionCode();
            for (boolean holds : new boolean[] {false, true}) {
                UserAccount actor = user(OTHER);
                var engine = engine(new Scenario(false, "DRAFT", false, false), actor, holds ? java.util.Set.of(permission) : java.util.Set.<String>of());
                var decision = engine.authorize(AuthorizationRequest.of(actor, "REPORT_TEMPLATE", ID, action));
                if (action.equals("DELETE")) {
                    // an ordinary template: the permission decides
                    assertThat(decision.allowed()).as(action + " ordinary holds=" + holds).isEqualTo(holds);
                }
                assertThat(decision.allowed()).as(action + " holds=" + holds).isEqualTo(holds);
            }
        }
        UserAccount actor = user(OTHER);
        var gmp = engine(new Scenario(false, "APPROVED", true, false), actor, true, true).authorize(AuthorizationRequest.of(actor, "REPORT_TEMPLATE", ID, "DELETE"));
        assertThat(gmp.allowed()).isFalse();
        assertThat(gmp.reasonCode()).isEqualTo("POLICY_NOT_CONFIGURED");
        var gmpSubmit = engine(new Scenario(false, "DRAFT", true, false), actor, java.util.Set.of("reports.definition.manage")).authorize(AuthorizationRequest.of(actor, "REPORT_TEMPLATE", ID, "SUBMIT"));
        assertThat(gmpSubmit.allowed()).as("a GMP template is submitted like any other: the variant only matters for a review and a deletion").isTrue();
    }


    @Test
    void theRegistryOfWorkflowsListsTheReviewOfAReportTemplateAsAModuleOfItsOwn() {
        var definitions = new com.eqms.service.workflow.ReportWorkflowDefinitionProvider().getWorkflowDefinitions();
        assertThat(definitions).hasSize(1);
        var definition = definitions.getFirst();
        assertThat(definition.moduleKey()).isEqualTo("REPORT");
        assertThat(definition.workflowKey()).isEqualTo("REPORT_TEMPLATE");
        assertThat(definition.actions()).extracting(a -> a.actionCode()).containsExactlyInAnyOrder("APPROVE", "APPROVE_GMP", "REJECT", "REJECT_GMP", "SUBMIT", "UPGRADE", "SET_ENABLED", "DISCARD_REVISION", "DELETE");
        assertThat(definition.actions()).allSatisfy(a -> {
            assertThat(a.objectType()).isEqualTo("REPORT_TEMPLATE");
            assertThat(a.defaultFromStatuses()).hasSize(1);
        });
    }
}
