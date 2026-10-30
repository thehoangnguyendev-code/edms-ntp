package com.eqms.service;

import com.eqms.entity.SystemConfiguration;
import com.eqms.repository.SystemConfigurationRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class SessionTimeoutConfigurationTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private SystemConfigurationService service(String json) throws Exception {
        var repository = mock(SystemConfigurationRepository.class);
        var config = new SystemConfiguration();
        config.setSecurityConfig(mapper.readTree(json));
        config.setFeaturesConfig(mapper.readTree("[]"));
        when(repository.findByConfigKey("default")).thenReturn(Optional.of(config));
        return new SystemConfigurationService(repository, null, mapper, null, null, null, null, null,
                "http://localhost:9000", "bucket", "key", "secret", "documents", "controlled-copies", "templates", "training", "audit", "temp", 5);
    }
    @Test void oldConfigurationsRemainEnabledAndDisabledRetainsStoredMinutes() throws Exception {
        assertEquals(30, service("{}").getSessionTimeoutMinutes());
        assertEquals(30, service("{\"sessionTimeoutEnabled\":\"false\"}").getSessionTimeoutMinutes());
        var disabled = service("{\"sessionTimeoutEnabled\":false,\"sessionTimeoutMinutes\":45}");
        assertEquals(0, disabled.getSessionTimeoutMinutes());
        assertEquals(45, disabled.getSecurityConfiguration().sessionTimeoutMinutes());
        assertFalse(disabled.getSecurityConfiguration().sessionTimeoutEnabled());
        assertEquals(45, service("{\"sessionTimeoutEnabled\":true,\"sessionTimeoutMinutes\":45}").getSessionTimeoutMinutes());
    }
    @Test void rejectsNonBooleanToggle() throws Exception {
        var instance = service("{}");
        var invalid = mapper.readTree("{\"sessionTimeoutEnabled\":\"false\",\"sessionTimeoutMinutes\":30}");
        assertThrows(IllegalArgumentException.class, () -> ReflectionTestUtils.invokeMethod(instance, "validateSecurityConfig", invalid));
    }
}
