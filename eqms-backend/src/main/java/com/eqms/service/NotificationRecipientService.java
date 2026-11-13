package com.eqms.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

/**
 * What the recipient screens need to say who a notification reaches: the permissions, roles and departments a rule can name (so that nobody types a code), and, for a
 * list of rules, the people each one finds today. The people the sender names when the event happens (the author, the reviewer) cannot be known before it
 * does; they are reported as such.
 */
@Service
public class NotificationRecipientService {
    /** How many names are listed for one rule: the screen shows a few and the rest on request, so a group of every user is not sent whole. */
    static final int NAMES = 50;

    public record Choice(String value, String label, String description) {
    }

    public record RuleView(String type, String value, String valueLabel, boolean named, int people, List<String> names) {
    }

    public record Preview(List<RuleView> rules, int inAppPeople, int emailPeople) {
    }

    private final NotificationDispatcher dispatcher;
    private final JdbcTemplate jdbc;

    public NotificationRecipientService(NotificationDispatcher dispatcher, JdbcTemplate jdbc) {
        this.dispatcher = dispatcher;
        this.jdbc = jdbc;
    }

    /** The things a rule of this type can be given: the permission (its code, shown by its name), the role or the department (by name). */
    @Transactional(readOnly = true)
    public List<Choice> choices(String type) {
        String kind = type == null ? "" : type.trim().toUpperCase(Locale.ROOT);
        return switch (kind) {
            case "PERMISSION" -> jdbc.query("select code, name, coalesce(category, '') as category from permissions order by category, name",
                    (rs, i) -> new Choice(rs.getString("code"), rs.getString("name"), rs.getString("category")));
            case "ROLE" -> jdbc.query("select name, coalesce(description, '') as description from roles where is_active = true order by name",
                    (rs, i) -> new Choice(rs.getString("name"), rs.getString("name"), rs.getString("description")));
            case "DEPARTMENT" -> jdbc.query("select name, coalesce(description, '') as description from departments where is_active = true order by name",
                    (rs, i) -> new Choice(rs.getString("name"), rs.getString("name"), rs.getString("description")));
            default -> throw new IllegalArgumentException("Only PERMISSION, ROLE and DEPARTMENT have a list of values.");
        };
    }

    /** The people each rule finds today, and how many people the rules of each channel reach in all (not counting the people the sender names). */
    @Transactional(readOnly = true)
    public Preview preview(JsonNode rules) {
        NotificationRecipientRules.validate(rules);
        List<RuleView> views = new ArrayList<>();
        for (JsonNode rule : rules) {
            String type = rule.path("type").asText("").trim().toUpperCase(Locale.ROOT);
            String value = rule.path("value").asText("").trim();
            boolean named = NotificationRecipientRules.isContext(type);
            List<String> names = new ArrayList<>();
            int people = 0;
            if (!named) {
                var single = JsonNodeFactory.instance.arrayNode().add(rule);
                var found = dispatcher.resolveRecipients(single, List.of());
                people = found.size();
                found.stream().limit(NAMES).forEach(user -> names.add(user.getFullName() != null && !user.getFullName().isBlank() ? user.getFullName() : String.valueOf(user.getUsername())));
            }
            views.add(new RuleView(type, value, labelOf(type, value), named, people, names));
        }
        return new Preview(views,
                dispatcher.resolveRecipients(NotificationRecipientRules.forChannel(rules, "IN_APP"), List.of()).size(),
                dispatcher.resolveRecipients(NotificationRecipientRules.forChannel(rules, "EMAIL"), List.of()).size());
    }

    private String labelOf(String type, String value) {
        if (value.isEmpty() || !"PERMISSION".equals(type)) return value;
        List<String> names = jdbc.query("select name from permissions where code = ?", (rs, i) -> rs.getString(1), value);
        return names.stream().filter(Objects::nonNull).findFirst().orElse(value);
    }
}
