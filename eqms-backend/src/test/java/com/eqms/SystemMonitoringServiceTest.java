package com.eqms;

import com.eqms.dto.settings.SystemInfoResponse;
import com.eqms.entity.AuthSession;
import com.eqms.entity.ControlledCopyBatchStatusDiscrepancy;
import com.eqms.entity.UserStatus;
import com.eqms.repository.AccessReviewCampaignRepository;
import com.eqms.repository.AuditTrailReviewCampaignRepository;
import com.eqms.repository.AuthAuditLogRepository;
import com.eqms.repository.AuthSessionRepository;
import com.eqms.repository.ControlledCopyBatchStatusDiscrepancyRepository;
import com.eqms.repository.ElectronicSignatureRepository;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.SystemInfoService;
import com.eqms.service.SystemMonitoringService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SystemMonitoringServiceTest {

    private static final Instant NOW = Instant.parse("2026-10-07T10:00:00Z");

    @Mock SystemInfoService systemInfoService;
    @Mock UserAccountRepository userRepository;
    @Mock AuthSessionRepository sessionRepository;
    @Mock AuthAuditLogRepository authAuditRepository;
    @Mock ElectronicSignatureRepository signatureRepository;
    @Mock AccessReviewCampaignRepository accessReviewRepository;
    @Mock AuditTrailReviewCampaignRepository auditReviewRepository;
    @Mock ControlledCopyBatchStatusDiscrepancyRepository discrepancyRepository;

    private SystemMonitoringService service() {
        return new SystemMonitoringService(systemInfoService, userRepository, sessionRepository, authAuditRepository,
                signatureRepository, accessReviewRepository, auditReviewRepository, discrepancyRepository);
    }

    private SystemInfoResponse info() {
        return new SystemInfoResponse(
                new SystemInfoResponse.ServerInfo("eqms-backend", "1.2.3", List.of("prod"), "23", "Oracle", "HotSpot", "Windows", "amd64",
                        8, "UTC", "2026-10-06T10:00:00Z", 86_400_000L, 400L, 1_000L),
                new SystemInfoResponse.DatabaseInfo("PostgreSQL", "17.10", "pg", "42", "551", 551, 10, 3, 7),
                List.of());
    }

    @Test
    void reportsRuntimeAndDatabaseFactsWithoutAnyHostOrVendorDetail() {
        when(systemInfoService.getSystemInfo()).thenReturn(info());

        var response = service().getSystemMonitoring(NOW);

        assertThat(response.generatedAt()).isEqualTo(NOW);
        assertThat(response.runtime()).extracting("applicationVersion", "uptimeMillis", "heapUsedBytes", "heapMaxBytes", "availableProcessors")
                .containsExactly("1.2.3", 86_400_000L, 400L, 1_000L, 8);
        assertThat(response.database()).extracting("schemaMigrationVersion", "appliedMigrations", "poolActive", "poolIdle", "poolMax")
                .containsExactly("551", 551, 3, 7, 10);
        assertThat(response.runtime().toString()).doesNotContain("Windows", "Oracle", "HotSpot");
    }

    @Test
    void countsEveryUserStatusInDeclarationOrderEvenWhenNoUserHasIt() {
        when(systemInfoService.getSystemInfo()).thenReturn(info());
        when(userRepository.countByStatus(any(UserStatus.class))).thenReturn(0L);
        when(userRepository.countByStatus(UserStatus.Active)).thenReturn(7L);
        when(userRepository.countByStatus(UserStatus.Suspended)).thenReturn(2L);

        var users = service().getSystemMonitoring(NOW).security().usersByStatus();

        assertThat(users.keySet()).containsExactly("Active", "Inactive", "Pending", "Suspended", "Terminated");
        assertThat(users).containsEntry("Active", 7L).containsEntry("Suspended", 2L).containsEntry("Inactive", 0L);
    }

    @Test
    void usesTheDocumentedTimeWindowsAndStatuses() {
        when(systemInfoService.getSystemInfo()).thenReturn(info());
        when(userRepository.countByLockedUntilAfter(NOW)).thenReturn(1L);
        when(sessionRepository.countByStatusAndRevokedAtIsNullAndExpiresAtAfter(AuthSession.SessionStatus.ACTIVE, NOW)).thenReturn(5L);
        when(authAuditRepository.countByEventTypeAndCreatedAtAfter("login_failed", NOW.minusSeconds(24 * 3600))).thenReturn(9L);
        when(signatureRepository.countByStatusAndSignedAtAfter("SIGNED", NOW.minusSeconds(30L * 24 * 3600))).thenReturn(40L);
        when(accessReviewRepository.countByStatus("IN_PROGRESS")).thenReturn(2L);
        when(auditReviewRepository.countByStatus("IN_PROGRESS")).thenReturn(3L);
        when(discrepancyRepository.countByStatus(ControlledCopyBatchStatusDiscrepancy.STATUS_OPEN)).thenReturn(4L);

        var response = service().getSystemMonitoring(NOW);

        assertThat(response.security()).extracting("lockedAccounts", "activeSessions", "failedLogins24h", "electronicSignatures30d")
                .containsExactly(1L, 5L, 9L, 40L);
        assertThat(response.compliance()).extracting("openAccessReviews", "openAuditTrailReviews", "openControlledCopyDiscrepancies")
                .containsExactly(2L, 3L, 4L);
        verify(userRepository).countByLockedUntilAfter(NOW);
    }

    @Test
    void passesThroughAMissingConnectionPoolInsteadOfInventingNumbers() {
        var noPool = new SystemInfoResponse(info().server(),
                new SystemInfoResponse.DatabaseInfo("PostgreSQL", "17.10", "pg", "42", "551", 551, null, null, null), List.of());
        when(systemInfoService.getSystemInfo()).thenReturn(noPool);

        var database = service().getSystemMonitoring(NOW).database();

        assertThat(database.poolActive()).isNull();
        assertThat(database.poolIdle()).isNull();
        assertThat(database.poolMax()).isNull();
    }
}
