package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.AuditTrailService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Who is told that the results of a training wait for QA: the people who may confirm it, in whatever department the training was held. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TrainingApprovalEligibleUsersTest {

    @Mock JdbcTemplate jdbc;
    @Mock TrainingAccess access;
    @Mock TrainingStore store;
    @Mock AuditTrailService audit;
    @Mock UserAccountRepository users;
    @Mock TrainingNotifier notifier;

    private final UUID qcDepartment = UUID.randomUUID();
    private TrainingApprovalService approvals;

    @BeforeEach
    void setUp() {
        approvals = new TrainingApprovalService(jdbc, access, store, audit, users, notifier);
    }

    private UserAccount person(UserStatus status, Set<String> codes, boolean inScope) {
        UserAccount user = mock(UserAccount.class);
        when(user.getId()).thenReturn(UUID.randomUUID());
        when(user.getStatus()).thenReturn(status);
        when(access.codes(user)).thenReturn(codes);
        when(access.inScope(user, qcDepartment)).thenReturn(inScope);
        return user;
    }

    @Test
    void qaOfAnotherDepartmentIsToldWhenQcSendsResults() {
        UserAccount qa = person(UserStatus.Active, Set.of("training.activity.close", "training.scope.all"), true);
        UserAccount qcOnlyOwnScope = person(UserStatus.Active, Set.of("training.activity.close"), true);
        when(users.findAll()).thenReturn(List.of(qa, qcOnlyOwnScope));

        // QA holds the scope of all departments, so the training of QC is in its scope; the one who prepared the list is kept apart.
        assertThat(approvals.eligibleUsers("ACTIVITY_COMPLETE", qcDepartment, Set.of(qcOnlyOwnScope.getId()))).containsExactly(qa);
    }

    @Test
    void personWithoutTheRightOrOutOfScopeOrInactiveIsNotTold() {
        UserAccount noRight = person(UserStatus.Active, Set.of("training.activity.view"), true);
        UserAccount outOfScope = person(UserStatus.Active, Set.of("training.activity.close"), false);
        UserAccount inactive = person(UserStatus.Inactive, Set.of("training.activity.close", "training.scope.all"), true);
        when(users.findAll()).thenReturn(List.of(noRight, outOfScope, inactive));

        assertThat(approvals.eligibleUsers("ACTIVITY_COMPLETE", qcDepartment, Set.of())).isEmpty();
    }
}
