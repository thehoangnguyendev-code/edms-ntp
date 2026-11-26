package com.eqms.service.training;

import static org.assertj.core.api.Assertions.assertThat;

import com.eqms.service.authorization.PolicyMatrixHarness;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

/**
 * The other lifecycles of Training (V812) as the Hybrid engine decides them, against the rules the owner approved as they are in code (AUTHORIZATION_ACTION_CATALOG_TRAINING_AS_IS_2026_11_18). Each test
 * writes the rule of the lifecycle and checks every cell of state x permissions x relations x scope x action (see {@link PolicyMatrixHarness}).
 */
class TrainingOtherLifecyclesMatrixTest {
    private static final String MIGRATION = "src/main/resources/db/migration/V812__training_other_lifecycles_in_workflow_authorization.sql";
    /** The assessment library was changed after V812: four steps are decided by the relation CAN_MANAGE (view, manage, manage_all, approve). */
    private static final String ASSESSMENT_MIGRATION = "src/main/resources/db/migration/V860__training_assessment_view_manage_manage_all.sql";
    private static final Set<String> ASSESSMENT_CHANGED = Set.of("UPDATE|DRAFT", "DELETE|DRAFT", "SUBMIT|DRAFT", "UPGRADE_REVISION|EFFECTIVE");

    private static int cells(String workflow, String type, List<String> states, List<String> perms, List<String> relations, List<String> actions, Set<String> unscoped, PolicyMatrixHarness.Rule rule) throws Exception {
        boolean assessment = workflow.equals("TRAINING_ASSESSMENT");
        PolicyMatrixHarness.assertMigrationHasThePolicies(MIGRATION, workflow, type, (int) PolicyMatrixHarness.defaultsOf(workflow).size(), assessment ? ASSESSMENT_CHANGED : Set.of(), assessment ? ASSESSMENT_MIGRATION : "");
        String migrations = assessment ? MIGRATION + ";" + ASSESSMENT_MIGRATION : MIGRATION;
        int n = PolicyMatrixHarness.run("TRAINING", workflow, type, migrations, states, perms, relations, actions, unscoped, rule);
        assertThat(n).isEqualTo(states.size() * (1 << perms.size()) * (1 << relations.size()) * 2 * actions.size());
        return n;
    }

    @Test
    void theParticipantOfAnActivity() throws Exception {
        cells("TRAINING_PARTICIPANT", "TRAINING_PARTICIPANT", List.of("PLANNED", "NOTIFIED", "IN_PROGRESS", "PENDING_QA_CONFIRMATION", "COMPLETED"),
                List.of("training.activity.organize", "training.self.view"), List.of("SELF", "CONDUCTOR"),
                List.of("REMIND_TO_READ", "EXCUSE_READER", "CORRECT_ATTENDANCE", "SET_PARTICIPATION", "REMOVE_PARTICIPANT", "SET_PLANNED_ABSENCE", "CONFIRM_READ"), Set.of("CONFIRM_READ"),
                (action, state, perms, rel, inScope) -> {
                    boolean n = state.equals("NOTIFIED"), ip = state.equals("IN_PROGRESS"), p = state.equals("PLANNED");
                    switch (action) {
                        case "REMIND_TO_READ": return (n || ip) && rel.contains("CONDUCTOR") && inScope;
                        case "EXCUSE_READER": return (n || ip) && rel.contains("CONDUCTOR") && !rel.contains("SELF") && inScope;
                        case "CORRECT_ATTENDANCE": return ip && rel.contains("CONDUCTOR") && !rel.contains("SELF") && inScope;
                        case "SET_PARTICIPATION": return (p || n || ip) && rel.contains("CONDUCTOR") && !rel.contains("SELF") && inScope;
                        case "REMOVE_PARTICIPANT": return p && perms.contains("training.activity.organize") && inScope;
                        case "SET_PLANNED_ABSENCE": return (p || n) && perms.contains("training.activity.organize") && inScope;
                        default: return (n || ip) && perms.contains("training.self.view") && rel.contains("SELF");
                    }
                });
    }

    @Test
    void theAssessmentLibrary() throws Exception {
        // Who may manage ONE assessment is one relation worked out by the adapter (manage_all, or manage and the person created it); only the approval needs a permission of its own.
        cells("TRAINING_ASSESSMENT", "TRAINING_ASSESSMENT", List.of("DRAFT", "PENDING_APPROVAL", "EFFECTIVE", "OBSOLETED"),
                List.of("training.assessment.approve"), List.of("CREATOR", "UPDATER", "SUBMITTER", "CAN_MANAGE", "DESIGNER_OR_APPROVER"),
                List.of("UPDATE", "DELETE", "SUBMIT", "APPROVE", "RETURN_TO_DRAFT", "UPGRADE_REVISION"), Set.of("UPDATE", "DELETE", "SUBMIT", "APPROVE", "RETURN_TO_DRAFT", "UPGRADE_REVISION"),
                (action, state, perms, rel, inScope) -> {
                    switch (action) {
                        case "UPDATE": case "DELETE": case "SUBMIT": return state.equals("DRAFT") && rel.contains("CAN_MANAGE");
                        case "APPROVE": return state.equals("PENDING_APPROVAL") && perms.contains("training.assessment.approve") && !rel.contains("CREATOR") && !rel.contains("UPDATER") && !rel.contains("SUBMITTER");
                        case "RETURN_TO_DRAFT": return state.equals("PENDING_APPROVAL") && rel.contains("DESIGNER_OR_APPROVER");
                        default: return state.equals("EFFECTIVE") && rel.contains("CAN_MANAGE");
                    }
                });
    }

    @Test
    void theJobAssignment() throws Exception {
        cells("TRAINING_JOB_ASSIGNMENT", "TRAINING_JOB_ASSIGNMENT", List.of("DRAFT", "PENDING_RECEIVER", "EFFECTIVE", "OBSOLETED", "CANCELLED"),
                List.of("training.job_assignment.manage", "training.job_assignment.exception.approve", "training.self.view"), List.of("RECEIVER", "CREATOR", "EXCEPTION_ASSIGNEE"),
                List.of("UPDATE", "REQUEST_EXCEPTION", "APPROVE_EXCEPTION", "SUBMIT", "ACCEPT", "CANCEL"), Set.of("ACCEPT"),
                (action, state, perms, rel, inScope) -> {
                    boolean manage = perms.contains("training.job_assignment.manage");
                    switch (action) {
                        case "UPDATE": case "REQUEST_EXCEPTION": return state.equals("DRAFT") && manage && inScope;
                        case "APPROVE_EXCEPTION": return state.equals("DRAFT") && perms.contains("training.job_assignment.exception.approve") && rel.contains("EXCEPTION_ASSIGNEE")
                                && !rel.contains("RECEIVER") && !rel.contains("CREATOR") && inScope;
                        case "SUBMIT": return state.equals("DRAFT") && manage && !rel.contains("RECEIVER") && inScope;
                        case "ACCEPT": return state.equals("PENDING_RECEIVER") && perms.contains("training.self.view") && rel.contains("RECEIVER");
                        default: return (state.equals("DRAFT") || state.equals("PENDING_RECEIVER")) && manage && inScope;
                    }
                });
    }

    @Test
    void thePersonnelReview() throws Exception {
        cells("TRAINING_PERSONNEL_REVIEW", "TRAINING_PERSONNEL_REVIEW", List.of("OPEN", "CLOSED", "CANCELLED"),
                List.of("training.job_assignment.manage"), List.of("SUBJECT", "CLOSER_OK", "REASSIGN_RIGHT"),
                List.of("UPDATE_ITEM", "CREATE_ACTIVITY", "CLOSE", "CANCEL", "CHANGE_CLOSER"), Set.of(),
                (action, state, perms, rel, inScope) -> {
                    boolean base = state.equals("OPEN") && perms.contains("training.job_assignment.manage") && inScope;
                    switch (action) {
                        case "CLOSE": return base && rel.contains("CLOSER_OK") && !rel.contains("SUBJECT");
                        case "CHANGE_CLOSER": return base && rel.contains("REASSIGN_RIGHT");
                        default: return base;
                    }
                });
    }

    @Test
    void theExportOfAPersonalRecordAndOfADepartmentBatch() throws Exception {
        for (String workflow : List.of("TRAINING_RECORD_EXPORT", "TRAINING_RECORD_EXPORT_BATCH")) {
            cells(workflow, workflow, List.of("PENDING_APPROVAL", "APPROVED", "REJECTED"), List.of("training.record.export"), List.of("PREPARER", "APPROVAL_ASSIGNEE"),
                    List.of("APPROVE", "REJECT"), Set.of(),
                    (action, state, perms, rel, inScope) -> state.equals("PENDING_APPROVAL") && perms.contains("training.record.export") && rel.contains("APPROVAL_ASSIGNEE") && !rel.contains("PREPARER") && inScope);
        }
    }

    @Test
    void theTrainerException() throws Exception {
        cells("TRAINING_TRAINER_EXCEPTION", "TRAINING_TRAINER_EXCEPTION", List.of("PENDING", "APPROVED", "REJECTED"), List.of("training.trainer.exception.approve"),
                List.of("REQUESTER", "TRAINER", "APPROVAL_ASSIGNEE"), List.of("APPROVE", "REJECT"), Set.of(),
                (action, state, perms, rel, inScope) -> state.equals("PENDING") && perms.contains("training.trainer.exception.approve") && rel.contains("APPROVAL_ASSIGNEE")
                        && !rel.contains("REQUESTER") && !rel.contains("TRAINER") && inScope);
    }

    @Test
    void theWorkSuspension() throws Exception {
        cells("TRAINING_SUSPENSION", "TRAINING_SUSPENSION", List.of("OPEN", "CLEARED"), List.of("training.job_assignment.manage"), List.of("SUBJECT"), List.of("RESUME"), Set.of(),
                (action, state, perms, rel, inScope) -> state.equals("OPEN") && perms.contains("training.job_assignment.manage") && !rel.contains("SUBJECT") && inScope);
    }

    @Test
    void theExternalVendor() throws Exception {
        cells("TRAINING_VENDOR", "TRAINING_VENDOR", List.of("DRAFT", "ACTIVE", "INACTIVE"), List.of("training.admin.manage"), List.of("CREATOR"), List.of("APPROVE"), Set.of("APPROVE"),
                (action, state, perms, rel, inScope) -> state.equals("DRAFT") && perms.contains("training.admin.manage") && !rel.contains("CREATOR"));
    }

    @Test
    void theTrainingRecordVoid() throws Exception {
        cells("TRAINING_RECORD", "TRAINING_RECORD", List.of("ACTIVE", "VOIDED"), List.of("training.record.void"), List.of("CONFIRMER"), List.of("VOID"), Set.of(),
                (action, state, perms, rel, inScope) -> state.equals("ACTIVE") && perms.contains("training.record.void") && !rel.contains("CONFIRMER") && inScope);
    }
}
