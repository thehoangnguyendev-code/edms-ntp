package com.eqms.controller;

import com.eqms.dto.configuration.PublicBrandingResponse;
import com.eqms.service.PwaBrandingService;
import com.eqms.service.SystemConfigurationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class PublicBrandingControllerTest {

    private final SystemConfigurationService configuration = mock(SystemConfigurationService.class);
    private final PwaBrandingService pwa = mock(PwaBrandingService.class);
    private final ObjectMapper mapper = mock(ObjectMapper.class);
    private final PublicBrandingController controller = new PublicBrandingController(configuration, pwa, mapper);

    private ResponseEntity<PublicBrandingResponse> branding(String json) throws Exception {
        when(configuration.getPublicBranding()).thenReturn(mock(PublicBrandingResponse.class));
        when(mapper.writeValueAsBytes(any())).thenReturn(json.getBytes());
        return controller.getBranding();
    }

    @Test
    void brandingIsRevalidatedByEtagNotRefusedToEveryCache() throws Exception {
        ResponseEntity<PublicBrandingResponse> response = branding("{\"logo\":\"a\"}");
        assertThat(response.getHeaders().getCacheControl()).isEqualTo("no-cache");
        assertThat(response.getHeaders().getETag()).matches("\"[0-9a-f]{64}\"");
    }

    @Test
    void etagFollowsTheContentSoUnchangedBrandingAnswers304AndChangedBrandingDoesNot() throws Exception {
        String first = branding("{\"logo\":\"a\"}").getHeaders().getETag();
        String again = branding("{\"logo\":\"a\"}").getHeaders().getETag();
        String changed = branding("{\"logo\":\"b\"}").getHeaders().getETag();
        assertThat(again).isEqualTo(first);
        assertThat(changed).isNotEqualTo(first);
    }
}
