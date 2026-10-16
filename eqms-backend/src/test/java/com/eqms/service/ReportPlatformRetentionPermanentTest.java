package com.eqms.service;


import com.eqms.entity.UserAccount;
import com.eqms.repository.DocumentRecordRepository;
import com.eqms.repository.UserAccountRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.lang.reflect.Method;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** REPORT-FILE-RETENTION-PERMANENT-2026-10-14: report files never expire, and no retention period can be attached to a definition. */
class ReportPlatformRetentionPermanentTest {

    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final PermissionEvaluationService permissions = mock(PermissionEvaluationService.class);
    private final AuditTrailService audit = mock(AuditTrailService.class);
    private final UserAccount actor = mock(UserAccount.class);

    private ReportPlatformService service() {
        when(permissions.hasPermission(any(UserAccount.class), anyString())).thenReturn(true);
        return new ReportPlatformService(jdbc, new ObjectMapper(), permissions, mock(DocumentRecordRepository.class),
                mock(UserAccountRepository.class), mock(DocumentAuthorizationService.class), mock(FileStorageService.class), audit);
    }

    @Test
    void aRetentionPeriodCannotBeAttachedToADefinition() {
        ReportPlatformService service = service();
        Map<String, Object> update = Map.of("reason", "try to set a period", "retentionPolicyId", "11111111-1111-1111-1111-111111111111");
        assertThatThrownBy(() -> service.updateConfiguration(actor, "DOCUMENT_STATUS", update))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("REPORT_RETENTION_PERMANENT");
        verifyNoInteractions(audit);
    }

    @Test
    void aReportFileNeverGetsAnExpiryDate() throws Exception {
        ReportPlatformService service = service();
        Method resolve = ReportPlatformService.class.getDeclaredMethod("resolveRetentionExpiry", String.class);
        resolve.setAccessible(true);
        Object expiry = resolve.invoke(service, "DOCUMENT_STATUS");
        assertThat(expiry).isNull();
    }
}
