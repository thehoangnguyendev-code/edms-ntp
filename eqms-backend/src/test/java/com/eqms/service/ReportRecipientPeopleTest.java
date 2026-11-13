package com.eqms.service;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.DocumentRecordRepository;
import com.eqms.repository.UserAccountRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** The people who may be chosen as recipients of a scheduled report are found, narrowed and paged by the server, like the people of a Training. */
class ReportRecipientPeopleTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final PermissionEvaluationService permissions = mock(PermissionEvaluationService.class);
    private final UserAccount actor = new UserAccount();
    private ReportPlatformService service;

    @BeforeEach
    void setUp() {
        actor.setId(UUID.randomUUID());
        actor.setStatus(UserStatus.Active);
        when(permissions.hasPermission(any(UserAccount.class), anyString())).thenReturn(true);
        service = new ReportPlatformService(jdbc, new ObjectMapper(), permissions, mock(DocumentRecordRepository.class),
                mock(UserAccountRepository.class), mock(DocumentAuthorizationService.class), mock(FileStorageService.class), mock(AuditTrailService.class));
    }

    @SuppressWarnings("unchecked")
    @Test
    void theSearchIsEscapedEveryValueIsAParameterAndThePageSizeIsCapped() {
        when(jdbc.queryForObject(anyString(), eq(Long.class), any(Object[].class))).thenReturn(120L);
        when(jdbc.queryForList(anyString(), any(Object[].class))).thenReturn(List.of());

        Map<String, Object> page = service.recipientPeople(actor, "100%_x\\", "Factory", "Quality Assurance", 3, 500);

        var sql = ArgumentCaptor.forClass(String.class);
        var args = ArgumentCaptor.forClass(Object[].class);
        verify(jdbc).queryForList(sql.capture(), args.capture());
        assertThat(sql.getValue()).contains("u.status='Active'").contains("u.business_unit=?").contains("u.department=?").contains("limit ? offset ?");
        assertThat(sql.getValue()).contains("'reports.artifact.download','report.module.export'").as("only people who may download report files").contains("r.is_active=true").contains("ps.active=true");
        assertThat(sql.getValue()).doesNotContain("Factory").doesNotContain("Quality Assurance").doesNotContain("100%");
        assertThat(args.getValue()).containsExactly("%100\\%\\_x\\\\%", "%100\\%\\_x\\\\%", "%100\\%\\_x\\\\%", "%100\\%\\_x\\\\%", "Factory", "Quality Assurance", 50, 100L);
        assertThat((Map<String, Object>) page.get("pagination")).containsEntry("limit", 50).containsEntry("page", 3).containsEntry("total", 120L).containsEntry("totalPages", 3);
    }

    @Test
    void aSearchOfMoreThan200CharactersIsRefused() {
        assertThatThrownBy(() -> service.recipientPeople(actor, "a".repeat(201), null, null, 1, 20)).isInstanceOf(IllegalArgumentException.class).hasMessage("REPORT_SEARCH_TOO_LONG");
    }

    @Test
    void aPersonWithoutThePermissionToManageSchedulesIsRefused() {
        when(permissions.hasPermission(any(UserAccount.class), anyString())).thenReturn(false);
        assertThatThrownBy(() -> service.recipientPeople(actor, "", null, null, 1, 20)).isInstanceOf(SecurityException.class);
        assertThatThrownBy(() -> service.recipientGroups(actor, "DEPARTMENT")).isInstanceOf(SecurityException.class);
    }

    @Test
    void onlyABusinessUnitOrADepartmentGroupsThePeople() {
        when(jdbc.queryForList(anyString())).thenReturn(List.of(Map.of("name", "Quality Assurance", "total", 3L)));
        assertThat(service.recipientGroups(actor, "DEPARTMENT")).hasSize(1);
        assertThat(service.recipientGroups(actor, "BUSINESS_UNIT")).hasSize(1);
        assertThatThrownBy(() -> service.recipientGroups(actor, "password")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.recipientGroups(actor, null)).isInstanceOf(IllegalArgumentException.class);
    }
}
