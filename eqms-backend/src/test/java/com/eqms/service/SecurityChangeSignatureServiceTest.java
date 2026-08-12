package com.eqms.service;

import com.eqms.auth.TokenService;
import com.eqms.auth.UnauthorizedException;
import org.springframework.security.access.AccessDeniedException;
import com.eqms.entity.UserAccount;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Master plan 21.1: "Critical changes require e-sign when configured" —
 * a denied signature check must happen BEFORE any mutation (no side effect).
 */
@ExtendWith(MockitoExtension.class)
class SecurityChangeSignatureServiceTest {

    @Mock TokenService tokenService;
    @Mock ElectronicSignatureService electronicSignatureService;

    private UserAccount user(UUID id) {
        UserAccount u = new UserAccount();
        u.setId(id);
        return u;
    }

    private SecurityChangeSignatureService service(boolean required) {
        return new SecurityChangeSignatureService(tokenService, electronicSignatureService, required);
    }

    @Test
    void missingToken_isDenied() {
        // 403, not 401: a missing/invalid e-sign token is an authorization failure of the
        // request — the session itself is fine, so the frontend must not treat it as logout.
        assertThatThrownBy(() -> service(true).requireValidToken(user(UUID.randomUUID()), null))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("required");
        verifyNoInteractions(electronicSignatureService);
    }

    @Test
    void blankToken_isDenied() {
        assertThatThrownBy(() -> service(true).requireValidToken(user(UUID.randomUUID()), "  "))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void invalidOrExpiredToken_isDenied() {
        when(tokenService.parseSignatureToken(any())).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service(true).requireValidToken(user(UUID.randomUUID()), "bad-token"))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("invalid or expired");
    }

    @Test
    void anonymousActor_isDenied() {
        assertThatThrownBy(() -> service(true).requireValidToken(null, "token"))
                .isInstanceOf(UnauthorizedException.class);
    }

    @Test
    void whenEsignDisabled_validationIsSkipped() {
        assertThatCode(() -> service(false).requireValidToken(user(UUID.randomUUID()), null))
                .doesNotThrowAnyException();
        verifyNoInteractions(tokenService, electronicSignatureService);
    }

    @Test
    void whenEsignDisabled_recordIsSkipped() {
        service(false).record(user(UUID.randomUUID()), null, "ACCESS_PROFILE_CHANGE",
                "ACCESS_PROFILE", UUID.randomUUID(), "Test", null, null, null);
        verifyNoInteractions(electronicSignatureService);
    }
}
