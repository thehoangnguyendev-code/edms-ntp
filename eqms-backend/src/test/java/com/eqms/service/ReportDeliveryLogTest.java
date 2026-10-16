package com.eqms.service;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.DocumentRecordRepository;
import com.eqms.repository.UserAccountRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** REPORT-NOTIFICATION-CHANNEL-2026-10-14: the delivery log is paged on the server, with the page size capped at 100. */
class ReportDeliveryLogTest {

    @Test
    void theLogIsPagedAndTheLimitIsCapped() {
        var jdbc = mock(JdbcTemplate.class);
        var permissions = mock(PermissionEvaluationService.class);
        when(permissions.hasPermission(any(UserAccount.class), anyString())).thenReturn(true);
        // Search term (twice) for the count; search term, search term, limit and offset for the page.
        when(jdbc.queryForObject(anyString(), eq(Long.class), any(), any())).thenReturn(25L);
        when(jdbc.queryForList(anyString(), any(), any(), any(), any())).thenReturn(List.of());
        var service = new ReportPlatformService(jdbc, new ObjectMapper(), permissions, mock(DocumentRecordRepository.class),
                mock(UserAccountRepository.class), mock(DocumentAuthorizationService.class), mock(FileStorageService.class), mock(AuditTrailService.class));
        var actor = new UserAccount();
        actor.setId(UUID.randomUUID());
        actor.setStatus(UserStatus.Active);

        Map<?, ?> page = service.deliveries(actor, "", null, null, "createdAt", "desc", 3, 500);

        assertThat(page.get("pagination")).isEqualTo(Map.of("page", 3, "limit", 100, "total", 25L, "totalPages", 1L));
    }
}
