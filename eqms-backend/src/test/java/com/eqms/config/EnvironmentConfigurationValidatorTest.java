package com.eqms.config;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class EnvironmentConfigurationValidatorTest {

    private static final String DEV_FLYWAY = "classpath:db/migration,classpath:db/migration-dev";
    private static final String CONTROLLED_FLYWAY = "classpath:db/migration";

    private static EnvironmentConfigurationValidator validator(
            String environment, boolean strict, String flyway, String url, String records, String templates) {
        return new EnvironmentConfigurationValidator(environment, strict, flyway, url, records, templates, true);
    }

    @Test
    void devKeepsItsConvenientDefaultsAndExistingBucketNames() {
        assertThatCode(() -> validator("DEV", false, DEV_FLYWAY, "jdbc:postgresql://postgres:5432/eqms-database",
                "eqms-gmp-records", "eqms-templates").afterSingletonsInstantiated()).doesNotThrowAnyException();
    }

    @Test
    void devCannotPointAtATestOrProdBucket() {
        assertThatThrownBy(() -> validator("DEV", false, DEV_FLYWAY, "jdbc:postgresql://postgres:5432/eqms-database",
                "eqms-prod-gmp-records", "eqms-templates").afterSingletonsInstantiated())
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("records").hasMessageContaining("DEV");
        assertThatThrownBy(() -> validator("DEV", false, DEV_FLYWAY, "jdbc:postgresql://postgres:5432/eqms-database",
                "eqms-gmp-records", "eqms-test-templates").afterSingletonsInstantiated())
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("templates");
    }

    @Test
    void testAcceptsOnlyTestBucketsAndTheControlledConfiguration() {
        assertThatCode(() -> validator("TEST", true, CONTROLLED_FLYWAY, "jdbc:postgresql://postgres:5432/eqms_test",
                "eqms-test-gmp-records", "eqms-test-templates").afterSingletonsInstantiated()).doesNotThrowAnyException();
        assertThatThrownBy(() -> validator("TEST", true, CONTROLLED_FLYWAY, "jdbc:postgresql://postgres:5432/eqms_test",
                "eqms-gmp-records", "eqms-test-templates").afterSingletonsInstantiated())
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("TEST");
        assertThatThrownBy(() -> validator("TEST", true, CONTROLLED_FLYWAY, "jdbc:postgresql://postgres:5432/eqms_test",
                "eqms-prod-gmp-records", "eqms-test-templates").afterSingletonsInstantiated())
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void prodAcceptsOnlyProdBuckets() {
        assertThatCode(() -> validator("PROD", true, CONTROLLED_FLYWAY, "jdbc:postgresql://postgres:5432/eqms_prod",
                "eqms-prod-gmp-records", "eqms-prod-templates").afterSingletonsInstantiated()).doesNotThrowAnyException();
        assertThatThrownBy(() -> validator("PROD", true, CONTROLLED_FLYWAY, "jdbc:postgresql://postgres:5432/eqms_prod",
                "eqms-test-gmp-records", "eqms-prod-templates").afterSingletonsInstantiated())
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("PROD");
    }

    @ParameterizedTest
    @ValueSource(strings = {"TEST", "PROD"})
    void controlledEnvironmentsRequireStrictSecrets(String environment) {
        String bucket = "eqms-" + environment.toLowerCase() + "-";
        assertThatThrownBy(() -> validator(environment, false, CONTROLLED_FLYWAY, "jdbc:postgresql://postgres:5432/eqms_x",
                bucket + "gmp-records", bucket + "templates").afterSingletonsInstantiated())
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("strict");
    }

    @ParameterizedTest
    @ValueSource(strings = {"TEST", "PROD"})
    void controlledEnvironmentsNeverLoadDevelopmentOnlyMigrations(String environment) {
        String bucket = "eqms-" + environment.toLowerCase() + "-";
        assertThatThrownBy(() -> validator(environment, true, DEV_FLYWAY, "jdbc:postgresql://postgres:5432/eqms_x",
                bucket + "gmp-records", bucket + "templates").afterSingletonsInstantiated())
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("migrations");
    }

    @ParameterizedTest
    @ValueSource(strings = {"TEST", "PROD"})
    void controlledEnvironmentsNeverUseTheDevelopmentDatabaseName(String environment) {
        String bucket = "eqms-" + environment.toLowerCase() + "-";
        assertThatThrownBy(() -> validator(environment, true, CONTROLLED_FLYWAY, "jdbc:postgresql://postgres:5432/eqms-database?x=1",
                bucket + "gmp-records", bucket + "templates").afterSingletonsInstantiated())
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("database");
    }

    @Test
    void anUnknownOrBlankEnvironmentIsRejectedRatherThanTreatedAsDev() {
        assertThatThrownBy(() -> validator("STAGING", true, CONTROLLED_FLYWAY, "", "a", "b"))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> validator(" ", true, CONTROLLED_FLYWAY, "", "a", "b"))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void environmentNamesAreCaseInsensitiveAndTrimmed() {
        assertThat(DeploymentEnvironment.parse(" prod ")).isEqualTo(DeploymentEnvironment.PROD);
    }

    @Test
    void messagesNeverEchoTheBucketName() {
        assertThatThrownBy(() -> DeploymentEnvironment.PROD.requireBucketAllowed("secret-looking-bucket", "records"))
                .hasMessageNotContaining("secret-looking-bucket");
    }

    @Test
    void theBucketRuleIsCaseInsensitive() {
        assertThatCode(() -> DeploymentEnvironment.PROD.requireBucketAllowed("EQMS-PROD-GMP-RECORDS", "records"))
                .doesNotThrowAnyException();
        assertThatThrownBy(() -> DeploymentEnvironment.DEV.requireBucketAllowed("EQMS-PROD-x", "records"))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void parsesTheDatabaseNameFromAJdbcUrl() {
        assertThat(EnvironmentConfigurationValidator.databaseName("jdbc:postgresql://h:5432/Eqms_Prod?ssl=true")).isEqualTo("eqms_prod");
        assertThat(EnvironmentConfigurationValidator.databaseName("")).isEmpty();
    }
}
