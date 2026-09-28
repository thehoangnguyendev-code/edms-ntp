package com.eqms.service;

import com.eqms.dto.settings.SystemInfoResponse;
import com.eqms.dto.settings.SystemInfoResponse.DatabaseInfo;
import com.eqms.dto.settings.SystemInfoResponse.ServerInfo;
import com.eqms.dto.settings.SystemInfoResponse.TechComponent;
import com.eqms.util.DateTimeFormatUtils;
import com.zaxxer.hikari.HikariDataSource;
import org.flywaydb.core.Flyway;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.SpringBootVersion;
import org.springframework.core.SpringVersion;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;
import java.lang.management.ManagementFactory;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Assembles read-only runtime facts for Settings &gt; System Information.
 *
 * <p>No infrastructure secret or locator is read here — see {@link SystemInfoResponse}.
 */
@Service
public class SystemInfoService {

    private static final Logger log = LoggerFactory.getLogger(SystemInfoService.class);
    private static final String UNKNOWN = "—";

    private final Environment environment;
    private final DataSource dataSource;
    private final ObjectProvider<Flyway> flyway;

    public SystemInfoService(
            Environment environment,
            DataSource dataSource,
            ObjectProvider<Flyway> flyway
    ) {
        this.environment = environment;
        this.dataSource = dataSource;
        this.flyway = flyway;
    }

    public SystemInfoResponse getSystemInfo() {
        DatabaseInfo database = readDatabaseInfo();
        return new SystemInfoResponse(readServerInfo(), database, buildTechStack(database));
    }

    private ServerInfo readServerInfo() {
        var runtimeMx = ManagementFactory.getRuntimeMXBean();
        Runtime runtime = Runtime.getRuntime();
        long heapMax = runtime.maxMemory();
        long heapUsed = runtime.totalMemory() - runtime.freeMemory();

        // Spring Boot repackaged jars carry Implementation-Version in MANIFEST.MF; in an
        // exploded/IDE run it is absent and degrades to "—".
        String version = orUnknown(getClass().getPackage().getImplementationVersion());

        return new ServerInfo(
                orUnknown(environment.getProperty("spring.application.name")),
                version,
                Arrays.asList(environment.getActiveProfiles()),
                orUnknown(System.getProperty("java.version")),
                orUnknown(System.getProperty("java.vendor")),
                orUnknown(System.getProperty("java.vm.name")),
                orUnknown(System.getProperty("os.name")),
                orUnknown(System.getProperty("os.arch")),
                runtime.availableProcessors(),
                ZoneId.systemDefault().getId(),
                DateTimeFormatUtils.formatDateTime(Instant.ofEpochMilli(runtimeMx.getStartTime())),
                runtimeMx.getUptime(),
                heapUsed,
                heapMax
        );
    }

    private DatabaseInfo readDatabaseInfo() {
        String product = UNKNOWN;
        String productVersion = UNKNOWN;
        String driverName = UNKNOWN;
        String driverVersion = UNKNOWN;

        try (Connection connection = dataSource.getConnection()) {
            DatabaseMetaData md = connection.getMetaData();
            product = orUnknown(md.getDatabaseProductName());
            productVersion = orUnknown(md.getDatabaseProductVersion());
            driverName = orUnknown(md.getDriverName());
            driverVersion = orUnknown(md.getDriverVersion());
        } catch (Exception e) {
            log.warn("System info: unable to read database metadata: {}", e.getMessage());
        }

        String migrationVersion = UNKNOWN;
        int applied = 0;
        Flyway fw = flyway.getIfAvailable();
        if (fw != null) {
            try {
                var info = fw.info();
                applied = info.applied().length;
                var current = info.current();
                if (current != null && current.getVersion() != null) {
                    migrationVersion = current.getVersion().getVersion();
                }
            } catch (Exception e) {
                log.warn("System info: unable to read Flyway info: {}", e.getMessage());
            }
        }

        Integer poolMax = null;
        Integer poolActive = null;
        Integer poolIdle = null;
        if (dataSource instanceof HikariDataSource hikari) {
            poolMax = hikari.getMaximumPoolSize();
            try {
                var mx = hikari.getHikariPoolMXBean();
                if (mx != null) {
                    poolActive = mx.getActiveConnections();
                    poolIdle = mx.getIdleConnections();
                }
            } catch (Exception e) {
                log.warn("System info: unable to read Hikari pool stats: {}", e.getMessage());
            }
        }

        return new DatabaseInfo(product, productVersion, driverName, driverVersion,
                migrationVersion, applied, poolMax, poolActive, poolIdle);
    }

    private List<TechComponent> buildTechStack(DatabaseInfo database) {
        List<TechComponent> stack = new ArrayList<>();
        stack.add(new TechComponent("java", "Java", "Language / Runtime",
                orUnknown(System.getProperty("java.version"))));
        stack.add(new TechComponent("spring-boot", "Spring Boot", "Application Framework",
                orUnknown(SpringBootVersion.getVersion())));
        stack.add(new TechComponent("spring-framework", "Spring Framework", "Core Framework",
                orUnknown(SpringVersion.getVersion())));
        stack.add(new TechComponent("spring-security", "Spring Security", "Security",
                pkgVersion("org.springframework.security.core.SpringSecurityCoreVersion")));
        stack.add(new TechComponent("hibernate", "Hibernate ORM", "Persistence",
                pkgVersion("org.hibernate.Version")));
        stack.add(new TechComponent("postgresql", "PostgreSQL", "Database",
                shortDbVersion(database.productVersion())));
        stack.add(new TechComponent("postgresql-jdbc", "PostgreSQL JDBC Driver", "Database Driver",
                database.driverVersion()));
        stack.add(new TechComponent("flyway", "Flyway", "Schema Migration",
                classPackageVersion("org.flywaydb.core.Flyway")));
        stack.add(new TechComponent("tomcat", "Apache Tomcat", "Embedded Web Server",
                tomcatVersion()));
        stack.add(new TechComponent("lettuce", "Lettuce (Redis)", "Cache / Rate Limiting",
                classPackageVersion("io.lettuce.core.RedisClient")));
        stack.add(new TechComponent("minio", "MinIO SDK", "Object Storage",
                classPackageVersion("io.minio.MinioClient")));
        return stack;
    }

    /* ---- helpers ---- */

    private static String orUnknown(String value) {
        return value == null || value.isBlank() ? UNKNOWN : value;
    }

    /** Reads {@code Package.getImplementationVersion()} for the package that owns the given class. */
    private static String classPackageVersion(String className) {
        try {
            return orUnknown(Class.forName(className).getPackage().getImplementationVersion());
        } catch (Throwable t) {
            return UNKNOWN;
        }
    }

    /** Calls a static {@code getVersion()} on the given class (Spring / Spring Security style). */
    private static String pkgVersion(String className) {
        try {
            Class<?> clazz = Class.forName(className);
            Object v = clazz.getMethod("getVersion").invoke(null);
            return v != null ? orUnknown(v.toString()) : classPackageVersion(className);
        } catch (Throwable t) {
            return classPackageVersion(className);
        }
    }

    private static String tomcatVersion() {
        try {
            Class<?> serverInfo = Class.forName("org.apache.catalina.util.ServerInfo");
            Object v = serverInfo.getMethod("getServerNumber").invoke(null);
            return v != null ? orUnknown(v.toString()) : UNKNOWN;
        } catch (Throwable t) {
            return UNKNOWN;
        }
    }

    /** Trims the verbose PostgreSQL banner ("16.4 (Debian ...)" -> "16.4"). */
    private static String shortDbVersion(String raw) {
        if (raw == null || raw.isBlank()) {
            return UNKNOWN;
        }
        int space = raw.indexOf(' ');
        return space > 0 ? raw.substring(0, space) : raw;
    }
}
