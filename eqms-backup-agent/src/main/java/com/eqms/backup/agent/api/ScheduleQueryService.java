package com.eqms.backup.agent.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * The schedule of the active policy as rows, one per backup component, with search, filter, sort and paging done here so the
 * screen behaves like every other list. A component the agent cannot back up yet is a row that says "not scheduled"; nothing
 * is invented for it.
 */
@Service
public class ScheduleQueryService {

    /** Every component the product will back up, in the order the screens show them. Only DATABASE is backed up so far. */
    static final List<String> COMPONENTS = List.of("DATABASE", "OBJECT_STORE", "FILE_STORAGE", "CONFIGURATION");
    private static final Map<String, Comparator<Map<String, Object>>> SORT = Map.of(
            // the product order (database first), not alphabetical
            "component", Comparator.comparingInt(row -> COMPONENTS.indexOf((String) row.get("component"))),
            "type", Comparator.comparing(row -> (String) row.get("type")),
            "frequency", Comparator.comparing(row -> (String) row.get("frequency")),
            "time", Comparator.comparing(row -> (String) row.get("time")),
            "status", Comparator.comparing(row -> (String) row.get("status")));
    private static final ObjectMapper JSON = new ObjectMapper();

    private final JdbcTemplate jdbc;

    public ScheduleQueryService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Map<String, Object> rows(String search, String status, String type, String frequency, String sortBy, boolean ascending, int page, int limit) {
        int size = Math.min(Math.max(limit, 1), 100);
        int pageNo = Math.max(page, 1);
        List<Map<String, Object>> all = new ArrayList<>(allRows());

        String needle = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        if (!needle.isEmpty()) {
            all.removeIf(row -> row.values().stream().noneMatch(v -> String.valueOf(v).toLowerCase(Locale.ROOT).contains(needle)));
        }
        if (status != null && !status.isBlank() && !"ALL".equals(status)) {
            all.removeIf(row -> !status.equals(row.get("status")));
        }
        if (type != null && !type.isBlank() && !"ALL".equals(type)) {
            all.removeIf(row -> !type.equals(row.get("type")));
        }
        if (frequency != null && !frequency.isBlank() && !"ALL".equals(frequency)) {
            all.removeIf(row -> !frequency.equals(row.get("frequency")));
        }
        Comparator<Map<String, Object>> comparator = SORT.getOrDefault(sortBy == null ? "" : sortBy, SORT.get("component"));
        all.sort(ascending ? comparator : comparator.reversed());

        int from = Math.min((pageNo - 1) * size, all.size());
        List<Map<String, Object>> data = all.subList(from, Math.min(from + size, all.size()));
        Map<String, Object> pagination = new LinkedHashMap<>();
        pagination.put("page", pageNo);
        pagination.put("limit", size);
        pagination.put("total", all.size());
        pagination.put("totalPages", Math.max(1, (int) Math.ceil(all.size() / (double) size)));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("data", data);
        out.put("pagination", pagination);
        return out;
    }

    private List<Map<String, Object>> allRows() {
        JsonNode database = JSON.createObjectNode();
        try {
            String schedule = jdbc.queryForList("select schedule_json::text from backup_policy where status = 'ACTIVE'", String.class).stream().findFirst().orElse("{}");
            database = JSON.readTree(schedule).path("database");
        } catch (Exception ignored) {
            // an unreadable policy means nothing is scheduled; the screen shows that rather than a guess
        }
        List<Map<String, Object>> rows = new ArrayList<>();
        for (String component : COMPONENTS) {
            boolean scheduled = "DATABASE".equals(component) && database.path("enabled").asBoolean(false);
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("component", component);
            row.put("type", scheduled ? database.path("type").asText("") : "");
            row.put("frequency", scheduled ? database.path("frequency").asText("") : "");
            row.put("time", scheduled ? database.path("time").asText("") : "");
            row.put("status", scheduled ? "ACTIVE" : "NOT_SCHEDULED");
            rows.add(row);
        }
        return rows;
    }
}
