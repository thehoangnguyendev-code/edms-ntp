package com.eqms;

import com.eqms.entity.SystemConfiguration;
import com.eqms.repository.SystemConfigurationRepository;
import com.eqms.service.OfficeOnlineConfigurationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class OfficeOnlineConfigurationServiceSecurityTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void genericConfigurationResponseNeverContainsGraphClientSecret() throws Exception {
        String sentinelSecret = "graph-client-secret-must-never-leave-server";
        SystemConfiguration config = new SystemConfiguration();
        ObjectNode general = objectMapper.createObjectNode();
        ObjectNode officeOnline = general.putObject("backupSettings").putObject("officeOnline");
        officeOnline.put("enabled", true);
        officeOnline.put("clientSecret", sentinelSecret);
        config.setGeneralConfig(general);

        SystemConfigurationRepository repository = mock(SystemConfigurationRepository.class);
        when(repository.findByConfigKey("default")).thenReturn(Optional.of(config));
        OfficeOnlineConfigurationService service = new OfficeOnlineConfigurationService(repository, objectMapper);

        String response = objectMapper.writeValueAsString(service.sanitizeGeneralConfigForResponse(general));

        assertThat(response).doesNotContain(sentinelSecret);
        assertThat(response).contains("\"clientSecret\":\"\"");
        assertThat(response).contains("\"clientSecretConfigured\":true");
        assertThat(response).contains(OfficeOnlineConfigurationService.SECRET_MASK);
    }

    @Test
    void dedicatedOfficeOnlineResponseNeverContainsGraphClientSecret() {
        String sentinelSecret = "graph-client-secret-must-never-leave-server";
        SystemConfiguration config = new SystemConfiguration();
        ObjectNode general = objectMapper.createObjectNode();
        general.putObject("backupSettings").putObject("officeOnline").put("clientSecret", sentinelSecret);
        config.setGeneralConfig(general);

        SystemConfigurationRepository repository = mock(SystemConfigurationRepository.class);
        when(repository.findByConfigKey("default")).thenReturn(Optional.of(config));
        OfficeOnlineConfigurationService service = new OfficeOnlineConfigurationService(repository, objectMapper);

        OfficeOnlineConfigurationService.OfficeOnlineConfiguration response = service.getConfigurationForResponse();

        assertThat(response.clientSecret()).isEmpty();
    }
}
