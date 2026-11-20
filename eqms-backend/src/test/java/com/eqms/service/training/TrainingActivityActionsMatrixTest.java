package com.eqms.service.training;

import static org.assertj.core.api.Assertions.assertThat;

import com.eqms.service.authorization.PolicyMatrixHarness;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

/**
 * The rest of the actions of a training activity (V816) as the Hybrid engine decides them: every cell of state x permissions x relations x scope x action against the rule of TrainingActivityService as it
 * has always been (a conductor holds the permission to conduct or to organize; the department limits every action).
 */
class TrainingActivityActionsMatrixTest {
    private static final String MIGRATION = "src/main/resources/db/migration/V816__training_activity_sessions_and_results_in_workflow_authorization.sql";

    @Test
    void theSessionsTheResultsAndTheApproversOfAnActivity() throws Exception {
        // the registry of defaults holds the policies of V811 and of V816 for this workflow: every one of V816 is a row of its migration, with the same permission and description
        String sql = java.nio.file.Files.readString(java.nio.file.Path.of(MIGRATION)).replaceAll("\s+", " ");
        Set<String> mine = Set.of("HOLD_SESSION", "RECORD_ATTENDANCE", "POSTPONE_SESSION", "UPDATE_SESSION", "SET_CONTENT_EXEMPTIONS", "RECORD_ASSESSMENT", "DESIGNATE");
        var defaults = PolicyMatrixHarness.defaultsOf("TRAINING_ACTIVITY").stream().filter(d -> mine.contains(d.policy().actionCode())).toList();
        assertThat(defaults).hasSize(12);
        for (var d : defaults) {
            assertThat(sql).contains("('TRAINING_ACTIVITY', 'TRAINING_ACTIVITY', '" + d.policy().actionCode() + "', '" + d.policy().fromStatus() + "', '" + d.policy().requiredPermissionCode() + "', '"
                    + d.policy().description().replace("'", "''") + "')");
        }
        List<String> states = List.of("PLANNED", "NOTIFIED", "IN_PROGRESS", "PENDING_QA_CONFIRMATION", "COMPLETED", "CANCELLED");
        List<String> perms = List.of("training.activity.organize", "training.assessment.record");
        List<String> actions = List.of("HOLD_SESSION", "RECORD_ATTENDANCE", "POSTPONE_SESSION", "UPDATE_SESSION", "SET_CONTENT_EXEMPTIONS", "RECORD_ASSESSMENT");
        int n = PolicyMatrixHarness.run("TRAINING", "TRAINING_ACTIVITY", "TRAINING_ACTIVITY", MIGRATION, states, perms, List.of("CONDUCTOR"), actions, Set.of(),
                (action, state, p, rel, inScope) -> {
                    boolean planned = state.equals("PLANNED"), notified = state.equals("NOTIFIED"), inProgress = state.equals("IN_PROGRESS");
                    switch (action) {
                        case "HOLD_SESSION": return (notified || inProgress) && rel.contains("CONDUCTOR") && inScope;
                        case "RECORD_ATTENDANCE": return inProgress && rel.contains("CONDUCTOR") && inScope;
                        case "POSTPONE_SESSION": return (planned || notified || inProgress) && p.contains("training.activity.organize") && inScope;
                        case "UPDATE_SESSION": case "SET_CONTENT_EXEMPTIONS": return (planned || notified) && p.contains("training.activity.organize") && inScope;
                        default: return inProgress && p.contains("training.assessment.record") && inScope; // RECORD_ASSESSMENT
                    }
                });
        assertThat(n).isEqualTo(states.size() * (1 << perms.size()) * 2 * 2 * actions.size());
        // DESIGNATE applies in every state: one policy, whatever the state of the activity (the adapter asks for the ANY policy)
        int d = PolicyMatrixHarness.run("TRAINING", "TRAINING_ACTIVITY", "TRAINING_ACTIVITY", MIGRATION, List.of("ANY"), List.of("training.activity.organize"), List.of(), List.of("DESIGNATE"), Set.of(),
                (action, state, p, rel, inScope) -> p.contains("training.activity.organize") && inScope);
        assertThat(d).isGreaterThan(0);
    }
}
