package com.eqms.service;

import com.eqms.dto.notification.NotificationPolicySummaryResponse;
import com.eqms.dto.user.PageResponse;
import com.eqms.entity.EmailTemplate;
import com.eqms.repository.EmailTemplateRepository;
import com.eqms.util.DateTimeFormatUtils;
import com.eqms.util.PagedList;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

/**
 * The one list of Notifications Administration: the system events (in-app) and the email messages (email) side by side, filtered, sorted and
 * paged here. Both kinds are small configuration sets, so they are read whole and cut in memory, the way the other administration lists are.
 * A filter that only one kind has (the module of an event, the type or the sent count of an email) leaves out the rows of the other kind.
 */
@Service
public class NotificationAdministrationService {

    public static final String IN_APP = "IN_APP";
    public static final String EMAIL = "EMAIL";

    private static final ZoneId ZONE = DateTimeFormatUtils.ZONE;

    /**
     * One notification. {@code id} opens it: the event code of an in-app notification, the id of an email message.
     * {@code module} and {@code priority} belong to events; {@code type} and {@code sent} to email messages.
     * {@code translation} says whether the wording of this channel has its Vietnamese: TRANSLATED, OUTDATED (the English changed since) or NOT_TRANSLATED;
     * null when the channel has no wording.
     */
    public record Row(String id, String channel, String name, String code, String description, String module, String priority,
                      String type, Integer sent, String status, Instant updatedAt, String translation) {
        /** A row whose translation is not known. */
        public Row(String id, String channel, String name, String code, String description, String module, String priority,
                   String type, Integer sent, String status, Instant updatedAt) {
            this(id, channel, name, code, description, module, priority, type, sent, status, updatedAt, null);
        }
    }

    public record Query(String search, String channel, String status, String module, String type, String usage,
                        String updatedFrom, String updatedTo, String sortBy, String sortDirection, int page, int limit, String priority) {
        /** A query without a priority filter. */
        public Query(String search, String channel, String status, String module, String type, String usage,
                     String updatedFrom, String updatedTo, String sortBy, String sortDirection, int page, int limit) {
            this(search, channel, status, module, type, usage, updatedFrom, updatedTo, sortBy, sortDirection, page, limit, null);
        }
    }

    private final NotificationPolicyService policies;
    private final EmailTemplateRepository emailTemplates;
    private final org.springframework.jdbc.core.JdbcTemplate jdbc;

    public NotificationAdministrationService(NotificationPolicyService policies, EmailTemplateRepository emailTemplates, org.springframework.jdbc.core.JdbcTemplate jdbc) {
        this.policies = policies;
        this.emailTemplates = emailTemplates;
        this.jdbc = jdbc;
    }

    /** How many notifications each event has sent on its channel: the in-app notifications recorded under its code, the e-mails queued under its code. A failure leaves the counts empty. */
    private java.util.Map<String, Integer> sentCounts(String channel) {
        java.util.Map<String, Integer> counts = new java.util.HashMap<>();
        if (jdbc == null) return counts;
        try {
            String sql = IN_APP.equals(channel) ? "select type, count(*) from user_notifications group by type" : "select event_code, count(*) from notification_email_outbox group by event_code";
            jdbc.query(sql, rs -> {
                counts.put(rs.getString(1), rs.getInt(2));
            });
        } catch (RuntimeException failure) {
            // the list is still useful without the counts
        }
        return counts;
    }

    /** The translation of the active English wording of every event and channel, keyed "code/CHANNEL". A failure leaves the column empty. */
    private java.util.Map<String, String> translationStates() {
        java.util.Map<String, String> states = new java.util.HashMap<>();
        if (jdbc == null) return states;
        try {
            // the same rule as sending: a Vietnamese wording counts only when it was made from the English version in use
            jdbc.query("""
                select p.event_code, v.channel, case when t.id is null then 'NOT_TRANSLATED' when t.base_version_id = v.id then 'TRANSLATED' else 'OUTDATED' end
                  from notification_policies p
                  join notification_template_versions v on v.policy_id = p.id and v.status = 'ACTIVE'
                  left join notification_template_translations t on t.policy_id = p.id and t.channel = v.channel and t.language = 'vi' and t.status = 'ACTIVE'
                """, rs -> {
                states.put(rs.getString(1) + "/" + rs.getString(2), rs.getString(3));
            });
        } catch (RuntimeException failure) {
            // the list is still useful without the translation column
        }
        return states;
    }

    @Transactional(readOnly = true)
    public PageResponse<Row> list(Query q, boolean includeEvents, boolean includeEmails) {
        String channel = StringUtils.hasText(q.channel()) ? q.channel().trim().toUpperCase(Locale.ROOT) : "";
        // an event is listed once for each channel it supports (the in-app notification and the e-mail are edited separately); the channel filter is applied below
        boolean wantEvents = includeEvents;
        boolean wantEmails = includeEmails && !IN_APP.equals(channel);
        List<Row> rows = new ArrayList<>();
        if (wantEvents) {
            java.util.Map<String, Integer> inApp = channel.equals(EMAIL) ? java.util.Map.of() : sentCounts(IN_APP);
            java.util.Map<String, Integer> mail = channel.equals(IN_APP) ? java.util.Map.of() : sentCounts(EMAIL);
            java.util.Map<String, String> translations = translationStates();
            policies.list(null, null, null, null, "module", "asc", 1, Integer.MAX_VALUE).data().forEach(e -> fromEvent(e).forEach(row ->
                    rows.add(new Row(row.id(), row.channel(), row.name(), row.code(), row.description(), row.module(), row.priority(), row.type(),
                            (IN_APP.equals(row.channel()) ? inApp : mail).getOrDefault(row.code(), 0), row.status(), row.updatedAt(), translations.get(row.code() + "/" + row.channel())))));
        }
        if (wantEmails) {
            emailTemplates.findAll().forEach(t -> rows.add(fromEmail(t)));
        }
        // the notices of the modules that are still written as an e-mail message produce an in-app notification too, from the same wording: they are listed
        // among the in-app notifications (and open the e-mail message that holds the wording), so that no notification of the system is missing from the list
        if (includeEmails && !EMAIL.equals(channel)) {
            emailTemplates.findAll().stream().filter(t -> producesInAppNotification(t.getType())).forEach(t -> rows.add(fromEmailInApp(t)));
        }

        String needle = StringUtils.hasText(q.search()) ? q.search().trim().toLowerCase(Locale.ROOT) : null;
        Instant from = start(q.updatedFrom());
        Instant to = end(q.updatedTo());
        List<Row> shown = rows.stream()
                .filter(r -> channel.isEmpty() || channel.equals(r.channel()))
                .filter(r -> !StringUtils.hasText(q.status()) || statusKey(q.status()).equals(r.status()))
                .filter(r -> !StringUtils.hasText(q.module()) || (r.module() != null && com.eqms.util.ModuleKeys.same(q.module(), r.module())))
                .filter(r -> !StringUtils.hasText(q.type()) || q.type().equalsIgnoreCase(r.type()))
                .filter(r -> !StringUtils.hasText(q.priority()) || q.priority().trim().equalsIgnoreCase(r.priority()))
                .filter(r -> usageMatches(q.usage(), r))
                .filter(r -> from == null || (r.updatedAt() != null && !r.updatedAt().isBefore(from)))
                .filter(r -> to == null || (r.updatedAt() != null && !r.updatedAt().isAfter(to)))
                .filter(r -> needle == null || text(r).contains(needle))
                .sorted(comparator(q.sortBy(), q.sortDirection()))
                .toList();
        return PagedList.paginate(shown, q.page(), q.limit());
    }

    /**
     * Every placeholder that can be written anywhere in the notifications of the system: those the events offer and those the email messages
     * use, once each. A notification offers only some of them; the screen says which.
     */
    @Transactional(readOnly = true)
    public List<com.eqms.dto.notification.NotificationVariableResponse> placeholders(boolean includeEvents, boolean includeEmails) {
        if (!includeEvents && !includeEmails) return List.of();
        java.util.Map<String, com.eqms.dto.notification.NotificationVariableResponse> all = new java.util.TreeMap<>((java.util.Comparator<String>) (a, b) -> { int c = a.compareToIgnoreCase(b); return c != 0 ? c : a.compareTo(b); }); // case-sensitive as the renderer is: the renderer does not fold case, so two names that differ only by case stay two placeholders
        // what the senders of every module fill in comes first and gives the label, the example and the module
        NotificationPlaceholderCatalog.all().forEach(e -> all.put(e.name(), new com.eqms.dto.notification.NotificationVariableResponse(
                e.name(), "{{" + e.name() + "}}", e.label(), e.sample(), e.module())));
        if (includeEvents) {
            policies.allEventVariables().forEach(v -> all.putIfAbsent(v.name(), inModule(v)));
        }
        if (includeEmails) {
            emailTemplates.findAll().forEach(t -> t.getVariablesList().stream().filter(StringUtils::hasText).forEach(name ->
                    all.putIfAbsent(name, new com.eqms.dto.notification.NotificationVariableResponse(name, "{{" + name + "}}",
                            NotificationPolicyService.variableLabel(name), "(example)", NotificationPlaceholderCatalog.OTHER))));
        }
        return List.copyOf(all.values());
    }

    private static com.eqms.dto.notification.NotificationVariableResponse inModule(com.eqms.dto.notification.NotificationVariableResponse v) {
        return v.module() != null ? v : new com.eqms.dto.notification.NotificationVariableResponse(v.name(), v.token(), v.label(), v.sample(), NotificationPlaceholderCatalog.OTHER);
    }

    /**
     * The rows of an event: one for its in-app notification and, when the event can be sent by e-mail, one for its e-mail. The status of a row is that of the
     * notification on its channel: an active policy that does not send on the channel is inactive there.
     */
    private static List<Row> fromEvent(NotificationPolicySummaryResponse e) {
        List<Row> rows = new ArrayList<>();
        java.util.Set<String> supported = channelsOf(e.supportedChannels());
        java.util.Set<String> enabled = channelsOf(e.enabledChannels());
        for (String channel : List.of(IN_APP, EMAIL)) {
            if (!supported.contains(channel)) continue;
            String status = statusKey(e.policyStatus());
            if ("ACTIVE".equals(status) && !enabled.contains(channel)) status = "INACTIVE";
            rows.add(new Row(e.eventCode(), channel, e.name(), e.eventCode(), e.description(), e.module(), e.priority(), null, null, status, e.updatedAt()));
        }
        return rows;
    }

    private static java.util.Set<String> channelsOf(String csv) {
        if (!StringUtils.hasText(csv)) return java.util.Set.of();
        return java.util.Arrays.stream(csv.split(",")).map(c -> c.trim().toUpperCase(Locale.ROOT)).filter(c -> !c.isEmpty()).collect(java.util.stream.Collectors.toSet());
    }

    /** The e-mail messages that are only an e-mail: an account, a password, a one-time code, a file for the Document Control Officer, an external recipient. */
    private static final java.util.Set<String> EMAIL_ONLY_TYPES = java.util.Set.of(
            "account-unlocked", "password-reset", "user-welcome", "account-activation", "controlled-copy-batch-distribution-dco-zip", "uncontrolled-copy-distribution");

    /** A message that is also a registry event is listed as that event, not twice. */
    static boolean producesInAppNotification(String type) {
        return type != null && !EMAIL_ONLY_TYPES.contains(type.trim().toLowerCase(Locale.ROOT)) && LegacyMessageEvents.forMessageType(type).isEmpty();
    }

    /** The module a message type belongs to, from its name. */
    static String moduleOfType(String type) {
        String t = type == null ? "" : type.trim().toLowerCase(Locale.ROOT);
        if (t.startsWith("controlled-copy") || t.startsWith("uncontrolled-copy")) return "CONTROLLED_COPIES";
        if (t.startsWith("document") || t.startsWith("revision")) return "DOCUMENT_CONTROL";
        if (t.startsWith("training")) return "TRAINING";
        if (t.startsWith("knowledge")) return "KNOWLEDGE";
        if (t.startsWith("audit")) return "AUDIT_TRAIL";
        return "SYSTEM";
    }

    private static Row fromEmailInApp(EmailTemplate t) {
        String note = "The in-app text is taken from this e-mail message. ";
        return new Row(t.getId().toString(), IN_APP, t.getName(), t.getType(), note + (t.getDescription() == null ? "" : t.getDescription()), moduleOfType(t.getType()), null,
                t.getType(), t.getUsageCount(), statusKey(t.getStatus()), t.getUpdatedDate(), "NOT_TRANSLATED");
    }

    private static Row fromEmail(EmailTemplate t) {
        // the notification of such a message is its registry event; the message is kept for an e-mail to an external address and as the wording it started from
        String note = LegacyMessageEvents.forMessageType(t.getType()).map(e -> "The notification itself is edited as the event " + e.code() + "; this message is used for e-mail to an external address. ").orElse("");
        return new Row(t.getId().toString(), EMAIL, t.getName(), t.getType(), note + (t.getDescription() == null ? "" : t.getDescription()), null, null,
                t.getType(), t.getUsageCount(), statusKey(t.getStatus()), t.getUpdatedDate(), "NOT_TRANSLATED");
    }

    /** Active, Draft and Inactive for both kinds: an event is "disabled" where an email message is "inactive". */
    static String statusKey(String status) {
        String s = status == null ? "" : status.trim().toUpperCase(Locale.ROOT);
        return "DISABLED".equals(s) ? "INACTIVE" : s;
    }

    private static boolean usageMatches(String usage, Row row) {
        if (!StringUtils.hasText(usage)) return true;
        if (row.sent() == null) return false;
        return switch (usage.trim().toUpperCase(Locale.ROOT)) {
            case "SENT" -> row.sent() > 0;
            case "NEVER_SENT" -> row.sent() == 0;
            default -> true;
        };
    }

    private static String text(Row r) {
        return String.join(" ", nz(r.name()), nz(r.code()), nz(r.description()), r.channel().equals(IN_APP) ? "in-app" : "email", nz(r.status()))
                .toLowerCase(Locale.ROOT);
    }

    private static Comparator<Row> comparator(String sortBy, String direction) {
        Comparator<Row> byName = Comparator.comparing(r -> nz(r.name()).toLowerCase(Locale.ROOT));
        Comparator<Row> comparator = switch (sortBy == null ? "" : sortBy) {
            case "channel" -> Comparator.comparing(Row::channel).thenComparing(byName);
            case "status" -> Comparator.comparing((Row r) -> nz(r.status())).thenComparing(byName);
            case "updatedAt" -> Comparator.comparing((Row r) -> r.updatedAt() == null ? Instant.EPOCH : r.updatedAt()).thenComparing(byName);
            case "priority" -> Comparator.comparingInt((Row r) -> r.priority() == null ? 0 : NotificationPolicyService.priorityRank(r.priority())).thenComparing(byName);
            case "category" -> Comparator.comparing((Row r) -> nz(r.module() != null ? r.module() : r.type()).toLowerCase(Locale.ROOT)).thenComparing(byName);
            default -> byName;
        };
        return "desc".equalsIgnoreCase(direction) ? comparator.reversed() : comparator;
    }

    private static String key(String value) {
        return value.trim().toUpperCase(Locale.ROOT).replace(' ', '_');
    }

    private static String nz(String value) {
        return value == null ? "" : value;
    }

    private static Instant start(String value) {
        LocalDate date = parse(value);
        return date == null ? null : date.atStartOfDay(ZONE).toInstant();
    }

    private static Instant end(String value) {
        LocalDate date = parse(value);
        return date == null ? null : date.plusDays(1).atStartOfDay(ZONE).toInstant().minusMillis(1);
    }

    private static LocalDate parse(String value) {
        return com.eqms.util.DateRangeFilter.dayOrNull(value);
    }
}
