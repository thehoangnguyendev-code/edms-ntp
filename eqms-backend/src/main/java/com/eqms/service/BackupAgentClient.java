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

    /** Fields that carry the person who did something. The agent stores a user name; the screen shows the full name. */
    private static final java.util.Set<String> PERSON_FIELDS = java.util.Set.of(
            "createdBy", "requestedBy", "proposedBy", "approvedBy", "restored_by", "restoredBy", "closed_by", "closedBy", "verified_by", "verifiedBy");

    private final RestClient client;
    /** For paths a caller has already encoded (search text, filters): the client above would encode the % of %20 a second time. */
    private final RestClient encodedClient;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.eqms.repository.UserAccountRepository userAccountRepository;

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
        org.springframework.web.util.DefaultUriBuilderFactory asGiven = new org.springframework.web.util.DefaultUriBuilderFactory(baseUrl);
        asGiven.setEncodingMode(org.springframework.web.util.DefaultUriBuilderFactory.EncodingMode.NONE);
        this.encodedClient = RestClient.builder()
                .uriBuilderFactory(asGiven)
                .requestFactory(factory)
                .defaultHeader("X-Agent-Token", token)
                .build();
    }

    public JsonNode get(String path, MultiValueMap<String, String> query) {
        MultiValueMap<String, String> asked = withPeople(query);
        return withFullNames(call(() -> client.get().uri(uri -> {
            uri.path(path);
            if (asked != null) uri.queryParams(asked);
            return uri.build();
        }).retrieve().body(JsonNode.class)));
    }

    /**
     * Every list the agent serves is searched by text. The agent keeps user names but the screens show full names, so a search typed as a
     * name must also find the people behind it: the user names whose full name contains the text travel with the search as "people".
     */
    private MultiValueMap<String, String> withPeople(MultiValueMap<String, String> query) {
        if (query == null || query.containsKey("people")) return query;
        String search = query.getFirst("search");
        java.util.List<String> people = usernamesByFullName(search);
        if (people.isEmpty()) return query;
        MultiValueMap<String, String> copy = new LinkedMultiValueMap<>(query);
        copy.add("people", String.join(",", people));
        return copy;
    }

    /** The same for a path a caller has already encoded: "people" is appended when its search text names someone. */
    private String withPeople(String path) {
        int mark = path == null ? -1 : path.indexOf('?');
        if (mark < 0) return path;
        MultiValueMap<String, String> params = org.springframework.web.util.UriComponentsBuilder.fromUriString(path).build().getQueryParams();
        if (params.containsKey("people") || !params.containsKey("search")) return path;
        String search = org.springframework.web.util.UriUtils.decode(params.getFirst("search") == null ? "" : params.getFirst("search"), java.nio.charset.StandardCharsets.UTF_8);
        java.util.List<String> people = usernamesByFullName(search);
        if (people.isEmpty()) return path;
        return path + "&people=" + org.springframework.web.util.UriUtils.encodeQueryParam(String.join(",", people), java.nio.charset.StandardCharsets.UTF_8);
    }

    /** User names of the people whose full name contains the text (at most 50), so a search typed as a name finds what the agent keeps as a user name. */
    public java.util.List<String> usernamesByFullName(String text) {
        if (userAccountRepository == null || text == null || text.isBlank()) return java.util.List.of();
        try {
            return userAccountRepository.findUsernamesByFullNameContaining(text.trim()).stream().limit(50).toList();
        } catch (RuntimeException e) {
            return java.util.List.of();
        }
    }

    /** Replaces a bare user name (or "Name (user)") in the person fields by the full name; a name nobody holds is left as it is. */
    JsonNode withFullNames(JsonNode body) {
        if (body == null || userAccountRepository == null) return body;
        replaceNames(body, new java.util.HashMap<>());
        return body;
    }

    private void replaceNames(JsonNode node, Map<String, String> known) {
        if (node.isObject()) {
            com.fasterxml.jackson.databind.node.ObjectNode object = (com.fasterxml.jackson.databind.node.ObjectNode) node;
            java.util.List<String> names = new java.util.ArrayList<>();
            object.fieldNames().forEachRemaining(names::add);
            for (String name : names) {
                JsonNode value = object.get(name);
                if (PERSON_FIELDS.contains(name) && value.isTextual()) {
                    object.put(name, fullName(value.asText(), known));
                } else {
                    replaceNames(value, known);
                }
            }
        } else if (node.isArray()) {
            node.forEach(child -> replaceNames(child, known));
        }
    }

    private String fullName(String raw, Map<String, String> known) {
        String text = raw == null ? "" : raw.trim();
        java.util.regex.Matcher paren = java.util.regex.Pattern.compile("^(.+) \\(([^()]+)\\)$").matcher(text);
        if (paren.matches()) return paren.group(1);
        if (text.isEmpty()) return raw;
        return known.computeIfAbsent(text, user -> {
            try {
                return userAccountRepository.findByUsernameIgnoreCase(user)
                        .map(account -> account.getFullName() == null || account.getFullName().isBlank() ? user : account.getFullName())
                        .orElse(user);
            } catch (RuntimeException e) {
                return user;
            }
        });
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
            RestClient.RequestBodySpec spec = encodedClient.method(method).uri(org.springframework.http.HttpMethod.GET.equals(method) ? withPeople(path) : path).contentType(MediaType.APPLICATION_JSON);
            if (body != null) spec.body(body);
            return spec
                    .exchange((request, response) -> {
                        int status = response.getStatusCode().value();
                        if (status >= 500) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, AGENT_UNAVAILABLE_REASON);
                        byte[] bytes = response.getBody().readAllBytes();
                        JsonNode node = bytes.length == 0 ? new com.fasterxml.jackson.databind.ObjectMapper().createObjectNode()
                                : new com.fasterxml.jackson.databind.ObjectMapper().readTree(bytes);
                        return new Reply(status, org.springframework.http.HttpMethod.GET.equals(method) ? withFullNames(node) : node);
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
