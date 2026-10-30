package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.entity.SystemConfiguration;
import com.eqms.entity.UserAccount;
import com.eqms.repository.SystemConfigurationRepository;
import com.eqms.service.AuthBackgroundVideoStore;
import com.eqms.service.AuthBackgroundVideoTranscoder;
import com.eqms.service.PermissionEvaluationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.access.AccessDeniedException;
import java.util.Optional;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AuthBackgroundVideoControllerTest {
    private final AuthBackgroundVideoStore store = mock(AuthBackgroundVideoStore.class);
    private final AuthBackgroundVideoTranscoder transcoder = mock(AuthBackgroundVideoTranscoder.class);
    private final CurrentUserService current = mock(CurrentUserService.class);
    private final PermissionEvaluationService permissions = mock(PermissionEvaluationService.class);
    private final SystemConfigurationRepository configurations = mock(SystemConfigurationRepository.class);
    private final AuthBackgroundVideoController controller = new AuthBackgroundVideoController(store, transcoder, current, permissions, configurations);

    @Test void unauthorizedUploadCannotTranscodeOrStore() {
        when(current.requireCurrentUser()).thenReturn(mock(UserAccount.class));
        assertThrows(AccessDeniedException.class, () -> controller.upload(new MockMultipartFile("video", new byte[]{1})));
        verifyNoInteractions(transcoder, store);
    }
    @Test void onlyConfiguredActiveVideoIsPublic() throws Exception {
        UUID active = UUID.randomUUID(), other = UUID.randomUUID();
        SystemConfiguration config = new SystemConfiguration();
        config.setGeneralConfig(new ObjectMapper().readTree("{\"appearance\":{\"authBackground\":{\"mode\":\"video\",\"videoId\":\"" + active + "\"}}}"));
        when(configurations.findByConfigKey("default")).thenReturn(Optional.of(config));
        when(store.read(active)).thenReturn(Optional.of(new byte[]{1, 2}));
        assertEquals(200, controller.active(active).getStatusCode().value());
        assertEquals(404, controller.active(other).getStatusCode().value());
        verify(store, never()).read(other);
    }
}
