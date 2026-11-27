package com.eqms.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.eqms.service.authorization.PolicyMatrixHarness;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

/**
 * The rest of Report (the schedule, the run, the legal hold of a file: V813) and the campaigns of Access Review and of Audit Trail Review (V814) as the Hybrid engine decides them, against the rules the
 * owner approved as they are in code. Every cell of state x permissions x relations x scope x action is checked (see {@link PolicyMatrixHarness}).
 */
class ReportAndReviewMatrixTest {
    private static final String REPORT = "src/main/resources/db/migration/V813__report_schedule_run_and_hold_in_workflow_authorization.sql";
    private static final String REVIEW = "src/main/resources/db/migration/V814__access_and_audit_review_in_workflow_authorization.sql";

    private static void check(String module, String migration, String workflow, int policies, List<String> states, List<String> perms, List<String> relations, List<String> actions, PolicyMatrixHarness.Rule rule)
            throws Exception {
        PolicyMatrixHarness.assertMigrationHasThePolicies(migration, workflow, workflow, policies);
        // none of these is limited to a department: the relation or the permission carries the rule
        int n = PolicyMatrixHarness.run(module, workflow, workflow, migration, states, perms, relations, actions, Set.copyOf(actions), rule);
        assertThat(n).isEqualTo(states.size() * (1 << perms.size()) * (1 << relations.size()) * 2 * actions.size());
    }

    @Test
    void theScheduleOfAReport() throws Exception {
        check("REPORT", REPORT, "REPORT_SCHEDULE", 4, List.of("ANY"), List.of(), List.of("MAY_MANAGE"), List.of("PAUSE", "RESUME", "DELETE", "CHANGE_OWNER"),
                (action, state, perms, rel, inScope) -> rel.contains("MAY_MANAGE"));
    }

    @Test
    void theRetryOfAFailedRun() throws Exception {
        check("REPORT", REPORT, "REPORT_RUN", 2, List.of("FAILED", "RETRY_SCHEDULED", "QUEUED", "PROCESSING", "SUCCEEDED"), List.of(), List.of("MAY_RETRY"), List.of("RETRY"),
                (action, state, perms, rel, inScope) -> (state.equals("FAILED") || state.equals("RETRY_SCHEDULED")) && rel.contains("MAY_RETRY"));
    }

    @Test
    void theLegalHoldOfAReportFile() throws Exception {
        check("REPORT", REPORT, "REPORT_ARTIFACT", 2, List.of("NOT_HELD", "HELD", "PURGED"), List.of(), List.of("HOLD_RIGHT"), List.of("PLACE_HOLD", "RELEASE_HOLD"),
                (action, state, perms, rel, inScope) -> rel.contains("HOLD_RIGHT") && (action.equals("PLACE_HOLD") ? state.equals("NOT_HELD") : state.equals("HELD")));
    }

    @Test
    void theUncontrolledCopy() throws Exception {
        String migration = "src/main/resources/db/migration/V815__uncontrolled_copy_in_workflow_authorization.sql";
        check("DOCUMENT_CONTROL", migration, "UNCONTROLLED_COPY", 2, List.of("READY_FOR_DISTRIBUTION", "DISTRIBUTED", "CLOSED_CANCELLED"),
                List.of("documents.uncontrolled_copy.distribute", "documents.uncontrolled_copy.cancel_request"), List.of(), List.of("DISTRIBUTE", "CANCEL"),
                (action, state, perms, rel, inScope) -> state.equals("READY_FOR_DISTRIBUTION")
                        && perms.contains(action.equals("DISTRIBUTE") ? "documents.uncontrolled_copy.distribute" : "documents.uncontrolled_copy.cancel_request"));
    }

    @Test
    void theCampaignsOfAccessReviewAndOfAuditTrailReview() throws Exception {
        check("SECURITY", REVIEW, "ACCESS_REVIEW_CAMPAIGN", 3, List.of("IN_PROGRESS", "COMPLETED", "CANCELLED"), List.of("security.access_review.manage"), List.of(),
                List.of("DECIDE_ITEM", "COMPLETE", "CANCEL"), (action, state, perms, rel, inScope) -> state.equals("IN_PROGRESS") && perms.contains("security.access_review.manage"));
        check("AUDIT_TRAIL", REVIEW, "AUDIT_REVIEW_CAMPAIGN", 3, List.of("IN_PROGRESS", "COMPLETED", "CANCELLED"), List.of("audit.review.manage"), List.of(),
                List.of("DECIDE_ITEM", "COMPLETE", "CANCEL"), (action, state, perms, rel, inScope) -> state.equals("IN_PROGRESS") && perms.contains("audit.review.manage"));
    }
}
