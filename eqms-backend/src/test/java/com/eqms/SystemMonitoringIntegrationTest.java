package com.eqms;

import com.eqms.repository.UserAccountRepository;
import com.eqms.service.SystemMonitoringService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;

/** The derived count queries behind the monitoring cards run against the real schema and reconcile with each other. */
@SpringBootTest
@Transactional
class SystemMonitoringIntegrationTest {

    @Autowired private SystemMonitoringService service;
    @Autowired private UserAccountRepository userRepository;

    @Test
    void everyFigureIsReadAndTheUserStatusesAddUpToAllUsers() {
        var response = service.getSystemMonitoring();

        assertThat(response.security().usersByStatus().values().stream().mapToLong(Long::longValue).sum()).isEqualTo(userRepository.count());
        assertThat(response.security().lockedAccounts()).isBetween(0L, userRepository.count());
        assertThat(response.security().activeSessions()).isNotNegative();
        assertThat(response.security().failedLogins24h()).isNotNegative();
        assertThat(response.security().electronicSignatures30d()).isNotNegative();
        assertThat(response.compliance().openAccessReviews()).isNotNegative();
        assertThat(response.compliance().openAuditTrailReviews()).isNotNegative();
        assertThat(response.compliance().openControlledCopyDiscrepancies()).isNotNegative();
        assertThat(response.database().schemaMigrationVersion()).isNotBlank();
        assertThat(response.runtime().uptimeMillis()).isPositive();
        assertThat(response.runtime().heapUsedBytes()).isLessThanOrEqualTo(response.runtime().heapMaxBytes());
    }
}
