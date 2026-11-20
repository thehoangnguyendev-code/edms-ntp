package com.eqms.service;

import com.eqms.service.IntegrationCheckService.Step;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

/**
 * The "Test connection" of the OnlyOffice Document Server, on the <b>saved</b> configuration. It looks at two things it can really verify from this side:
 * that the Document Server answers its own {@code /healthcheck}, and that the saved JWT secret is accepted by its command service. Whether the Document Server can
 * call this application back cannot be checked from here, so it is not claimed.
 */
@Service
public class OnlyOfficeConnectionCheckService {
    public static final String REACHABLE = "reachable";
    public static final String JWT = "jwt";
    public static final String OK = "OK";
    public static final String FAILED = "FAILED";
    public static final String NOT_CHECKED = "NOT_CHECKED";
    /** The command service's answer for a token it refuses. */
    static final int COMMAND_TOKEN_REFUSED = 6;

    public record Result(boolean success, String message, List<Step> steps) {}

    private final OnlyOfficeConfigurationService configuration;
    private final OnlyOfficeDocumentEditService edit;

    public OnlyOfficeConnectionCheckService(OnlyOfficeConfigurationService configuration, OnlyOfficeDocumentEditService edit) {
        this.configuration = configuration;
        this.edit = edit;
    }

    public Result run() {
        var config = configuration.getEffectiveConfiguration();
        if (!config.enabled() || !StringUtils.hasText(config.documentServerUrl())) {
            return new Result(false, "OnlyOffice is not enabled or the Document Server URL is not configured.", List.of());
        }
        List<Step> steps = new ArrayList<>();
        int statusCode;
        boolean healthy;
        try {
            // OnlyOffice's bundled nginx does not handle a plaintext HTTP/2 upgrade attempt cleanly (it returns 502), and java.net.http.HttpClient tries HTTP/2 first,
            // so the call is forced to HTTP/1.1 like every other call to the Document Server.
            var client = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).connectTimeout(Duration.ofSeconds(10)).build();
            var request = HttpRequest.newBuilder(URI.create(config.documentServerUrl() + "/healthcheck")).timeout(Duration.ofSeconds(10)).GET().build();
            var response = client.send(request, HttpResponse.BodyHandlers.ofString());
            statusCode = response.statusCode();
            healthy = statusCode == 200 && response.body() != null && response.body().toLowerCase().contains("true");
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            return unreachable(steps, ex);
        } catch (Exception ex) {
            return unreachable(steps, ex);
        }
        steps.add(new Step(REACHABLE, "Document Server reachable", healthy ? OK : FAILED,
                healthy ? "The Document Server answered its health check." : "The Document Server responded but did not report healthy (HTTP " + statusCode + ")."));
        if (!healthy) {
            steps.add(new Step(JWT, "JWT secret accepted", NOT_CHECKED, "Not checked: the Document Server is not healthy."));
            return new Result(false, "OnlyOffice Document Server responded but did not report healthy (HTTP " + statusCode + ").", steps);
        }

        Step jwt = jwtStep(config.jwtSecret());
        steps.add(jwt);
        return switch (jwt.status()) {
            case FAILED -> new Result(false, "OnlyOffice Document Server is reachable, but it refused the saved JWT secret.", steps);
            case OK -> new Result(true, "OnlyOffice Document Server is reachable and healthy. The saved JWT secret is accepted.", steps);
            default -> new Result(true, "OnlyOffice Document Server is reachable and healthy. The JWT secret could not be confirmed.", steps);
        };
    }

    private Result unreachable(List<Step> steps, Exception ex) {
        steps.add(new Step(REACHABLE, "Document Server reachable", FAILED, "Unable to reach the Document Server."));
        steps.add(new Step(JWT, "JWT secret accepted", NOT_CHECKED, "Not checked: the Document Server is not reachable."));
        return new Result(false, "Unable to reach the OnlyOffice Document Server: " + ex.getMessage(), steps);
    }

    private Step jwtStep(String savedSecret) {
        if (!StringUtils.hasText(savedSecret)) {
            return new Step(JWT, "JWT secret accepted", NOT_CHECKED, "No JWT secret is saved.");
        }
        try {
            int code = edit.checkCommandService();
            if (code == 0) return new Step(JWT, "JWT secret accepted", OK, "The Document Server accepted the saved secret.");
            if (code == COMMAND_TOKEN_REFUSED) {
                return new Step(JWT, "JWT secret accepted", FAILED, "The Document Server refused the saved secret: it must be the same value on both sides.");
            }
            return new Step(JWT, "JWT secret accepted", NOT_CHECKED, "The command service answered with code " + code + ", so the secret could not be confirmed.");
        } catch (IllegalStateException ex) {
            return new Step(JWT, "JWT secret accepted", NOT_CHECKED, "The command service could not be reached.");
        }
    }
}
