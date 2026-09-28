package com.eqms.config;

import org.springframework.beans.factory.SmartInitializingSingleton;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

/**
 * Fail closed for the controlled deployment profile.  Local development deliberately keeps
 * convenient defaults, so the check is explicitly opt-in via app.security.strict-secrets.
 * Values are never included in an exception or log message.
 */
@Component
public final class StrictSecretConfigurationValidator implements SmartInitializingSingleton {

    static final String DEVELOPMENT_JWT_SECRET = "EQMS_DEV_AUTH_SECRET_CHANGE_ME_32_BYTES_MINIMUM_KEY";
    static final String DEVELOPMENT_MINIO_ACCESS_KEY = "eqms-minio";
    static final String DEVELOPMENT_MINIO_SECRET_KEY = "eqms-minio-secret";

    private final boolean strictSecrets;
    private final String jwtSecret;
    private final boolean minioEnabled;
    private final String minioAccessKey;
    private final String minioSecretKey;

    public StrictSecretConfigurationValidator(
            @Value("${app.security.strict-secrets:false}") boolean strictSecrets,
            @Value("${app.auth.jwt-secret}") String jwtSecret,
            @Value("${app.minio.enabled:true}") boolean minioEnabled,
            @Value("${app.minio.access-key}") String minioAccessKey,
            @Value("${app.minio.secret-key}") String minioSecretKey
    ) {
        this.strictSecrets = strictSecrets;
        this.jwtSecret = jwtSecret;
        this.minioEnabled = minioEnabled;
        this.minioAccessKey = minioAccessKey;
        this.minioSecretKey = minioSecretKey;
    }

    @Override
    public void afterSingletonsInstantiated() {
        if (!strictSecrets) {
            return;
        }
        requireProductionJwtSecret(jwtSecret);
        if (minioEnabled) {
            requireNonDevelopmentMinioCredentials(minioAccessKey, minioSecretKey);
        }
    }

    private static void requireProductionJwtSecret(String value) {
        if (isBlank(value) || DEVELOPMENT_JWT_SECRET.equals(value)
                || value.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("Strict secret validation rejected the configured JWT signing secret");
        }
    }

    private static void requireNonDevelopmentMinioCredentials(String accessKey, String secretKey) {
        if (isBlank(accessKey) || isBlank(secretKey)
                || DEVELOPMENT_MINIO_ACCESS_KEY.equals(accessKey)
                || DEVELOPMENT_MINIO_SECRET_KEY.equals(secretKey)) {
            throw new IllegalStateException("Strict secret validation rejected the configured MinIO credentials");
        }
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
