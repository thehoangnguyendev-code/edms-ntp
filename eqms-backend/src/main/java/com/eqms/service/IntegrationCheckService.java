package com.eqms.service;

import com.eqms.entity.UserAccount;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The result of the last "Test connection" of each integration (Configuration > Integrations), kept so that the screen can show what was tested, when, by whom and what
 * came back instead of a notice that disappears. One row per integration, overwritten by the next test.
 *
 * <p>This is a convenience record, not audit evidence: a failure to write it is logged and never changes the answer of the test that produced it.
 */
@Service
public class IntegrationCheckService {
    private static final Logger log = LoggerFactory.getLogger(IntegrationCheckService.class);
    public static final String STORAGE = "STORAGE";
    public static final String ONLYOFFICE = "ONLYOFFICE";
    private static final int MAX_TEXT = 500;

    /** One thing a test looked at. {@code status} is OK, FAILED or NOT_CHECKED (the test could not tell). */
    public record Step(String key, String label, String status, String detail) {}

    public record Check(String integration, boolean success, String message, String subject, List<Step> steps, Instant checkedAt, String checkedBy) {}

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public IntegrationCheckService(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    /** Text that came from an exception or a server: one line, no control characters, bounded. */
    static String clean(String text) {
        if (text == null) return "";
        String oneLine = text.replaceAll("[\\p{Cntrl}]+", " ").trim();
        return oneLine.length() <= MAX_TEXT ? oneLine : oneLine.substring(0, MAX_TEXT - 1) + "…";
    }

    /** What was tested, in words and without any secret: the provider and where it points. */
    public static String storageSubject(JsonNode request) {
        String provider = text(request, "provider");
        return switch (provider) {
            case "minio" -> "MinIO · " + text(request, "minioEndpoint") + " · " + text(request, "minioBucket");
            case "nas" -> "NAS · " + (text(request, "nasPath").isEmpty() ? text(request, "nasHost") + "/" + text(request, "nasShareName") : text(request, "nasPath"));
            case "local" -> "Local server";
            default -> provider.isEmpty() ? "Storage" : provider;
        };
    }

    private static String text(JsonNode node, String field) {
        if (node == null) return "";
        JsonNode value = node.get(field);
        return value == null || value.isNull() ? "" : value.asText("").trim();
    }

    /** Never throws: see the class comment. */
    public void record(UserAccount actor, String integration, boolean success, String message, String subject, List<Step> steps) {
        try {
            String stepsJson = mapper.writeValueAsString(steps == null ? List.of() : steps);
            jdbc.update("INSERT INTO integration_check_result(integration_key,success,message,subject,steps,checked_at,checked_by) VALUES (?,?,?,?,CAST(? AS jsonb),now(),?) "
                            + "ON CONFLICT (integration_key) DO UPDATE SET success=EXCLUDED.success,message=EXCLUDED.message,subject=EXCLUDED.subject,steps=EXCLUDED.steps,"
                            + "checked_at=EXCLUDED.checked_at,checked_by=EXCLUDED.checked_by",
                    integration, success, clean(message), clean(subject), stepsJson, actor == null ? null : actor.getId());
        } catch (RuntimeException | JsonProcessingException ex) {
            log.warn("The result of the {} connection test could not be kept", integration);
        }
    }

    /** The last result of each integration that was ever tested, keyed by integration. */
    public Map<String, Check> latest() {
        Map<String, Check> checks = new LinkedHashMap<>();
        jdbc.query("SELECT c.integration_key,c.success,c.message,c.subject,c.steps::text,c.checked_at,u.full_name FROM integration_check_result c "
                        + "LEFT JOIN app_users u ON u.id=c.checked_by ORDER BY c.integration_key",
                rs -> {
                    checks.put(rs.getString(1), new Check(rs.getString(1), rs.getBoolean(2), rs.getString(3), rs.getString(4), parseSteps(rs.getString(5)),
                            rs.getTimestamp(6).toInstant(), rs.getString(7)));
                });
        return checks;
    }

    private List<Step> parseSteps(String json) {
        try {
            return mapper.readValue(json, new TypeReference<List<Step>>() {});
        } catch (JsonProcessingException ex) {
            return List.of();
        }
    }
}
