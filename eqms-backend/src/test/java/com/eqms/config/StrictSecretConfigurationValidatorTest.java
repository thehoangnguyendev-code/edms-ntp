package com.eqms.config;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class StrictSecretConfigurationValidatorTest {

    private static final String STRONG_JWT_SECRET = "this-is-a-strong-non-default-jwt-secret-value-12345";
    private static final String STRONG_MINIO_SECRET = "this-is-a-strong-non-default-minio-secret-value";

    @Test
    void localDevelopmentModeAllowsConvenientDefaults() {
        StrictSecretConfigurationValidator validator = new StrictSecretConfigurationValidator(
                false,
                StrictSecretConfigurationValidator.DEVELOPMENT_JWT_SECRET,
                true,
                StrictSecretConfigurationValidator.DEVELOPMENT_MINIO_ACCESS_KEY,
                StrictSecretConfigurationValidator.DEVELOPMENT_MINIO_SECRET_KEY
        );

        assertThatCode(validator::afterSingletonsInstantiated).doesNotThrowAnyException();
    }

    @Test
    void strictModeRejectsKnownDevelopmentJwtSecret() {
        StrictSecretConfigurationValidator validator = new StrictSecretConfigurationValidator(
                true,
                StrictSecretConfigurationValidator.DEVELOPMENT_JWT_SECRET,
                true,
                "production-minio-user",
                STRONG_MINIO_SECRET
        );

        assertThatThrownBy(validator::afterSingletonsInstantiated)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("JWT");
    }

    @Test
    void strictModeRejectsKnownDevelopmentMinioCredential() {
        StrictSecretConfigurationValidator validator = new StrictSecretConfigurationValidator(
                true,
                STRONG_JWT_SECRET,
                true,
                StrictSecretConfigurationValidator.DEVELOPMENT_MINIO_ACCESS_KEY,
                STRONG_MINIO_SECRET
        );

        assertThatThrownBy(validator::afterSingletonsInstantiated)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("MinIO");
    }

    @Test
    void strictModeAllowsStrongNonDefaultConfiguredSecrets() {
        StrictSecretConfigurationValidator validator = new StrictSecretConfigurationValidator(
                true,
                STRONG_JWT_SECRET,
                true,
                "production-minio-user",
                STRONG_MINIO_SECRET
        );

        assertThatCode(validator::afterSingletonsInstantiated).doesNotThrowAnyException();
    }
}
