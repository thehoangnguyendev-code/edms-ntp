package com.eqms.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.eqms.entity.UserAccount;
import com.eqms.repository.WorkflowActionPolicyRelationRepository;
import com.eqms.service.authorization.PolicyBackedAdapter;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Regression for the ownership scope of the schedule found in the system-wide authorization audit: report.module.export (a broad permission that also gates generating a report) must not let a holder
 * pause, resume, delete or hand over ANOTHER person's schedule. Since the cutover of REPORT_SCHEDULE (the old checks of ReportPlatformService were deleted) the rule is the relation MAY_MANAGE that the
 * adapter computes; the policies (V813) require it for every action, and ReportAndReviewMatrixTest checks that. Here: when the person holds it.
 */
class ReportScheduleOwnershipScopeTest {
    private JdbcTemplate jdbc;
    private PermissionEvaluationService permissions;
    private PolicyBackedAdapter adapter;
    private UserAccount actor;
    private UUID scheduleId;
    private UUID otherOwnerId;

    @BeforeEach
    void setUp() {
        jdbc = mock(JdbcTemplate.class);
        permissions = mock(PermissionEvaluationService.class);
        adapter = new ReportAndReviewAdapters().reportScheduleAdapter(jdbc, permissions, mock(WorkflowActionPolicyService.class), mock(WorkflowActionPolicyRelationRepository.class));
        actor = new UserAccount();
        actor.setId(UUID.randomUUID());
        scheduleId = UUID.randomUUID();
        otherOwnerId = UUID.randomUUID();
    }

    private boolean mayManage(boolean manageAll, boolean export, UUID creator) {
        when(permissions.hasPermission(actor, "reports.schedule.manage")).thenReturn(manageAll);
        when(permissions.hasPermission(actor, "report.module.export")).thenReturn(export);
        when(jdbc.queryForList(any(String.class), eq(scheduleId))).thenReturn(List.of(Map.<String, Object>of("creator_user_id", creator)));
        return adapter.resolveMatchedRelations(actor, scheduleId).contains("MAY_MANAGE");
    }

    @Test
    void anotherPersonsSchedule_withOnlyTheExportPermission_isNotManageable() {
        assertThat(mayManage(false, true, otherOwnerId)).isFalse();
    }

    @Test
    void ownSchedule_withoutManageAll_isManageable() {
        assertThat(mayManage(false, true, actor.getId())).isTrue();
    }

    @Test
    void manageAll_allowsAnotherPersonsSchedule() {
        assertThat(mayManage(true, true, otherOwnerId)).isTrue();
    }

    @Test
    void withoutTheManageOrTheExportPermission_nothingIsManageable_notEvenOwn() {
        assertThat(mayManage(false, false, actor.getId())).isFalse();
    }
}
