package com.eqms.service.report;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.service.AuditTrailService;
import com.eqms.service.EffectivePermissionService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** The Access and Scope tab asks the server for its Access Profiles: the search, the filters, the sort and the page size are checked before any query runs. */
class ReportRoleSearchTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final EffectivePermissionService permissions = mock(EffectivePermissionService.class);
    private final ReportTemplateService service = new ReportTemplateService(jdbc, new ObjectMapper(), permissions, mock(AuditTrailService.class), List.of(new DocumentReportMetadataProvider()));

    private UserAccount actor(String... codes) {
        UserAccount user = new UserAccount();
        user.setId(UUID.randomUUID());
        user.setStatus(UserStatus.Active);
        when(permissions.getEffectivePermissionCodes(any(UserAccount.class))).thenReturn(Set.of(codes));
        return user;
    }

    private static ReportTemplateService.RoleSearch search(String assignment, String scope, String sortBy, Integer limit, List<ReportTemplateService.RoleAssignment> assignments) {
        return new ReportTemplateService.RoleSearch("qa", assignment, scope, sortBy, "asc", 1, limit, assignments);
    }

    @Test
    void aValidSearchRunsAndReturnsThePageWithTheInactiveProfiles() {
        when(jdbc.queryForObject(anyString(), eq(Long.class), org.mockito.ArgumentMatchers.<Object[]>any())).thenReturn(0L);
        var result = service.searchRoles(actor("reports.definition.view"), search("ASSIGNED", "SYSTEM", "scope", 20, List.of(new ReportTemplateService.RoleAssignment(UUID.randomUUID(), "SYSTEM"))));
        assertThat(result).containsKeys("data", "pagination", "inactive");
    }

    @Test
    void aValueOutsideTheAllowedSetIsRefusedBeforeAnyQuery() {
        UserAccount viewer = actor("reports.definition.view");
        assertThatThrownBy(() -> service.searchRoles(viewer, search("SOME", null, "name", 10, List.of()))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.searchRoles(viewer, search("ALL", "GALAXY", "name", 10, List.of()))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.searchRoles(viewer, search("ALL", null, "password", 10, List.of()))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.searchRoles(viewer, search("ALL", null, "name", 7, List.of()))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.searchRoles(viewer, search("ALL", null, "name", 10, List.of(new ReportTemplateService.RoleAssignment(UUID.randomUUID(), "GALAXY")))))
                .isInstanceOf(IllegalArgumentException.class);
        verify(jdbc, never()).queryForList(anyString(), org.mockito.ArgumentMatchers.<Object[]>any());
    }

    @Test
    void moreThanTwoHundredScopesAreRefused() {
        var many = java.util.stream.IntStream.range(0, 201).mapToObj(i -> new ReportTemplateService.RoleAssignment(UUID.randomUUID(), "SYSTEM")).toList();
        assertThatThrownBy(() -> service.searchRoles(actor("reports.definition.manage"), search("ALL", null, "name", 10, many))).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void aPersonWithoutReportConfigurationAccessIsRefused() {
        assertThatThrownBy(() -> service.searchRoles(actor("reports.run.create"), search("ALL", null, "name", 10, List.of()))).isInstanceOf(SecurityException.class);
    }
}
