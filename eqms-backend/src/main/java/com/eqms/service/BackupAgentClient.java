package com.eqms.service;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.util.Map;

/**
 * The eQMS side of the conversation with the Backup Agent. The backend never runs a backup, never reads the backup target and
 * never holds an encryption key; it asks the agent, which does the work with its own, narrower access (SDS-BR-001 section 3).
 * Every call carries a shared secret; if the agent cannot be reached the caller gets a clear 503, never an empty success.
 */
@Service
public class BackupAgentClient {

    /** Shown to the person when the backup agent cannot answer: says what is wrong and what to check. */
    static final String AGENT_UNAVAILABLE_REASON = "The backup agent cannot be reached (BACKUP_AGENT_UNAVAILABLE). It may be stopped or restarting: check the eqms-backup-agent service.";

    private final RestClient client;

    public BackupAgentClient(@Value("${app.backup-agent.url:http://backup-agent:5600}") String baseUrl,
                             @Value("${app.backup-agent.token:}") String token) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) Duration.ofSeconds(3).toMillis());
        factory.setReadTimeout((int) Duration.ofSeconds(20).toMillis());
        this.client = RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(factory)
                .defaultHeader("X-Agent-Token", token)
                .build();
    }

    public JsonNode get(String path, MultiValueMap<String, String> query) {
        return call(() -> client.get().uri(uri -> {
            uri.path(path);
            if (query != null) uri.queryParams(query);
            return uri.build();
        }).retrieve().body(JsonNode.class));
    }

    public JsonNode get(String path) {
        return get(path, new LinkedMultiValueMap<>());
    }

    public JsonNode post(String path, Map<String, Object> body) {
        return call(() -> client.post().uri(path).contentType(MediaType.APPLICATION_JSON).body(body).retrieve().body(JsonNode.class));
    }

    /** The agent's answer to a call whose refusal is part of the conversation (a policy that fails the gate, for example). */
    public record Reply(int status, JsonNode body) {
        public boolean ok() {
            return status >= 200 && status < 300;
        }
    }

    /**
     * Like {@link #get(String)} and {@link #post(String, Map)} but a 4xx answer from the agent is returned with its body instead of
     * being turned into an exception, so the caller can show the agent's reasons. An unreachable agent is still a 503.
     */
    public Reply exchange(org.springframework.http.HttpMethod method, String path, Map<String, Object> body) {
        try {
            RestClient.RequestBodySpec spec = client.method(method).uri(path).contentType(MediaType.APPLICATION_JSON);
            if (body != null) spec.body(body);
            return spec
                    .exchange((request, response) -> {
                        int status = response.getStatusCode().value();
                        if (status >= 500) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, AGENT_UNAVAILABLE_REASON);
                        byte[] bytes = response.getBody().readAllBytes();
                        JsonNode node = bytes.length == 0 ? new com.fasterxml.jackson.databind.ObjectMapper().createObjectNode()
                                : new com.fasterxml.jackson.databind.ObjectMapper().readTree(bytes);
                        return new Reply(status, node);
                    });
        } catch (ResponseStatusException e) {
            throw e;
        } catch (RestClientException e) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, AGENT_UNAVAILABLE_REASON);
        }
    }

    private JsonNode call(java.util.function.Supplier<JsonNode> request) {
        try {
            return request.get();
        } catch (HttpStatusCodeException e) {
            // 404 and 400 from the agent are the caller's problem and keep their meaning; anything else is the agent's.
            HttpStatus status = HttpStatus.resolve(e.getStatusCode().value());
            if (status == HttpStatus.NOT_FOUND || status == HttpStatus.BAD_REQUEST) {
                throw new ResponseStatusException(status, e.getResponseBodyAsString());
            }
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, AGENT_UNAVAILABLE_REASON);
        } catch (RestClientException e) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, AGENT_UNAVAILABLE_REASON);
        }
    }
}
