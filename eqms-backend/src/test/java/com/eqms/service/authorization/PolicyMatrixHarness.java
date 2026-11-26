package com.eqms.service.authorization;

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
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Predicate;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * Checks the policies of one lifecycle against the rules the owner approved, cell by cell: state x permissions held x relations of the actor x scope x action. The engine is the real one; the
 * policies are the real defaults of {@link WorkflowActionDefaultPolicyRegistry}; the required and forbidden relations of each policy are read from the migration that seeds them (so a wrong row in
 * the migration fails); only the facts of the record come from the scenario, through a stand-in adapter. The expected value is written by the test as the rule, never derived from the policies.
 * What the real adapter reads from the database is checked on DEV (and by the adapter's own test where it has one).
 */
public final class PolicyMatrixHarness {
    /** The facts of the cell being checked. */
    public static final class Scenario {
        public String state;
        public Set<String> permissions = new HashSet<>();
        public Set<String> relations = new HashSet<>();
        public boolean inScope;
    }

    @FunctionalInterface
    public interface Rule {
        boolean allowed(String action, String state, Set<String> permissions, Set<String> relations, boolean inScope);
    }

    private PolicyMatrixHarness() {
    }

    private static WorkflowActionPolicyRelation relation(String code, boolean forbidden) {
        AuthorizationRelationDefinition definition = new AuthorizationRelationDefinition();
        definition.setCode(code);
        WorkflowActionPolicyRelation relation = new WorkflowActionPolicyRelation();
        relation.setRelationDefinition(definition);
        relation.setForbidden(forbidden);
        return relation;
    }

    /** (action|from) -> relation rows of an object type, from the relation block of a migration: ('TYPE', 'ACTION', 'FROM', 'CODE', TRUE|FALSE). */
    public static Map<String, List<WorkflowActionPolicyRelation>> relationsOf(String migration, String objectType) throws Exception {
        Map<String, List<WorkflowActionPolicyRelation>> out = new HashMap<>();
        // several migrations may be named, separated by ";": the relation rows of a later one are added to those of the first (a policy a later migration changed)
        for (String path : migration.split(";")) {
            String sql = java.nio.file.Files.readString(java.nio.file.Path.of(path)).replaceAll("\\s+", " ");
            int at = sql.indexOf("INSERT INTO workflow_action_policy_relations");
            if (at < 0) continue;
            Matcher m = Pattern.compile("\\('" + objectType + "', '([A-Z_]+)', '([A-Z_]+)', '([A-Z_]+)', (TRUE|FALSE)\\)").matcher(sql.substring(at));
            while (m.find()) out.computeIfAbsent(m.group(1) + "|" + m.group(2), k -> new ArrayList<>()).add(relation(m.group(3), "TRUE".equals(m.group(4))));
        }
        return out;
    }

    private static UserAccount user(UUID id) {
        UserAccount u = new UserAccount();
        u.setId(id);
        u.setStatus(UserStatus.Active);
        return u;
    }

    private static Set<String> subset(List<String> all, int mask) {
        Set<String> out = new HashSet<>();
        for (int i = 0; i < all.size(); i++) if ((mask & (1 << i)) != 0) out.add(all.get(i));
        return out;
    }

    /**
     * Runs every cell and returns how many were checked.
     *
     * @param unscoped actions that are decided without the department / owner scope (the relation carries the rule), so the scope of the cell is not asked for them
     */
    public static int run(String module, String workflow, String objectType, String migration, List<String> states, List<String> permissions, List<String> relations,
                          List<String> actions, Set<String> unscoped, Rule rule) throws Exception {
        Scenario scenario = new Scenario();
        UUID record = UUID.randomUUID();
        UUID me = UUID.randomUUID();
        ResourceAuthorizationAdapter adapter = new ResourceAuthorizationAdapter() {
            private final WorkflowActionPolicyService policies = policyService();
            private final Map<String, WorkflowActionPolicy> byKey = new HashMap<>();

            @Override public String resourceType() { return objectType; }
            @Override public String resolveState(UUID id) { return scenario.state; }
            @Override public UUID resolveDocumentTypeId(UUID id) { return null; }
            @Override public Optional<ResolvedPolicy> resolvePolicy(String action, String state, UUID documentTypeId) { return resolve(action, state); }
            @Override public Set<String> resolveMatchedRelations(UserAccount actor, UUID id) { return scenario.relations; }
            @Override public boolean isWithinObjectScope(UserAccount actor, UUID id, String action) { return unscoped.contains(action) || scenario.inScope; }

            private WorkflowActionPolicyService policyService() {
                return mock(WorkflowActionPolicyService.class);
            }

            private Optional<ResolvedPolicy> resolve(String action, String state) {
                for (var d : WorkflowActionDefaultPolicyRegistry.allModule()) {
                    if (!d.workflowKey().equals(workflow) || !d.policy().actionCode().equals(action) || !d.policy().fromStatus().equals(state)) continue;
                    List<WorkflowActionPolicyRelation> rows = relationsFor(action, state);
                    List<String> required = rows.stream().filter(r -> !r.isForbidden()).map(r -> r.getRelationDefinition().getCode()).toList();
                    List<String> forbidden = rows.stream().filter(WorkflowActionPolicyRelation::isForbidden).map(r -> r.getRelationDefinition().getCode()).toList();
                    return Optional.of(new ResolvedPolicy(d.policy().requiredPermissionCode(), 1L, required, "ANY", forbidden));
                }
                return Optional.empty();
            }

            private Map<String, List<WorkflowActionPolicyRelation>> cache;

            private List<WorkflowActionPolicyRelation> relationsFor(String action, String state) {
                try {
                    if (cache == null) cache = relationsOf(migration, objectType);
                } catch (Exception e) {
                    throw new IllegalStateException(e);
                }
                return cache.getOrDefault(action + "|" + state, List.of());
            }
        };
        PermissionEvaluationService perms = mock(PermissionEvaluationService.class);
        when(perms.hasPermission(any(), anyString())).thenAnswer(i -> scenario.permissions.contains(i.<String>getArgument(1)));
        AuthorizationEngineService engine = new AuthorizationEngineService(perms, mock(AuthorizationRelationDefinitionRepository.class), mock(UserAccessProfileRepository.class), List.of(adapter));
        UserAccount actor = user(me);
        int cells = 0;
        for (String state : states)
            for (int p = 0; p < (1 << permissions.size()); p++)
                for (int r = 0; r < (1 << relations.size()); r++)
                    for (boolean inScope : new boolean[] {false, true})
                        for (String action : actions) {
                            scenario.state = state;
                            scenario.permissions = subset(permissions, p);
                            scenario.relations = subset(relations, r);
                            scenario.inScope = inScope;
                            boolean allowed = engine.authorize(AuthorizationRequest.of(actor, objectType, record, action)).allowed();
                            assertThat(allowed).as("%s %s in %s perms=%s relations=%s inScope=%s", module, action, state, scenario.permissions, scenario.relations, inScope)
                                    .isEqualTo(rule.allowed(action, state, scenario.permissions, scenario.relations, inScope));
                            cells++;
                        }
        return cells;
    }

    /** The policies of the registry for one workflow, as (action, from, permission, description). */
    public static List<WorkflowActionDefaultPolicyRegistry.ModuleDefault> defaultsOf(String workflow) {
        return WorkflowActionDefaultPolicyRegistry.allModule().stream().filter(d -> d.workflowKey().equals(workflow)).toList();
    }

    /** Every policy of the registry for the workflow is a row of the migration, with the same permission and description. */
    public static void assertMigrationHasThePolicies(String migration, String workflow, String objectType, int expectedCount) throws Exception {
        assertMigrationHasThePolicies(migration, workflow, objectType, expectedCount, Set.of(), "");
    }

    /**
     * {@code changedLater}: "ACTION|FROM" of the policies a later migration changed. The first migration no longer says what the registry says for them, so they are checked against
     * {@code laterMigration}, which must carry the description of the registry.
     */
    public static void assertMigrationHasThePolicies(String migration, String workflow, String objectType, int expectedCount, Set<String> changedLater, String laterMigration) throws Exception {
        String sql = java.nio.file.Files.readString(java.nio.file.Path.of(migration.split(";")[0])).replaceAll("\\s+", " ");
        String later = laterMigration.isEmpty() ? "" : java.nio.file.Files.readString(java.nio.file.Path.of(laterMigration)).replaceAll("\\s+", " ");
        var defaults = defaultsOf(workflow);
        assertThat(defaults).hasSize(expectedCount);
        for (var d : defaults) {
            if (changedLater.contains(d.policy().actionCode() + "|" + d.policy().fromStatus())) {
                assertThat(later).as(workflow + " " + d.policy().actionCode() + " " + d.policy().fromStatus() + " (changed later)").contains(d.policy().description().replace("'", "''"));
                continue;
            }
            String row = "('" + workflow + "', '" + objectType + "', '" + d.policy().actionCode() + "', '" + d.policy().fromStatus() + "', '" + d.policy().requiredPermissionCode() + "', '"
                    + d.policy().description().replace("'", "''") + "')";
            assertThat(sql).as(workflow + " " + d.policy().actionCode() + " " + d.policy().fromStatus()).contains(row);
        }
    }
}
