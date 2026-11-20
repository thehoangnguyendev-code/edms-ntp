package com.eqms.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.WorkflowActionPolicyRelationRepository;
import com.eqms.service.authorization.PolicyBackedAdapter;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * A grant that was withdrawn but is still in the permission cache must not authorize a retry of a report run (the rule of ReportTemplatePermissionBoundaryTest, kept after the cutover of REPORT_RUN,
 * where the engine decides): the relation MAY_RETRY reads the permissions as they are now. Otherwise it is held by whoever may request reports and either sees every run or requested this one.
 */
class ReportRunRetryStaleGrantTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final PermissionEvaluationService cached = mock(PermissionEvaluationService.class);
    private final EffectivePermissionService now = mock(EffectivePermissionService.class);
    private final UserAccount actor = new UserAccount();
    private final UUID runId = UUID.randomUUID();
    private final PolicyBackedAdapter adapter = new ReportAndReviewAdapters().reportRunAdapter(jdbc, cached, now, mock(WorkflowActionPolicyService.class), mock(WorkflowActionPolicyRelationRepository.class));

    @Test
    void aStaleCachedGrant_withNothingHeldNow_doesNotAuthorize() {
        UUID me = UUID.randomUUID();
        assertThat(mayRetryAs(me, Set.of(), true, me)).isFalse();
    }

    @Test
    void theRequesterWhoHoldsTheCreatePermissionNow_mayRetry() {
        UUID me = UUID.randomUUID();
        assertThat(mayRetryAs(me, Set.of("reports.run.create"), false, me)).isTrue();
    }

    @Test
    void anotherPersonsRun_needsViewAll() {
        UUID me = UUID.randomUUID();
        assertThat(mayRetryAs(me, Set.of("report.module.export"), false, UUID.randomUUID())).isFalse();
        assertThat(mayRetryAs(me, Set.of("report.module.export"), true, UUID.randomUUID())).isTrue();
    }

    private boolean mayRetryAs(UUID me, Set<String> permissionsNow, boolean viewAll, UUID requester) {
        actor.setId(me);
        actor.setStatus(UserStatus.Active);
        when(cached.hasPermission(any(UserAccount.class), any(String.class))).thenReturn(true);
        when(cached.hasPermission(eq(actor), eq("reports.run.view_all"))).thenReturn(viewAll);
        when(now.getEffectivePermissionCodes(actor)).thenReturn(permissionsNow);
        when(jdbc.queryForList(any(String.class), eq(runId))).thenReturn(List.of(Map.<String, Object>of("requester_user_id", requester)));
        return adapter.resolveMatchedRelations(actor, runId).contains("MAY_RETRY");
    }
}
