package com.eqms.service;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Who can receive a notification, as the policy of an event says it. A rule is one of two kinds:
 * <ul>
 *   <li><b>context</b>: the people the sender names (the author of the document, the reviewer who has to act). The dispatcher does not search for
 *       them; the module code that raises the event passes them, and the rule says which role of the process they are, so the screen can say it.</li>
 *   <li><b>audience</b>: people the dispatcher finds by itself, whatever the sender passes: every active user, the holders of a permission, the people
 *       of a role, the people of a department.</li>
 * </ul>
 * One list for the dispatcher, the checks of a policy and the screens, so the code and the words cannot drift apart.
 */
public final class NotificationRecipientRules {

    public static final String CONTEXT = "CONTEXT";
    public static final String AUDIENCE = "AUDIENCE";

    /** @param needsValue an audience that needs one more word: the permission code, the role, the department */
    public record Rule(String type, String kind, String label, String description, boolean needsValue, String valueLabel) {
    }

    private static final List<Rule> RULES = List.of(
            new Rule("OWNER", CONTEXT, "Owner of the record", "The person the record belongs to; named by the module that raises the event.", false, null),
            new Rule("AUTHOR", CONTEXT, "Author", "The author of the document or record.", false, null),
            new Rule("ASSIGNEE", CONTEXT, "Person it is assigned to", "The person who has been given the task.", false, null),
            new Rule("REVIEWER", CONTEXT, "Reviewer", "The reviewers of the process.", false, null),
            new Rule("APPROVER", CONTEXT, "Approver", "The approvers of the process.", false, null),
            new Rule("RECIPIENT", CONTEXT, "Recipient of the item", "The person the item is handed to (for example the holder of a controlled copy).", false, null),
            new Rule("ACTOR", CONTEXT, "Person who did it", "The person who performed the action that raised the notification.", false, null),
            new Rule("AFFECTED_USERS", CONTEXT, "People it happens to", "The people the event is about; they are told even if their account is no longer active.", false, null),
            new Rule("ALL_USERS", AUDIENCE, "Every active user", "Every user whose account is active.", false, null),
            new Rule("PERMISSION", AUDIENCE, "Holders of a permission", "Every active user who holds the permission.", true, "Permission code"),
            new Rule("ROLE", AUDIENCE, "People of a role", "Every active user whose role is the one given.", true, "Role name"),
            new Rule("DEPARTMENT", AUDIENCE, "People of a department", "Every active user of the department.", true, "Department"));

    private static final Map<String, Rule> BY_TYPE = RULES.stream().collect(Collectors.toMap(Rule::type, Function.identity()));

    private NotificationRecipientRules() {
    }

    public static List<Rule> all() {
        return RULES;
    }

    public static Rule find(String type) {
        return type == null ? null : BY_TYPE.get(type.trim().toUpperCase(Locale.ROOT));
    }

    public static boolean isContext(String type) {
        Rule rule = find(type);
        return rule != null && CONTEXT.equals(rule.kind());
    }

    /**
     * Checks the rules a policy is given: a list, every type one of the above, every audience that needs a word given one, no rule twice.
     * @throws IllegalArgumentException with the words to show the person
     */
    /** The channels a rule can name. */
    public static final java.util.Set<String> CHANNELS = java.util.Set.of("IN_APP", "EMAIL");

    /** Whether a rule reaches its people on the channel: a rule that names no channels reaches them on every channel the event sends on. */
    public static boolean appliesTo(JsonNode rule, String channel) {
        JsonNode channels = rule == null ? null : rule.get("channels");
        if (channels == null || !channels.isArray() || channels.isEmpty()) return true;
        for (JsonNode name : channels) {
            if (channel != null && channel.equalsIgnoreCase(name.asText(""))) return true;
        }
        return false;
    }

    /** Whether any rule names its own channels (then the people of each channel are worked out one channel at a time). */
    public static boolean hasChannelRules(JsonNode rules) {
        if (rules == null || !rules.isArray()) return false;
        for (JsonNode rule : rules) {
            JsonNode channels = rule.get("channels");
            if (channels != null && channels.isArray() && !channels.isEmpty()) return true;
        }
        return false;
    }

    /** The rules that reach people on the channel. */
    public static com.fasterxml.jackson.databind.node.ArrayNode forChannel(JsonNode rules, String channel) {
        com.fasterxml.jackson.databind.node.ArrayNode kept = com.fasterxml.jackson.databind.node.JsonNodeFactory.instance.arrayNode();
        if (rules != null && rules.isArray()) {
            for (JsonNode rule : rules) {
                if (appliesTo(rule, channel)) kept.add(rule);
            }
        }
        return kept;
    }

    public static void validate(JsonNode rules) {
        if (rules == null || !rules.isArray()) {
            throw new IllegalArgumentException("The recipients must be a list of rules.");
        }
        java.util.Set<String> seen = new java.util.HashSet<>();
        for (JsonNode node : rules) {
            String type = node.path("type").asText("").trim().toUpperCase(Locale.ROOT);
            Rule rule = BY_TYPE.get(type);
            if (rule == null) {
                throw new IllegalArgumentException("Unknown recipient rule \"" + node.path("type").asText("") + "\". Use one of: "
                        + RULES.stream().map(Rule::type).collect(Collectors.joining(", ")) + ".");
            }
            JsonNode channels = node.get("channels");
            if (channels != null && !channels.isNull()) {
                if (!channels.isArray() || channels.isEmpty()) {
                    throw new IllegalArgumentException("The recipient rule " + rule.label() + " needs at least one channel (IN_APP, EMAIL), or none to use every channel of the event.");
                }
                for (JsonNode channel : channels) {
                    if (!CHANNELS.contains(channel.asText("").trim().toUpperCase(Locale.ROOT))) {
                        throw new IllegalArgumentException("Unknown channel \"" + channel.asText("") + "\" for the recipient rule " + rule.label() + ". Use IN_APP or EMAIL.");
                    }
                }
            }
            String value = node.path("value").asText("").trim();
            if (rule.needsValue() && value.isEmpty()) {
                throw new IllegalArgumentException("The recipient rule " + rule.label() + " needs a value: " + rule.valueLabel().toLowerCase(Locale.ROOT) + ".");
            }
            if (!seen.add(type + "|" + value.toLowerCase(Locale.ROOT))) {
                throw new IllegalArgumentException("The recipient rule " + rule.label() + (value.isEmpty() ? "" : " (" + value + ")") + " is listed twice.");
            }
        }
    }
}
