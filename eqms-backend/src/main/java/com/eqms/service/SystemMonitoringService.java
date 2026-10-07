package com.eqms.service;

import com.eqms.dto.dashboard.DashboardSystemMonitoringResponse;
import com.eqms.dto.dashboard.DashboardSystemMonitoringResponse.Compliance;
import com.eqms.dto.dashboard.DashboardSystemMonitoringResponse.Database;
import com.eqms.dto.dashboard.DashboardSystemMonitoringResponse.Runtime;
import com.eqms.dto.dashboard.DashboardSystemMonitoringResponse.Security;
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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Read-only figures for the system-monitoring cards of the administrative dashboard. Authorization is the caller's
 * ({@code dashboard.admin.view}, checked by {@code DashboardController}); this class only counts.
 */
@Service
@Transactional(readOnly = true)
public class SystemMonitoringService {

    /** Audit event the login flow writes for every wrong password (see AuthService). */
    static final String FAILED_LOGIN_EVENT = "login_failed";
    /** The status an electronic signature has once it was applied. */
    static final String SIGNED = "SIGNED";
    /** The status of a review campaign that has not been completed or cancelled. */
    static final String CAMPAIGN_IN_PROGRESS = "IN_PROGRESS";

    private static final Duration FAILED_LOGIN_WINDOW = Duration.ofHours(24);
    private static final Duration SIGNATURE_WINDOW = Duration.ofDays(30);

    private final SystemInfoService systemInfoService;
    private final UserAccountRepository userRepo;
    private final AuthSessionRepository sessionRepo;
    private final AuthAuditLogRepository authAuditRepo;
    private final ElectronicSignatureRepository signatureRepo;
    private final AccessReviewCampaignRepository accessReviewRepo;
    private final AuditTrailReviewCampaignRepository auditReviewRepo;
    private final ControlledCopyBatchStatusDiscrepancyRepository discrepancyRepo;

    public SystemMonitoringService(
            SystemInfoService systemInfoService,
            UserAccountRepository userRepo,
            AuthSessionRepository sessionRepo,
            AuthAuditLogRepository authAuditRepo,
            ElectronicSignatureRepository signatureRepo,
            AccessReviewCampaignRepository accessReviewRepo,
            AuditTrailReviewCampaignRepository auditReviewRepo,
            ControlledCopyBatchStatusDiscrepancyRepository discrepancyRepo
    ) {
        this.systemInfoService = systemInfoService;
        this.userRepo = userRepo;
        this.sessionRepo = sessionRepo;
        this.authAuditRepo = authAuditRepo;
        this.signatureRepo = signatureRepo;
        this.accessReviewRepo = accessReviewRepo;
        this.auditReviewRepo = auditReviewRepo;
        this.discrepancyRepo = discrepancyRepo;
    }

    public DashboardSystemMonitoringResponse getSystemMonitoring() {
        return getSystemMonitoring(Instant.now());
    }

    /** Same as {@link #getSystemMonitoring()} with the clock fixed, so the time windows can be tested. */
    public DashboardSystemMonitoringResponse getSystemMonitoring(Instant now) {
        SystemInfoResponse info = systemInfoService.getSystemInfo();

        Runtime runtime = new Runtime(
                info.server().version(),
                info.server().startedAt(),
                info.server().uptimeMillis(),
                info.server().heapUsedBytes(),
                info.server().heapMaxBytes(),
                info.server().availableProcessors());

        Database database = new Database(
                info.database().schemaMigrationVersion(),
                info.database().appliedMigrations(),
                info.database().poolActive(),
                info.database().poolIdle(),
                info.database().poolMax());

        Map<String, Long> usersByStatus = new LinkedHashMap<>();
        for (UserStatus status : UserStatus.values()) {
            usersByStatus.put(status.name(), userRepo.countByStatus(status));
        }

        Security security = new Security(
                usersByStatus,
                userRepo.countByLockedUntilAfter(now),
                sessionRepo.countByStatusAndRevokedAtIsNullAndExpiresAtAfter(AuthSession.SessionStatus.ACTIVE, now),
                authAuditRepo.countByEventTypeAndCreatedAtAfter(FAILED_LOGIN_EVENT, now.minus(FAILED_LOGIN_WINDOW)),
                signatureRepo.countByStatusAndSignedAtAfter(SIGNED, now.minus(SIGNATURE_WINDOW)));

        Compliance compliance = new Compliance(
                accessReviewRepo.countByStatus(CAMPAIGN_IN_PROGRESS),
                auditReviewRepo.countByStatus(CAMPAIGN_IN_PROGRESS),
                discrepancyRepo.countByStatus(ControlledCopyBatchStatusDiscrepancy.STATUS_OPEN));

        return new DashboardSystemMonitoringResponse(now, runtime, database, security, compliance);
    }
}
