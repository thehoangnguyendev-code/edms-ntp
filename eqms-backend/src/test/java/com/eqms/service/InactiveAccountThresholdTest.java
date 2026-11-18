package com.eqms.service;

import com.eqms.entity.SystemConfiguration;
import com.eqms.repository.SystemConfigurationRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** SECURITY-AUTHORIZATION-REVIEW D5: the days without a sign-in that flag an account. 90 when never set, 0 switches the flag off, only 0 to 3650 is saved. */
class InactiveAccountThresholdTest {
    private final ObjectMapper mapper = new ObjectMapper();

    private SystemConfigurationService serviceWithSecurity(String securityJson) throws Exception {
        SystemConfigurationRepository repository = mock(SystemConfigurationRepository.class);
        SystemConfiguration config = new SystemConfiguration();
        config.setGeneralConfig(mapper.readTree("{}"));
        config.setFeaturesConfig(mapper.readTree("[]"));
        config.setSecurityConfig(mapper.readTree(securityJson));
        when(repository.findByConfigKey("default")).thenReturn(Optional.of(config));
        return new SystemConfigurationService(repository, null, mapper, null, null, null, null, null,
                "http://localhost:9000", "bucket", "key", "secret", "documents", "controlled-copies",
                "templates", "training", "audit", "temp", 5);
    }

    @Test
    void theThresholdIsNinetyDaysUntilTheAdministratorSetsOneAndZeroIsKept() throws Exception {
        assertThat(serviceWithSecurity("{}").inactiveAccountDays()).isEqualTo(90);
        assertThat(serviceWithSecurity("{\"inactiveAccountDays\":45}").inactiveAccountDays()).isEqualTo(45);
        assertThat(serviceWithSecurity("{\"inactiveAccountDays\":0}").inactiveAccountDays()).isZero();
        assertThat(serviceWithSecurity("{\"inactiveAccountDays\":-5}").inactiveAccountDays()).isEqualTo(90);
        assertThat(serviceWithSecurity("{\"inactiveAccountDays\":\"x\"}").inactiveAccountDays()).isEqualTo(90);
    }

    @Test
    void onlyAWholeNumberFromZeroTo3650IsSaved() throws Exception {
        SystemConfigurationService service = serviceWithSecurity("{}");
        for (String ok : new String[] {"{}", "{\"inactiveAccountDays\":0}", "{\"inactiveAccountDays\":90}", "{\"inactiveAccountDays\":3650}"}) {
            assertThatCode(() -> ReflectionTestUtils.invokeMethod(service, "validateSecurityConfig", mapper.readTree(withPolicyBasics(ok)))).as(ok).doesNotThrowAnyException();
        }
        for (String bad : new String[] {"{\"inactiveAccountDays\":-1}", "{\"inactiveAccountDays\":3651}", "{\"inactiveAccountDays\":\"ninety\"}", "{\"inactiveAccountDays\":1.5}"}) {
            assertThatThrownBy(() -> ReflectionTestUtils.invokeMethod(service, "validateSecurityConfig", mapper.readTree(withPolicyBasics(bad)))).as(bad).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("Inactive Account Threshold");
        }
    }

    /** The rest of the security settings stay valid, so only the field under test can make the check fail. */
    private static String withPolicyBasics(String json) {
        return json.equals("{}") ? "{\"passwordMinLength\":12}" : json.replace("{", "{\"passwordMinLength\":12,");
    }
}
