package com.eqms.dto.settings;

import java.util.List;

/**
 * Read-only runtime facts for the Settings &gt; System Information screen.
 *
 * <p>Deliberately excludes any infrastructure secret or locator: no datasource URL, host, port,
 * credentials, or internal hostnames. Everything here is either a version string, a coarse counter,
 * or a value already visible to an authenticated operator.
 */
public record SystemInfoResponse(
        ServerInfo server,
        DatabaseInfo database,
        List<TechComponent> techStack
) {

    public record ServerInfo(
            String applicationName,
            String version,
            List<String> activeProfiles,
            String javaVersion,
            String javaVendor,
            String jvmName,
            String osName,
            String osArch,
            int availableProcessors,
            String timeZone,
            String startedAt,
            long uptimeMillis,
            long heapUsedBytes,
            long heapMaxBytes
    ) {
    }

    public record DatabaseInfo(
            String product,
            String productVersion,
            String driverName,
            String driverVersion,
            String schemaMigrationVersion,
            int appliedMigrations,
            Integer poolMax,
            Integer poolActive,
            Integer poolIdle
    ) {
    }

    /** One entry in the backend technology stack list (name + resolved runtime version). */
    public record TechComponent(
            String id,
            String name,
            String category,
            String version
    ) {
    }
}
