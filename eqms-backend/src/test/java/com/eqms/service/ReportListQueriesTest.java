package com.eqms.service;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.DocumentRecordRepository;
import com.eqms.repository.UserAccountRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
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
import static org.mockito.Mockito.when;

/** REPORT-LIST-STANDARD-2026-10-14: the server pages, caps the page size and refuses a caller without permission. */
class ReportListQueriesTest {

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

    @Test
    void accessScopesArePagedAndTheLimitIsCapped() {
        // Count: three search terms. Page: three search terms, limit and offset.
        when(jdbc.queryForObject(anyString(), eq(Long.class), any(), any(), any())).thenReturn(25L);
        when(jdbc.queryForList(anyString(), any(), any(), any(), any(), any())).thenReturn(List.of());

        Map<?, ?> page = service.accessScopes(actor, "qa", null, "roleName", "asc", 2, 500);

        assertThat(page.get("pagination")).isEqualTo(Map.of("page", 2, "limit", 100, "total", 25L, "totalPages", 1L));
    }

    @Test
    void legalHoldsArePaged() {
        when(jdbc.queryForObject(anyString(), eq(Long.class), any(), any())).thenReturn(0L);
        when(jdbc.queryForList(anyString(), any(), any(), any(), any())).thenReturn(List.of());

        Map<?, ?> page = service.legalHolds(actor, "", "heldAt", "desc", 1, 10);

        assertThat(page.get("pagination")).isEqualTo(Map.of("page", 1, "limit", 10, "total", 0L, "totalPages", 0L));
    }

    @Test
    void aCallerWithoutPermissionIsRefused() {
        when(permissions.hasPermission(any(UserAccount.class), anyString())).thenReturn(false);

        assertThatThrownBy(() -> service.accessScopes(actor, "", null, "templateName", "asc", 1, 10)).isInstanceOf(SecurityException.class);
        assertThatThrownBy(() -> service.legalHolds(actor, "", "heldAt", "desc", 1, 10)).isInstanceOf(SecurityException.class);
    }
}
