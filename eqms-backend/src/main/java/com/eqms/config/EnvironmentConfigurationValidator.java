package com.eqms.config;

import org.springframework.beans.factory.SmartInitializingSingleton;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Locale;

/**
 * Startup checks that keep the three environments apart. DEV keeps its convenient defaults; TEST and PROD must run the
 * controlled configuration, because validation is only meaningful on the same configuration that will be released.
 * Values are never included in an exception message.
 */
@Component
public final class EnvironmentConfigurationValidator implements SmartInitializingSingleton {

    static final String DEVELOPMENT_DATABASE_NAME = "eqms-database";

    private final DeploymentEnvironment environment;
    private final boolean strictSecrets;
    private final String flywayLocations;
    private final String datasourceUrl;
    private final String recordsBucket;
    private final String templatesBucket;
    private final boolean minioEnabled;

    public EnvironmentConfigurationValidator(
            @Value("${app.environment:DEV}") String environment,
            @Value("${app.security.strict-secrets:false}") boolean strictSecrets,
            @Value("${spring.flyway.locations:classpath:db/migration}") String flywayLocations,
            @Value("${spring.datasource.url:}") String datasourceUrl,
            @Value("${app.minio.bucket:eqms-gmp-records}") String recordsBucket,
            @Value("${app.minio.templates-bucket:eqms-templates}") String templatesBucket,
            @Value("${app.minio.enabled:true}") boolean minioEnabled
    ) {
        this.environment = DeploymentEnvironment.parse(environment);
        this.strictSecrets = strictSecrets;
        this.flywayLocations = flywayLocations == null ? "" : flywayLocations;
        this.datasourceUrl = datasourceUrl == null ? "" : datasourceUrl;
        this.recordsBucket = recordsBucket;
        this.templatesBucket = templatesBucket;
        this.minioEnabled = minioEnabled;
    }

    @Override
    public void afterSingletonsInstantiated() {
        if (minioEnabled) {
            environment.requireBucketAllowed(recordsBucket, "records");
            environment.requireBucketAllowed(templatesBucket, "templates");
        }
        if (!environment.isControlled()) {
            return;
        }
        if (!strictSecrets) {
            throw new IllegalStateException(environment + " must run with strict secret validation enabled");
        }
        if (flywayLocations.toLowerCase(Locale.ROOT).contains("migration-dev")) {
            throw new IllegalStateException(environment + " must not load development-only database migrations");
        }
        if (databaseName(datasourceUrl).equals(DEVELOPMENT_DATABASE_NAME)) {
            throw new IllegalStateException(environment + " must not use the development database name");
        }
    }

    static String databaseName(String jdbcUrl) {
        int slash = jdbcUrl.lastIndexOf('/');
        if (slash < 0 || slash == jdbcUrl.length() - 1) {
            return "";
        }
        String tail = jdbcUrl.substring(slash + 1);
        int query = tail.indexOf('?');
        return (query >= 0 ? tail.substring(0, query) : tail).toLowerCase(Locale.ROOT);
    }

    public DeploymentEnvironment environment() {
        return environment;
    }
}
