package com.eqms.service.training;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
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
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * The actions on a training activity as the Hybrid engine decides them, against the rules the owner approved as they are in code (AUTHORIZATION_ACTION_CATALOG_TRAINING_AS_IS_2026_11_18). One engine
 * serves every cell; the scenario (state, permissions held, relations, department scope) is set for each. The expected value is written here as the rule, and the relations of each policy are read
 * from the migration, so a wrong row in the migration fails the test too.
 */
class TrainingActivityAdapterTest {
    private static final UUID ACTIVITY = UUID.randomUUID();
    private static final UUID DEPARTMENT = UUID.randomUUID();
    private static final UUID ME = UUID.randomUUID();
    private static final UUID OTHER = UUID.randomUUID();
    private static final String MIGRATION = "src/main/resources/db/migration/V811__training_activity_in_workflow_authorization.sql";
    private static final String RETIRED_SUPPLEMENTARY = "src/main/resources/db/migration/V842__retire_training_supplementary_before_completed.sql";

    /** The scenario of the cell being checked. */
    private static final class Scenario {
        String state;
        Set<String> permissions = new HashSet<>();
        Set<String> relations = new HashSet<>();
        boolean inScope;
    }

    private final Scenario scenario = new Scenario();

    private static UserAccount user(UUID id) {
        UserAccount u = new UserAccount();
        u.setId(id);
        u.setStatus(UserStatus.Active);
        return u;
    }

    private static WorkflowActionPolicyRelation relation(String code, boolean forbidden) {
        AuthorizationRelationDefinition definition = new AuthorizationRelationDefinition();
        definition.setCode(code);
        WorkflowActionPolicyRelation relation = new WorkflowActionPolicyRelation();
        relation.setRelationDefinition(definition);
        relation.setForbidden(forbidden);
        return relation;
    }

    /** (action|from) -> relation rows, read from the migration. */
    private static Map<String, List<WorkflowActionPolicyRelation>> relationsOfMigration() throws Exception {
        String sql = java.nio.file.Files.readString(java.nio.file.Path.of(MIGRATION)).replaceAll("\\s+", " ");
        String block = sql.substring(sql.indexOf("INSERT INTO workflow_action_policy_relations"));
        Matcher m = Pattern.compile("\\('TRAINING_ACTIVITY', '([A-Z_]+)', '([A-Z_]+)', '([A-Z_]+)', (TRUE|FALSE)\\)").matcher(block);
        Map<String, List<WorkflowActionPolicyRelation>> out = new HashMap<>();
        while (m.find()) out.computeIfAbsent(m.group(1) + "|" + m.group(2), k -> new ArrayList<>()).add(relation(m.group(3), "TRUE".equals(m.group(4))));
        return out;
    }

    private AuthorizationEngineService engine() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class, invocation -> {
            String method = invocation.getMethod().getName();
            Object[] args = invocation.getArguments();
            String sql = String.valueOf(args[0]);
            if (method.equals("queryForObject")) {
                if (sql.contains("trainer_user_id = ?")) return scenario.relations.contains("SENDER") ? 1 : 0;
                return 0;
            }
            if (!method.equals("queryForList")) return null;
            if (sql.startsWith("select status from")) return List.of(scenario.state);
            if (sql.startsWith("select assignee_user_id")) {
                String step = String.valueOf(args[args.length - 1]);
                boolean review = step.equals("CONTENT_REVIEW") && scenario.relations.contains("CONTENT_REVIEW_ASSIGNEE");
                boolean approve = step.equals("CONTENT_APPROVE") && scenario.relations.contains("CONTENT_APPROVE_ASSIGNEE");
                return review || approve ? List.of(ME) : List.of();
            }
            if (sql.startsWith("select confirmed_by")) return scenario.relations.contains("CONTENT_REVIEWER") ? List.of(ME) : List.of();
            Map<String, Object> row = new HashMap<>();
            row.put("organizer_department_id", DEPARTMENT);
            row.put("created_by", scenario.relations.contains("CONTENT_CREATOR") ? ME : OTHER);
            row.put("list_prepared_by", scenario.relations.contains("LIST_PREPARER") ? ME : OTHER);
            return List.of(row);
        });
        TrainingAccess access = mock(TrainingAccess.class);
        when(access.inScope(any(), any())).thenAnswer(i -> scenario.inScope);
        when(access.has(any(), any(String[].class))).thenReturn(false);

        WorkflowActionPolicyService service = mock(WorkflowActionPolicyService.class);
        WorkflowActionPolicyRelationRepository repo = mock(WorkflowActionPolicyRelationRepository.class);
        Map<String, List<WorkflowActionPolicyRelation>> fromMigration = relationsOfMigration();
        for (var d : WorkflowActionDefaultPolicyRegistry.allTraining()) {
            if (!d.workflowKey().equals("TRAINING_ACTIVITY")) continue;
            WorkflowActionPolicy policy = new WorkflowActionPolicy();
            policy.setRequiredPermissionCode(d.policy().requiredPermissionCode());
            UUID id = UUID.randomUUID();
            ReflectionTestUtils.setField(policy, "id", id);
            when(repo.findAllByPolicy_IdAndActiveTrueOrderByPriorityAsc(id)).thenReturn(fromMigration.getOrDefault(d.policy().actionCode() + "|" + d.policy().fromStatus(), List.of()));
            when(service.resolvePolicy(eq("TRAINING"), eq("TRAINING_ACTIVITY"), eq("TRAINING_ACTIVITY"), eq(d.policy().actionCode()), eq(d.policy().fromStatus()), isNull())).thenReturn(Optional.of(policy));
        }
        PermissionEvaluationService perms = mock(PermissionEvaluationService.class);
        when(perms.hasPermission(any(), anyString())).thenAnswer(i -> scenario.permissions.contains(i.<String>getArgument(1)));
        return new AuthorizationEngineService(perms, mock(AuthorizationRelationDefinitionRepository.class), mock(UserAccessProfileRepository.class),
                List.of(new TrainingActivityResourceAdapter(jdbc, access, service, repo)));
    }

    private static final List<String> STATES = List.of("PLANNED", "NOTIFIED", "IN_PROGRESS", "PENDING_QA_CONFIRMATION", "COMPLETED", "CANCELLED");
    private static final List<String> PERMS = List.of("training.activity.organize", "training.content.review", "training.content.approve", "training.activity.close");
    private static final List<String> RELATIONS = List.of("SENDER", "CONTENT_CREATOR", "CONTENT_REVIEWER", "CONTENT_REVIEW_ASSIGNEE", "CONTENT_APPROVE_ASSIGNEE", "LIST_PREPARER");
    private static final Map<String, Set<String>> ORGANIZER_STATES = Map.of(
            "UPDATE", Set.of("PLANNED", "NOTIFIED", "IN_PROGRESS", "PENDING_QA_CONFIRMATION"),
            "ADD_SESSION", Set.of("PLANNED", "NOTIFIED"),
            "ADD_PARTICIPANTS", Set.of("PLANNED"),
            "CONFIRM_LIST", Set.of("PLANNED"),
            "NOTIFY", Set.of("PLANNED"),
            "CANCEL", Set.of("PLANNED", "NOTIFIED", "IN_PROGRESS", "PENDING_QA_CONFIRMATION"),
            "REOPEN_CONTENT", Set.of("PLANNED", "NOTIFIED"),
            "SUPPLEMENTARY", Set.of("COMPLETED"));
    private static final List<String> ACTIONS = List.of("UPDATE", "ADD_SESSION", "ADD_PARTICIPANTS", "CONFIRM_LIST", "NOTIFY", "CANCEL", "REOPEN_CONTENT", "SUPPLEMENTARY",
            "CONTENT_REVIEW", "CONTENT_APPROVE", "SEND_ATTENDANCE_LIST", "FINISH", "CONFIRM_COMPLETION", "RETURN_FOR_CORRECTION");

    /** The rule the owner approved, written once. */
    private static boolean expected(String action, String state, Set<String> perms, Set<String> rel, boolean inScope) {
        if (ORGANIZER_STATES.containsKey(action)) return ORGANIZER_STATES.get(action).contains(state) && perms.contains("training.activity.organize") && inScope;
        boolean planned = state.equals("PLANNED") || state.equals("NOTIFIED");
        switch (action) {
            case "CONTENT_REVIEW":
                return planned && perms.contains("training.content.review") && inScope && rel.contains("CONTENT_REVIEW_ASSIGNEE") && !rel.contains("CONTENT_CREATOR");
            case "CONTENT_APPROVE":
                return planned && perms.contains("training.content.approve") && inScope && rel.contains("CONTENT_APPROVE_ASSIGNEE") && !rel.contains("CONTENT_CREATOR") && !rel.contains("CONTENT_REVIEWER");
            case "SEND_ATTENDANCE_LIST":
            case "FINISH":
                // the trainer, whatever the permissions and the department
                return state.equals("IN_PROGRESS") && rel.contains("SENDER");
            case "CONFIRM_COMPLETION":
            case "RETURN_FOR_CORRECTION":
                return state.equals("PENDING_QA_CONFIRMATION") && perms.contains("training.activity.close") && inScope && !rel.contains("LIST_PREPARER");
            default:
                throw new IllegalArgumentException(action);
        }
    }

    private static Set<String> subset(List<String> all, int mask) {
        Set<String> out = new HashSet<>();
        for (int i = 0; i < all.size(); i++) if ((mask & (1 << i)) != 0) out.add(all.get(i));
        return out;
    }

    @Test
    void everyCellOfTheActivityMatrixIsDecidedAsTheApprovedRulesSay() throws Exception {
        AuthorizationEngineService engine = engine();
        UserAccount me = user(ME);
        int cells = 0;
        for (String state : STATES)
            for (int p = 0; p < (1 << PERMS.size()); p++)
                for (int r = 0; r < (1 << RELATIONS.size()); r++)
                    for (boolean inScope : new boolean[] {false, true})
                        for (String action : ACTIONS) {
                            scenario.state = state;
                            scenario.permissions = subset(PERMS, p);
                            scenario.relations = subset(RELATIONS, r);
                            scenario.inScope = inScope;
                            boolean allowed = engine.authorize(AuthorizationRequest.of(me, "TRAINING_ACTIVITY", ACTIVITY, action)).allowed();
                            assertThat(allowed).as("%s in %s perms=%s relations=%s inScope=%s", action, state, scenario.permissions, scenario.relations, inScope)
                                    .isEqualTo(expected(action, state, scenario.permissions, scenario.relations, inScope));
                            cells++;
                        }
        assertThat(cells).isEqualTo(6 * 16 * 64 * 2 * 14);
    }

    @Test
    void theMigrationAndTheRegistryHaveTheSamePolicies() throws Exception {
        String sql = java.nio.file.Files.readString(java.nio.file.Path.of(MIGRATION)).replaceAll("\\s+", " ");
        var defaults = WorkflowActionDefaultPolicyRegistry.allTraining().stream().filter(d -> d.workflowKey().equals("TRAINING_ACTIVITY")).toList();
        // 26 rows were seeded by V811; V842 retired the two SUPPLEMENTARY rows that start from IN_PROGRESS and PENDING_QA_CONFIRMATION (only a Completed activity gets a supplementary training), so the registry has 24
        assertThat(defaults).hasSize(24);
        assertThat(defaults.stream().filter(d -> d.policy().actionCode().equals("SUPPLEMENTARY")).map(d -> d.policy().fromStatus())).containsExactly("COMPLETED");
        String retired = java.nio.file.Files.readString(java.nio.file.Path.of(RETIRED_SUPPLEMENTARY)).replaceAll("\s+", " ");
        assertThat(retired).contains("action_code = 'SUPPLEMENTARY'").contains("from_status IN ('IN_PROGRESS', 'PENDING_QA_CONFIRMATION')").doesNotContain("'COMPLETED'");
        for (var d : defaults) {
            String row = "('TRAINING_ACTIVITY', 'TRAINING_ACTIVITY', '" + d.policy().actionCode() + "', '" + d.policy().fromStatus() + "', '" + d.policy().requiredPermissionCode() + "', '"
                    + d.policy().description().replace("'", "''") + "')";
            assertThat(sql).as(d.policy().actionCode() + " " + d.policy().fromStatus()).contains(row);
        }
        assertThat(ACTIONS).containsExactlyInAnyOrderElementsOf(defaults.stream().map(d -> d.policy().actionCode()).distinct().toList());
    }

    @Test
    void theTrainerOfASessionActsWithNoPermissionAndNoDepartment_butAPersonWithPermissionsOnlyCannot() throws Exception {
        AuthorizationEngineService engine = engine();
        UserAccount me = user(ME);
        scenario.state = "IN_PROGRESS";
        scenario.inScope = false;
        scenario.permissions = new HashSet<>();
        scenario.relations = new HashSet<>(Set.of("SENDER"));
        assertThat(engine.authorize(AuthorizationRequest.of(me, "TRAINING_ACTIVITY", ACTIVITY, "FINISH")).allowed()).isTrue();
        scenario.relations = new HashSet<>();
        scenario.permissions = new HashSet<>(PERMS);
        scenario.inScope = true;
        assertThat(engine.authorize(AuthorizationRequest.of(me, "TRAINING_ACTIVITY", ACTIVITY, "FINISH")).allowed()).isFalse();
    }
}
