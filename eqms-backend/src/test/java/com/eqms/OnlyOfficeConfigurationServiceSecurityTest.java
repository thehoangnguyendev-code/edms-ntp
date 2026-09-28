package com.eqms;

import com.eqms.entity.SystemConfiguration;
import com.eqms.repository.SystemConfigurationRepository;
import com.eqms.service.OnlyOfficeConfigurationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class OnlyOfficeConfigurationServiceSecurityTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void genericConfigurationResponseNeverContainsJwtSecret() throws Exception {
        String sentinelSecret = "onlyoffice-jwt-secret-must-never-leave-server";
        SystemConfiguration config = new SystemConfiguration();
        ObjectNode general = objectMapper.createObjectNode();
        ObjectNode onlyOffice = general.putObject("backupSettings").putObject("onlyOffice");
        onlyOffice.put("enabled", true);
        onlyOffice.put("jwtSecret", sentinelSecret);
        config.setGeneralConfig(general);

        SystemConfigurationRepository repository = mock(SystemConfigurationRepository.class);
        when(repository.findByConfigKey("default")).thenReturn(Optional.of(config));
        OnlyOfficeConfigurationService service = new OnlyOfficeConfigurationService(repository, objectMapper);

        String response = objectMapper.writeValueAsString(service.sanitizeGeneralConfigForResponse(general));

        assertThat(response).doesNotContain(sentinelSecret);
        assertThat(response).contains("\"jwtSecret\":\"\"");
        assertThat(response).contains("\"jwtSecretConfigured\":true");
        assertThat(response).contains(OnlyOfficeConfigurationService.SECRET_MASK);
    }

    @Test
    void dedicatedOnlyOfficeResponseNeverContainsJwtSecret() {
        String sentinelSecret = "onlyoffice-jwt-secret-must-never-leave-server";
        SystemConfiguration config = new SystemConfiguration();
        ObjectNode general = objectMapper.createObjectNode();
        general.putObject("backupSettings").putObject("onlyOffice").put("jwtSecret", sentinelSecret);
        config.setGeneralConfig(general);

        SystemConfigurationRepository repository = mock(SystemConfigurationRepository.class);
        when(repository.findByConfigKey("default")).thenReturn(Optional.of(config));
        OnlyOfficeConfigurationService service = new OnlyOfficeConfigurationService(repository, objectMapper);

        OnlyOfficeConfigurationService.OnlyOfficeConfiguration response = service.getConfigurationForResponse();

        assertThat(response.jwtSecret()).isEmpty();
    }

}
