package com.eqms.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** The "Users" column of an Access Profile's workflow tab is that profile's own number, not the role's total across the system. */
class WorkflowRoleServiceUsersTest {

    private final UUID mine = UUID.randomUUID();
    private final UUID other = UUID.randomUUID();
    private final WorkflowRoleService.WorkflowRoleResponse role = new WorkflowRoleService.WorkflowRoleResponse(
            "DOCUMENT_REVIEWER", "Document Reviewer", "documents", "Reviews.",
            List.of(new WorkflowRoleService.WorkflowRoleProfileRef(mine, "Mine", true, 0),
                    new WorkflowRoleService.WorkflowRoleProfileRef(other, "Other", true, 7)),
            7, List.of());

    @Test void countsOnlyTheGivenProfile() {
        assertThat(WorkflowRoleService.usersOf(role, mine)).isZero();
        assertThat(WorkflowRoleService.usersOf(role, other)).isEqualTo(7);
    }

    @Test void aProfileThatDoesNotHoldTheRoleHasNoUsersForIt() {
        assertThat(WorkflowRoleService.usersOf(role, UUID.randomUUID())).isZero();
    }

    @Test void withoutAProfileItIsTheTotalAcrossProfiles() {
        assertThat(WorkflowRoleService.usersOf(role, null)).isEqualTo(7);
    }
}
