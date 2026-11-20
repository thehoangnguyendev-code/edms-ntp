package com.eqms.service;

import com.eqms.service.IntegrationCheckService.Step;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class OnlyOfficeConnectionCheckServiceTest {
    private final OnlyOfficeConfigurationService configuration = mock(OnlyOfficeConfigurationService.class);
    private final OnlyOfficeDocumentEditService edit = mock(OnlyOfficeDocumentEditService.class);
    private final OnlyOfficeConnectionCheckService service = new OnlyOfficeConnectionCheckService(configuration, edit);
    private HttpServer server;

    @AfterEach
    void stop() {
        if (server != null) server.stop(0);
    }

    private String serve(int status, String body) throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/healthcheck", exchange -> {
            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(status, bytes.length);
            exchange.getResponseBody().write(bytes);
            exchange.close();
        });
        server.start();
        return "http://127.0.0.1:" + server.getAddress().getPort();
    }

    private void configured(String url, String secret) {
        when(configuration.getEffectiveConfiguration()).thenReturn(new OnlyOfficeConfigurationService.OnlyOfficeConfiguration(true, url, "http://backend:5000", secret));
    }

    private Step step(OnlyOfficeConnectionCheckService.Result result, String key) {
        return result.steps().stream().filter(s -> key.equals(s.key())).findFirst().orElseThrow();
    }

    @Test
    void nothingIsTestedWhenOnlyOfficeIsOffOrHasNoUrl() {
        when(configuration.getEffectiveConfiguration()).thenReturn(new OnlyOfficeConfigurationService.OnlyOfficeConfiguration(false, "http://x", "", "s"));
        var off = service.run();
        assertFalse(off.success());
        assertEquals("OnlyOffice is not enabled or the Document Server URL is not configured.", off.message());
        assertEquals(List.of(), off.steps());
        verifyNoInteractions(edit);
    }

    @Test
    void aHealthyServerThatAcceptsTheSecretIsReportedWithBothSteps() throws Exception {
        configured(serve(200, "true"), "secret");
        when(edit.checkCommandService()).thenReturn(0);

        var result = service.run();

        assertTrue(result.success());
        assertEquals(OnlyOfficeConnectionCheckService.OK, step(result, "reachable").status());
        assertEquals(OnlyOfficeConnectionCheckService.OK, step(result, "jwt").status());
        assertTrue(result.message().contains("reachable and healthy"));
    }

    @Test
    void aRefusedSecretIsAFailureEvenThoughTheServerIsHealthy() throws Exception {
        configured(serve(200, "true"), "secret");
        when(edit.checkCommandService()).thenReturn(6);

        var result = service.run();

        assertFalse(result.success());
        assertEquals(OnlyOfficeConnectionCheckService.OK, step(result, "reachable").status());
        assertEquals(OnlyOfficeConnectionCheckService.FAILED, step(result, "jwt").status());
        assertTrue(result.message().contains("refused the saved JWT secret"));
    }

    @Test
    void whatCannotBeConfirmedIsNotClaimedAndDoesNotTurnAHealthyServerIntoAFailure() throws Exception {
        String url = serve(200, "true");
        configured(url, "secret");
        when(edit.checkCommandService()).thenReturn(1);
        var unknownCode = service.run();
        assertTrue(unknownCode.success());
        assertEquals(OnlyOfficeConnectionCheckService.NOT_CHECKED, step(unknownCode, "jwt").status());

        when(edit.checkCommandService()).thenThrow(new IllegalStateException("down"));
        var unreachableCommand = service.run();
        assertTrue(unreachableCommand.success());
        assertEquals(OnlyOfficeConnectionCheckService.NOT_CHECKED, step(unreachableCommand, "jwt").status());

        configured(url, "");
        var noSecret = service.run();
        assertEquals(OnlyOfficeConnectionCheckService.NOT_CHECKED, step(noSecret, "jwt").status());
        assertEquals("No JWT secret is saved.", step(noSecret, "jwt").detail());
    }

    @Test
    void anUnhealthyAnswerStopsBeforeTheSecretIsLookedAt() throws Exception {
        configured(serve(502, "bad gateway"), "secret");

        var result = service.run();

        assertFalse(result.success());
        assertEquals(OnlyOfficeConnectionCheckService.FAILED, step(result, "reachable").status());
        assertEquals(OnlyOfficeConnectionCheckService.NOT_CHECKED, step(result, "jwt").status());
        assertTrue(result.message().contains("HTTP 502"));
        verifyNoInteractions(edit);
    }

    @Test
    void anUnreachableServerIsReportedAsSuch() {
        configured("http://127.0.0.1:1", "secret");

        var result = service.run();

        assertFalse(result.success());
        assertTrue(result.message().startsWith("Unable to reach the OnlyOffice Document Server"));
        assertEquals(OnlyOfficeConnectionCheckService.FAILED, step(result, "reachable").status());
        verifyNoInteractions(edit);
    }
}
