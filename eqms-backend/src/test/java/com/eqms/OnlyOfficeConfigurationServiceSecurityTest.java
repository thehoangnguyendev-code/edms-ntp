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

    private ObjectNode incoming(String secret, String changedAtEcho) {
        ObjectNode general = objectMapper.createObjectNode();
        ObjectNode onlyOffice = general.putObject("backupSettings").putObject("onlyOffice");
        onlyOffice.put("enabled", true);
        onlyOffice.put("jwtSecret", secret);
        if (changedAtEcho != null) onlyOffice.put("jwtSecretChangedAt", changedAtEcho);
        return general;
    }

    private ObjectNode stored(String secret, String changedAt) {
        ObjectNode general = objectMapper.createObjectNode();
        ObjectNode onlyOffice = general.putObject("backupSettings").putObject("onlyOffice");
        onlyOffice.put("jwtSecret", secret);
        if (changedAt != null) onlyOffice.put("jwtSecretChangedAt", changedAt);
        return general;
    }

    private OnlyOfficeConfigurationService service() {
        return new OnlyOfficeConfigurationService(mock(SystemConfigurationRepository.class), objectMapper);
    }

    private String changedAt(com.fasterxml.jackson.databind.JsonNode merged) {
        var node = merged.path("backupSettings").path("onlyOffice").path("jwtSecretChangedAt");
        return node.isMissingNode() ? null : node.asText();
    }

    @Test
    void theTimeTheSecretChangedMovesOnlyWhenTheStoredSecretReallyChanges() {
        String before = "2026-11-01T00:00:00Z";

        // a new secret: the time is now (never the one the request carries)
        String changed = changedAt(service().mergeGeneralConfigForStorage(incoming("new-secret", "1999-01-01T00:00:00Z"), stored("old-secret", before)));
        assertThat(changed).isNotNull().isNotEqualTo(before).isNotEqualTo("1999-01-01T00:00:00Z");
        assertThat(java.time.Instant.parse(changed)).isAfter(java.time.Instant.parse(before));

        // the masked value or the same secret again is no change: the time is kept as it was, even if the request lies about it
        assertThat(changedAt(service().mergeGeneralConfigForStorage(incoming(OnlyOfficeConfigurationService.SECRET_MASK, "1999-01-01T00:00:00Z"), stored("old-secret", before)))).isEqualTo(before);
        assertThat(changedAt(service().mergeGeneralConfigForStorage(incoming("old-secret", null), stored("old-secret", before)))).isEqualTo(before);
    }

    @Test
    void theTimeIsNotInventedWhenNothingWasEverChangedAndTheRequestCannotSetIt() {
        // no secret before, none now: there is no time to show, and a time sent by the request is dropped
        assertThat(changedAt(service().mergeGeneralConfigForStorage(incoming("", "1999-01-01T00:00:00Z"), stored("", null)))).isNull();
        // the first secret ever set counts as a change
        assertThat(changedAt(service().mergeGeneralConfigForStorage(incoming("first", null), stored("", null)))).isNotNull();
    }

    @Test
    void clearingTheSecretIsAChangeToo() {
        ObjectNode request = incoming("", null);
        ((ObjectNode) request.path("backupSettings").path("onlyOffice")).put("clearJwtSecret", true);
        assertThat(changedAt(service().mergeGeneralConfigForStorage(request, stored("old-secret", "2026-11-01T00:00:00Z")))).isNotEqualTo("2026-11-01T00:00:00Z");
    }

}
