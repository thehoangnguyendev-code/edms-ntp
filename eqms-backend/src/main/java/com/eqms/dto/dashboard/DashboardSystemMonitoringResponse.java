package com.eqms.dto.dashboard;

import java.time.Instant;
import java.util.Map;

/**
 * Facts the administrative dashboard shows to monitor the system. Every figure is read when the request is made;
 * nothing is cached or estimated. Deliberately smaller than Settings &gt; System Information: no operating system,
 * vendor, driver or host detail, only what an operator needs to judge whether the system is healthy.
 */
public record DashboardSystemMonitoringResponse(
        Instant generatedAt,
        Runtime runtime,
        Database database,
        Security security,
        Compliance compliance
) {

    public record Runtime(
            String applicationVersion,
            String startedAt,
            long uptimeMillis,
            long heapUsedBytes,
            long heapMaxBytes,
            int availableProcessors
    ) {
    }

    /** Pool figures are null when the connection pool does not expose them. */
    public record Database(
            String schemaMigrationVersion,
            int appliedMigrations,
            Integer poolActive,
            Integer poolIdle,
            Integer poolMax
    ) {
    }

    public record Security(
            /** Every user status, in declaration order, including those with no user. */
            Map<String, Long> usersByStatus,
            /** Users whose account is locked right now (lockout still running). */
            long lockedAccounts,
            /** Sessions that are active, not revoked and not expired. */
            long activeSessions,
            long failedLogins24h,
            long electronicSignatures30d
    ) {
    }

    public record Compliance(
            long openAccessReviews,
            long openAuditTrailReviews,
            long openControlledCopyDiscrepancies
    ) {
    }
}
