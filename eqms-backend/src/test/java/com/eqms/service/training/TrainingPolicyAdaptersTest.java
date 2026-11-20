package com.eqms.service.training;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.eqms.entity.AuthorizationRelationDefinition;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.entity.WorkflowActionPolicy;
import com.eqms.entity.WorkflowActionPolicyRelation;
import com.eqms.repository.AuthorizationRelationDefinitionRepository;
import com.eqms.repository.UserAccessProfileRepository;
import com.eqms.repository.WorkflowActionPolicyRelationRepository;
import com.eqms.service.PermissionEvaluationService;
import com.eqms.service.WorkflowActionDefaultPolicyRegistry;
import com.eqms.service.WorkflowActionPolicyService;
import com.eqms.service.authorization.AuthorizationEngineService;
import com.eqms.service.authorization.AuthorizationRequest;
import com.eqms.service.authorization.ResourceAuthorizationAdapter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * The Requirement and the Matrix version as the Hybrid engine decides them, against the rules the owner approved as they are in code (AUTHORIZATION_ACTION_CATALOG_TRAINING_AS_IS_2026_11_18).
 * Every cell is checked: state x the permissions held x the actor's relations to the record x department scope x the right to designate x action. The expected value is written here as the rule,
 * not read from the policies, so a wrong policy row fails the test.
 */
class TrainingPolicyAdaptersTest {
    private static final UUID RECORD = UUID.randomUUID();
    private static final UUID DEPARTMENT = UUID.randomUUID();
    private static final UUID ME = UUID.randomUUID();
    private static final UUID OTHER = UUID.randomUUID();

    /** The relations of each policy, as V810 seeds them: (workflow|action|from) -> {required..., forbidden...}. Kept equal to the migration by a test below. */
    private static final Map<String, List<String>> REQUIRED = new HashMap<>();
    private static final Map<String, List<String>> FORBIDDEN = new HashMap<>();

    static {
        String rq = "TRAINING_REQUIREMENT|";
        REQUIRED.put(rq + "REVIEW|PENDING_REVIEW", List.of("REVIEW_ASSIGNEE"));
        FORBIDDEN.put(rq + "REVIEW|PENDING_REVIEW", List.of("PREPARER"));
        REQUIRED.put(rq + "REJECT|PENDING_REVIEW", List.of("REVIEW_ASSIGNEE"));
        FORBIDDEN.put(rq + "REJECT|PENDING_REVIEW", List.of("PREPARER"));
        REQUIRED.put(rq + "APPROVE|PENDING_APPROVAL", List.of("APPROVAL_ASSIGNEE"));
        FORBIDDEN.put(rq + "APPROVE|PENDING_APPROVAL", List.of("PREPARER", "REVIEWED_BY", "REVIEW_ASSIGNEE"));
        REQUIRED.put(rq + "REJECT|PENDING_APPROVAL", List.of("APPROVAL_ASSIGNEE"));
        FORBIDDEN.put(rq + "REJECT|PENDING_APPROVAL", List.of("PREPARER", "REVIEWED_BY", "REVIEW_ASSIGNEE"));
        String mx = "TRAINING_MATRIX|";
        REQUIRED.put(mx + "APPROVE|PENDING_APPROVAL", List.of("APPROVAL_ASSIGNEE"));
        FORBIDDEN.put(mx + "APPROVE|PENDING_APPROVAL", List.of("PREPARER"));
        REQUIRED.put(mx + "REJECT|PENDING_APPROVAL", List.of("APPROVAL_ASSIGNEE"));
        FORBIDDEN.put(mx + "REJECT|PENDING_APPROVAL", List.of("PREPARER"));
    }

    private static UserAccount user(UUID id) {
        UserAccount u = new UserAccount();
        u.setId(id);
        u.setStatus(UserStatus.Active);
        return u;
    }

    /** A JdbcTemplate that answers the few queries the adapters make, from the scenario. */
    private static JdbcTemplate jdbc(String table, String state, Set<String> relations, boolean matrix) {
        return mock(JdbcTemplate.class, invocation -> {
            if (!invocation.getMethod().getName().equals("queryForList")) return null;
            Object[] args = invocation.getArguments();
            String sql = String.valueOf(args[0]);
            if (sql.startsWith("select status from")) return List.of(state);
            if (sql.startsWith("select assignee_user_id")) {
                String step = String.valueOf(args[args.length - 1]);
                boolean review = step.equals("REQUIREMENT_REVIEW") && relations.contains("REVIEW_ASSIGNEE");
                boolean approve = (step.equals("REQUIREMENT_APPROVE") || step.equals("MATRIX_APPROVE")) && relations.contains("APPROVAL_ASSIGNEE");
                return review || approve ? List.of(ME) : List.of();
            }
            Map<String, Object> row = new HashMap<>();
            row.put("department_id", DEPARTMENT);
            row.put("prepared_by", relations.contains("PREPARER") ? ME : OTHER);
            if (!matrix) row.put("reviewed_by", relations.contains("REVIEWED_BY") ? ME : OTHER);
            return List.of(row);
        });
    }

    /** Builds the engine for one scenario. The policies are looked up by (action, state), and each is given the relations of the table above. */
    private AuthorizationEngineService engine(String workflow, String type, String state, Set<String> relationsHeld, Set<String> permissions, boolean inScope, boolean mayDesignate) {
        JdbcTemplate jdbc = jdbc(type, state, relationsHeld, type.equals("TRAINING_MATRIX_VERSION"));
        TrainingAccess access = mock(TrainingAccess.class);
        when(access.inScope(any(), any())).thenReturn(inScope);
        when(access.has(any(), any(String[].class))).thenReturn(mayDesignate);

        WorkflowActionPolicyService service = mock(WorkflowActionPolicyService.class);
        WorkflowActionPolicyRelationRepository repo = mock(WorkflowActionPolicyRelationRepository.class);
        for (var d : WorkflowActionDefaultPolicyRegistry.allTraining()) {
            if (!d.workflowKey().equals(workflow)) continue;
            WorkflowActionPolicy policy = new WorkflowActionPolicy();
            policy.setRequiredPermissionCode(d.policy().requiredPermissionCode());
            UUID id = UUID.randomUUID();
            org.springframework.test.util.ReflectionTestUtils.setField(policy, "id", id);
            String key = workflow + "|" + d.policy().actionCode() + "|" + d.policy().fromStatus();
            List<WorkflowActionPolicyRelation> rows = new ArrayList<>();
            for (String code : REQUIRED.getOrDefault(key, List.of())) rows.add(relation(code, false));
            for (String code : FORBIDDEN.getOrDefault(key, List.of())) rows.add(relation(code, true));
            when(repo.findAllByPolicy_IdAndActiveTrueOrderByPriorityAsc(id)).thenReturn(rows);
            when(service.resolvePolicy(eq("TRAINING"), eq(workflow), eq(d.objectType()), eq(d.policy().actionCode()), eq(d.policy().fromStatus()), isNull())).thenReturn(Optional.of(policy));
        }
        ResourceAuthorizationAdapter adapter = type.equals("TRAINING_REQUIREMENT")
                ? new TrainingRequirementResourceAdapter(jdbc, access, service, repo)
                : new TrainingMatrixResourceAdapter(jdbc, access, service, repo);
        PermissionEvaluationService perms = mock(PermissionEvaluationService.class);
        when(perms.hasPermission(any(), org.mockito.ArgumentMatchers.anyString())).thenAnswer(i -> permissions.contains(i.<String>getArgument(1)));
        return new AuthorizationEngineService(perms, mock(AuthorizationRelationDefinitionRepository.class), mock(UserAccessProfileRepository.class), List.of(adapter));
    }

    private static WorkflowActionPolicyRelation relation(String code, boolean forbidden) {
        AuthorizationRelationDefinition definition = new AuthorizationRelationDefinition();
        definition.setCode(code);
        WorkflowActionPolicyRelation relation = new WorkflowActionPolicyRelation();
        relation.setRelationDefinition(definition);
        relation.setForbidden(forbidden);
        return relation;
    }

    private static Set<String> subset(List<String> all, int mask) {
        Set<String> out = new HashSet<>();
        for (int i = 0; i < all.size(); i++) if ((mask & (1 << i)) != 0) out.add(all.get(i));
        return out;
    }

    private static final List<String> REQ_RELATIONS = List.of("PREPARER", "REVIEWED_BY", "REVIEW_ASSIGNEE", "APPROVAL_ASSIGNEE");
    private static final List<String> REQ_PERMS = List.of("training.requirement.prepare", "training.requirement.review", "training.requirement.approve");

    /** The rule the owner approved, for a requirement. */
    private static boolean expectedRequirement(String action, String state, Set<String> perms, Set<String> rel, boolean inScope, boolean designate) {
        if (!inScope) return false;
        boolean preparerSteps = action.equals("SUBMIT");
        switch (action) {
            case "SUBMIT":
                return state.equals("DRAFT") && perms.contains("training.requirement.prepare") && designate;
            case "REVIEW":
                return state.equals("PENDING_REVIEW") && perms.contains("training.requirement.review") && designate && rel.contains("REVIEW_ASSIGNEE") && !rel.contains("PREPARER");
            case "APPROVE":
                return state.equals("PENDING_APPROVAL") && perms.contains("training.requirement.approve") && rel.contains("APPROVAL_ASSIGNEE")
                        && !rel.contains("PREPARER") && !rel.contains("REVIEWED_BY") && !rel.contains("REVIEW_ASSIGNEE");
            case "REJECT":
                if (state.equals("PENDING_REVIEW")) return perms.contains("training.requirement.review") && rel.contains("REVIEW_ASSIGNEE") && !rel.contains("PREPARER");
                if (state.equals("PENDING_APPROVAL")) return perms.contains("training.requirement.approve") && rel.contains("APPROVAL_ASSIGNEE")
                        && !rel.contains("PREPARER") && !rel.contains("REVIEWED_BY") && !rel.contains("REVIEW_ASSIGNEE");
                return false;
            default:
                return preparerSteps;
        }
    }

    @Test
    void everyCellOfTheRequirementMatrixIsDecidedAsTheApprovedRulesSay() {
        int cells = 0;
        for (String state : List.of("DRAFT", "PENDING_REVIEW", "PENDING_APPROVAL", "APPROVED"))
            for (int permMask = 0; permMask < 8; permMask++)
                for (int relMask = 0; relMask < 16; relMask++)
                    for (boolean inScope : new boolean[] {false, true})
                        for (boolean designate : new boolean[] {false, true})
                            for (String action : List.of("SUBMIT", "REVIEW", "APPROVE", "REJECT")) {
                                Set<String> perms = subset(REQ_PERMS, permMask);
                                Set<String> rel = subset(REQ_RELATIONS, relMask);
                                var decision = engine("TRAINING_REQUIREMENT", "TRAINING_REQUIREMENT", state, rel, perms, inScope, designate)
                                        .authorize(AuthorizationRequest.of(user(ME), "TRAINING_REQUIREMENT", RECORD, action));
                                assertThat(decision.allowed()).as("%s in %s perms=%s relations=%s inScope=%s designate=%s", action, state, perms, rel, inScope, designate)
                                        .isEqualTo(expectedRequirement(action, state, perms, rel, inScope, designate));
                                cells++;
                            }
        assertThat(cells).isEqualTo(4 * 8 * 16 * 2 * 2 * 4);
    }

    private static final List<String> MX_RELATIONS = List.of("PREPARER", "APPROVAL_ASSIGNEE");
    private static final List<String> MX_PERMS = List.of("training.matrix.manage", "training.matrix.approve");

    private static boolean expectedMatrix(String action, String state, Set<String> perms, Set<String> rel, boolean inScope, boolean designate) {
        if (!inScope) return false;
        if (action.equals("SUBMIT")) return state.equals("DRAFT") && perms.contains("training.matrix.manage") && designate;
        return state.equals("PENDING_APPROVAL") && perms.contains("training.matrix.approve") && rel.contains("APPROVAL_ASSIGNEE") && !rel.contains("PREPARER");
    }

    @Test
    void everyCellOfTheMatrixVersionMatrixIsDecidedAsTheApprovedRulesSay() {
        int cells = 0;
        for (String state : List.of("DRAFT", "PENDING_APPROVAL", "EFFECTIVE", "OBSOLETED"))
            for (int permMask = 0; permMask < 4; permMask++)
                for (int relMask = 0; relMask < 4; relMask++)
                    for (boolean inScope : new boolean[] {false, true})
                        for (boolean designate : new boolean[] {false, true})
                            for (String action : List.of("SUBMIT", "APPROVE", "REJECT")) {
                                Set<String> perms = subset(MX_PERMS, permMask);
                                Set<String> rel = subset(MX_RELATIONS, relMask);
                                var decision = engine("TRAINING_MATRIX", "TRAINING_MATRIX_VERSION", state, rel, perms, inScope, designate)
                                        .authorize(AuthorizationRequest.of(user(ME), "TRAINING_MATRIX_VERSION", RECORD, action));
                                assertThat(decision.allowed()).as("%s in %s perms=%s relations=%s inScope=%s designate=%s", action, state, perms, rel, inScope, designate)
                                        .isEqualTo(expectedMatrix(action, state, perms, rel, inScope, designate));
                                cells++;
                            }
        assertThat(cells).isEqualTo(4 * 4 * 4 * 2 * 2 * 3);
    }

    @Test
    void theMigrationSaysWhatTheRegistryAndTheRelationTableSay() throws Exception {
        String migration = java.nio.file.Files.readString(java.nio.file.Path.of("src/main/resources/db/migration/V810__training_requirement_and_matrix_in_workflow_authorization.sql"));
        var requirementAndMatrix = WorkflowActionDefaultPolicyRegistry.allTraining().stream().filter(d -> !d.workflowKey().equals("TRAINING_ACTIVITY")).toList();
        assertThat(requirementAndMatrix).hasSize(8);
        for (var d : requirementAndMatrix) {
            String row = "('" + d.objectType() + "', '" + d.objectType() + "', '" + d.policy().actionCode() + "',";
            String rowMatrix = "('" + d.workflowKey() + "',      '" + d.objectType() + "', '" + d.policy().actionCode() + "',";
            assertThat(migration.contains(row) || migration.contains(rowMatrix) || migration.contains("('" + d.workflowKey() + "', '" + d.objectType() + "', '" + d.policy().actionCode() + "',"))
                    .as(d.workflowKey() + " " + d.policy().actionCode() + " " + d.policy().fromStatus()).isTrue();
            assertThat(migration).contains("'" + d.policy().requiredPermissionCode() + "'").contains(d.policy().description());
        }
        // every relation of the table above is a row of the migration
        REQUIRED.forEach((key, codes) -> codes.forEach(code -> assertThat(relationRow(migration, key, code, false)).as("required " + key + " " + code).isTrue()));
        FORBIDDEN.forEach((key, codes) -> codes.forEach(code -> assertThat(relationRow(migration, key, code, true)).as("forbidden " + key + " " + code).isTrue()));
    }

    private static boolean relationRow(String migration, String key, String code, boolean forbidden) {
        String[] parts = key.split("\\|");
        String objectType = parts[0].equals("TRAINING_MATRIX") ? "TRAINING_MATRIX_VERSION" : parts[0];
        String normalized = migration.replaceAll("\\s+", " ");
        return normalized.contains("('" + objectType + "', '" + parts[1] + "', '" + parts[2] + "', '" + code + "', " + (forbidden ? "TRUE" : "FALSE") + ")")
                || normalized.contains("('" + objectType + "', '" + parts[1] + "', '" + parts[2] + "', '" + code + "', " + (forbidden ? "TRUE" : "FALSE") + "),");
    }

    @Test
    void theGateFailsClosed_noEngine_noStep() {
        TrainingShadow gate = new TrainingShadow(null);   // no engine at all: the step must not run
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> gate.around(user(ME), "TRAINING_RECORD", RECORD, "VOID", true, () -> "done"))
                .isInstanceOf(IllegalStateException.class);
    }
}
