package com.eqms.service.training;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.eqms.entity.UserAccount;
import com.eqms.repository.WorkflowActionPolicyRelationRepository;
import com.eqms.service.WorkflowActionPolicyService;
import com.eqms.service.authorization.ResourceAuthorizationAdapter;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Who may manage ONE Training Assessment (DEC-TRAIN-2026-11-25-01): manage_all manages every assessment; manage only the ones the person created; view and approve never manage.
 * The adapter works this out as the relation CAN_MANAGE, which the policies of UPDATE, DELETE, SUBMIT and UPGRADE_REVISION require (V860).
 */
class TrainingAssessmentManageRelationTest {
    private final UUID me = UUID.randomUUID();
    private final UUID other = UUID.randomUUID();
    private final UUID assessment = UUID.randomUUID();

    private Set<String> relationsOf(Set<String> permissions, UUID createdBy) {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForList(anyString(), eq(assessment))).thenReturn(List.of(Map.of("created_by", createdBy, "updated_by", createdBy, "submitted_by", createdBy)));
        TrainingAccess access = mock(TrainingAccess.class);
        when(access.has(any(), any(String[].class))).thenAnswer(call -> {
            Object[] arguments = call.getArguments();
            for (int i = 1; i < arguments.length; i++) {
                if (arguments[i] instanceof String name && permissions.contains(name)) return true;
                if (arguments[i] instanceof String[] names) for (String name : names) if (permissions.contains(name)) return true;
            }
            return false;
        });
        ResourceAuthorizationAdapter adapter = new TrainingOtherLifecycleAdapters().trainingAssessmentAdapter(jdbc, access, mock(WorkflowActionPolicyService.class), mock(WorkflowActionPolicyRelationRepository.class));
        UserAccount actor = new UserAccount();
        actor.setId(me);
        return adapter.resolveMatchedRelations(actor, assessment);
    }

    @Test
    void manageAllManagesAnAssessmentOfSomeoneElse() {
        assertThat(relationsOf(Set.of("training.assessment.manage_all"), other)).contains("CAN_MANAGE");
    }

    @Test
    void manageManagesOnlyTheAssessmentTheyCreated() {
        assertThat(relationsOf(Set.of("training.assessment.manage"), me)).contains("CAN_MANAGE", "CREATOR");
        assertThat(relationsOf(Set.of("training.assessment.manage"), other)).doesNotContain("CAN_MANAGE");
    }

    @Test
    void viewAndApproveNeverManage_butApproveMayStillReturnToDraft() {
        assertThat(relationsOf(Set.of("training.assessment.view"), me)).doesNotContain("CAN_MANAGE", "DESIGNER_OR_APPROVER");
        Set<String> approver = relationsOf(Set.of("training.assessment.approve"), other);
        assertThat(approver).doesNotContain("CAN_MANAGE");
        assertThat(approver).contains("DESIGNER_OR_APPROVER");
    }

    @Test
    void aPersonWithNoPermissionHasNeitherRelation() {
        assertThat(relationsOf(Set.of(), me)).doesNotContain("CAN_MANAGE", "DESIGNER_OR_APPROVER");
    }
}
