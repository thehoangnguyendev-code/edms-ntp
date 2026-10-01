package com.eqms;

import com.eqms.controller.AuthController;
import com.eqms.exception.GlobalExceptionHandler;
import com.eqms.service.AuthService;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AuthSignatureContractTest {
    @Test void omittedNullEmptyAndWhitespaceCredentialsAreRejectedBeforeVerification() throws Exception {
        var service = mock(AuthService.class);
        var mvc = MockMvcBuilders.standaloneSetup(new AuthController(service, null, null, false))
                .setControllerAdvice(new GlobalExceptionHandler()).build();
        for (String body : new String[] {
                "{\"password\":\"secret\"}",
                "{\"username\":null,\"password\":\"secret\"}",
                "{\"username\":\"\",\"password\":\"secret\"}",
                "{\"username\":\"  \",\"password\":\"secret\"}",
                "{\"username\":\"admin\"}",
                "{\"username\":\"admin\",\"password\":\"  \"}"
        }) {
            mvc.perform(post("/auth/verify-signature").contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isUnprocessableEntity());
        }
        verifyNoInteractions(service);
    }
}
